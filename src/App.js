import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, RefreshCw, Package, DollarSign, Calendar, AlertCircle } from 'lucide-react';

// Price fetching functions (you'll add the previous code to a separate file)
// For now, I'll include the key functions here directly

const API_TOKEN = '7266e10ff3b667fb944fc578b289faffb0b9c2dc';
const BASE_URL = 'https://www.pricecharting.com/price-guide/download-custom';

const CONSOLE_MAP = {
  'nes': 'Nintendo',
  'snes': 'Super Nintendo',
  'nintendo-64': 'Nintendo 64',
  'gamecube': 'GameCube',
  'wii': 'Nintendo Wii',
  'playstation': 'PlayStation',
  'playstation-2': 'PlayStation 2',
  'playstation-3': 'PlayStation 3',
  'xbox': 'Xbox',
  'xbox-360': 'Xbox 360',
  'genesis': 'Genesis',
  'dreamcast': 'Dreamcast',
  'saturn': 'Saturn',
  'gameboy': 'Game Boy'
};

const CONSOLE_DISPLAY_TO_ID = Object.fromEntries(
  Object.entries(CONSOLE_MAP).map(([id, name]) => [name, id])
);

async function getExchangeRate() {
  try {
    // Check if we have a cached rate from today
    const cachedRate = localStorage.getItem('exchange-rate-usd-cad');
    const cachedDate = localStorage.getItem('exchange-rate-date');
    const today = new Date().toDateString();
    
    if (cachedRate && cachedDate === today) {
      console.log(`💰 Using cached exchange rate from today: 1 USD = ${parseFloat(cachedRate).toFixed(6)} CAD`);
      return parseFloat(cachedRate);
    }
    
    console.log(`🔄 Fetching fresh exchange rate from Bank of Canada...`);
    
    // Try Bank of Canada official rate first (most accurate for CAD)
    try {
      const response = await fetch('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1');
      if (!response.ok) {
        throw new Error(`Bank of Canada API error: ${response.status}`);
      }
      
      const data = await response.json();
      const rate = parseFloat(data.observations[0].FXUSDCAD.v);
      
      console.log(`✅ Fresh exchange rate from Bank of Canada (Official):`, {
        rate: rate,
        formatted: `1 USD = ${rate.toFixed(6)} CAD`,
        source: 'Bank of Canada',
        date: data.observations[0].d,
        timestamp: new Date().toISOString(),
        rawData: data.observations[0]
      });
      
      if (rate && rate > 1.0 && rate < 2.0) { // Sanity check
        // Cache the rate with today's date
        localStorage.setItem('exchange-rate-usd-cad', rate.toString());
        localStorage.setItem('exchange-rate-date', today);
        localStorage.setItem('exchange-rate-timestamp', new Date().toISOString());
        localStorage.setItem('exchange-rate-source', 'Bank of Canada (Official)');
        
        return rate;
      } else {
        throw new Error(`Invalid rate received from Bank of Canada: ${rate}`);
      }
      
    } catch (bocError) {
      console.warn(`⚠️ Bank of Canada API failed:`, bocError);
      console.log(`🔄 Falling back to ExchangeRate-API...`);
      
      // Fallback to ExchangeRate-API
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!response.ok) {
          throw new Error(`ExchangeRate-API error: ${response.status}`);
        }
        
        const data = await response.json();
        const rate = data.rates.CAD;
        
        console.log(`✅ Fallback rate from ExchangeRate-API:`, {
          rate: rate,
          formatted: `1 USD = ${rate.toFixed(6)} CAD`,
          source: 'ExchangeRate-API (Fallback)',
          timestamp: new Date().toISOString()
        });
        
        if (rate && rate > 1.0 && rate < 2.0) { // Sanity check
          // Cache the rate with today's date
          localStorage.setItem('exchange-rate-usd-cad', rate.toString());
          localStorage.setItem('exchange-rate-date', today);
          localStorage.setItem('exchange-rate-timestamp', new Date().toISOString());
          localStorage.setItem('exchange-rate-source', 'ExchangeRate-API (Fallback)');
          
          return rate;
        } else {
          throw new Error(`Invalid rate received from ExchangeRate-API: ${rate}`);
        }
        
      } catch (fallbackError) {
        console.error(`❌ Fallback API also failed:`, fallbackError);
        throw new Error('All exchange rate APIs failed');
      }
    }
    
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    
    // Try to use cached rate even if old
    const cachedRate = localStorage.getItem('exchange-rate-usd-cad');
    const cachedSource = localStorage.getItem('exchange-rate-source');
    if (cachedRate) {
      console.warn(`⚠️ Using cached exchange rate due to API error:`, {
        rate: parseFloat(cachedRate),
        formatted: `1 USD = ${parseFloat(cachedRate).toFixed(6)} CAD`,
        source: cachedSource || 'Unknown',
        note: 'This rate may be outdated'
      });
      return parseFloat(cachedRate);
    }
    
    console.warn(`⚠️ Using manual fallback rate: 1.374328 CAD (your reference rate)`);
    return 1.374328; // Your exact reference rate as final fallback
  }
}

function getConsoleId(consoleName) {
  const normalizedName = consoleName.toLowerCase();
  
  if (CONSOLE_DISPLAY_TO_ID[consoleName]) {
    return CONSOLE_DISPLAY_TO_ID[consoleName];
  }
  
  const variations = {
    'nintendo entertainment system': 'nes',
    'super nintendo entertainment system': 'snes',
    'nintendo 64': 'n64',
    'nintendo gamecube': 'gamecube',
    'sony playstation': 'playstation',
    'sony playstation 2': 'playstation-2',
    'sony playstation 3': 'playstation-3',
    'microsoft xbox': 'xbox',
    'microsoft xbox 360': 'xbox-360',
    'sega genesis': 'genesis',
    'sega dreamcast': 'dreamcast',
    'sega saturn': 'saturn',
    'game boy': 'gameboy',
    'gameboy': 'gameboy'
  };
  
  return variations[normalizedName] || normalizedName;
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  return data;
}

async function fetchMultipleGamePrices(games) {
  const results = [];
  const errors = [];
  
  console.log(`🎮 Starting price fetch for ${games.length} games in your inventory ONLY`);
  
  const exchangeRate = await getExchangeRate();
  console.log(`💱 Current exchange rate: 1 USD = ${exchangeRate.toFixed(4)} CAD`);
  
  // Group YOUR inventory games by console
  const gamesByConsole = games.reduce((acc, game) => {
    const consoleId = getConsoleId(game.console);
    if (!acc[consoleId]) {
      acc[consoleId] = [];
    }
    acc[consoleId].push(game);
    return acc;
  }, {});
  
  console.log(`📦 Your inventory spans ${Object.keys(gamesByConsole).length} console(s):`, Object.keys(gamesByConsole));
  
  // Updated proxy list with more reliable services
  const corsProxies = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://cors-anywhere.herokuapp.com/',
    'https://thingproxy.freeboard.io/fetch/',
    'https://api.allorigins.win/raw?url='
  ];
  
  // Process each console that YOU have games for
  for (const [consoleId, consoleGames] of Object.entries(gamesByConsole)) {
    try {
      console.log(`\n🔍 Fetching data for YOUR ${consoleGames.length} ${consoleId.toUpperCase()} games:`);
      consoleGames.forEach(game => console.log(`   - ${game.title}`));
      
      const targetUrl = `${BASE_URL}?t=${API_TOKEN}&category=${consoleId}-games`;
      console.log(`📡 Target URL: ${targetUrl}`);
      
      let csvText = null;
      let lastError = null;
      
      // Try each proxy service until one works
      for (let i = 0; i < corsProxies.length; i++) {
        const proxy = corsProxies[i];
        try {
          let url;
          if (proxy.includes('corsproxy.io')) {
            url = proxy + encodeURIComponent(targetUrl);
          } else if (proxy.includes('codetabs.com')) {
            url = proxy + encodeURIComponent(targetUrl);
          } else if (proxy.includes('allorigins.win')) {
            url = proxy + encodeURIComponent(targetUrl);
          } else {
            url = proxy + targetUrl;
          }
          
          console.log(`🌐 Trying proxy ${i + 1}/${corsProxies.length}: ${proxy.includes('corsproxy.io') ? 'CorsProxy.io' : proxy.includes('codetabs.com') ? 'CodeTabs' : proxy.includes('allorigins.win') ? 'AllOrigins' : proxy.includes('herokuapp.com') ? 'CORS Anywhere' : 'ThingProxy'}`);
          console.log(`🔗 Full URL: ${url}`);
          
          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
          }
          
          csvText = await response.text();
          
          // Validate that we got CSV data
          if (!csvText || csvText.length < 100 || !csvText.includes(',')) {
            throw new Error('Invalid CSV data received');
          }
          
          console.log(`✅ Successfully fetched data using proxy ${i + 1}`);
          break; // Success! Exit the proxy loop
          
        } catch (proxyError) {
          lastError = proxyError;
          console.warn(`❌ Proxy ${i + 1} failed:`, proxyError.message);
          
          // If this was a timeout or 408, try the next proxy
          if (proxyError.name === 'AbortError' || proxyError.message.includes('408')) {
            console.log(`⏰ Timeout/408 error, trying next proxy...`);
            continue;
          }
          
          // For other errors, also try next proxy
          continue;
        }
      }
      
      if (!csvText) {
        throw new Error(`All proxy services failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
      
      const allGames = parseCSV(csvText);
      console.log(`📊 Downloaded ${allGames.length} total ${consoleId} games from PriceCharting`);
      
      // Filter for North American games FIRST
      const naGames = allGames.filter(game => {
        const consoleName = game['console-name'] || '';
        return !consoleName.match(/^(JP|PAL|EU|JPN)/i);
      });
      
      console.log(`🇺🇸 Filtered to ${naGames.length} North American ${consoleId} games`);
      
      // NOW filter to ONLY your inventory games
      const yourGameTitles = consoleGames.map(g => g.title.toLowerCase());
      const yourGamesData = naGames.filter(game => 
        game['product-name'] && 
        yourGameTitles.includes(game['product-name'].toLowerCase())
      );
      
      console.log(`✅ Found ${yourGamesData.length} of your games in PriceCharting data`);
      
      // Process prices ONLY for YOUR games
      const processedGames = yourGamesData.map(game => {
        // Get the appropriate price based on condition
        let priceField = 'loose-price'; // default
        let conditionNote = '';
        
        // For debugging, log all available price fields
        const availablePrices = {
          'loose': game['loose-price'] || 'N/A',
          'complete': game['complete-price'] || 'N/A', 
          'new': game['new-price'] || 'N/A',
          'graded': game['graded-price'] || 'N/A',
          'box-only': game['box-only-price'] || 'N/A',
          'manual-only': game['manual-only-price'] || 'N/A'
        };
        
        console.log(`📊 ${game['product-name']} - Available prices:`, availablePrices);
        
        // Use appropriate price field based on condition
        const loosePrice = game['loose-price'] || '$0';
        const completePrice = game['complete-price'] || loosePrice;
        const newPrice = game['new-price'] || completePrice;
        const boxOnlyPrice = game['box-only-price'] || loosePrice;
        const manualOnlyPrice = game['manual-only-price'] || loosePrice;
        
        // Select price based on condition (this will be used when we have condition mapping)
        let selectedPrice = loosePrice;
        let selectedPriceField = 'loose-price';
        
        // For now, use loose price but we'll enhance this with condition mapping
        selectedPrice = loosePrice;
        selectedPriceField = 'loose-price';
        conditionNote = ' (using loose price - condition mapping coming soon)';
        
        // Handle Canadian dollar format (C$)
        let cleanPrice = selectedPrice;
        if (selectedPrice.startsWith('C$') || selectedPrice.startsWith('C ')) {
          // Already in CAD, no conversion needed
          cleanPrice = selectedPrice.replace(/[C$\s]/g, '');
          const priceCAD = parseFloat(cleanPrice) || 0;
          
          console.log(`💰 ${game['product-name']}: ${priceCAD.toFixed(2)} CAD (already in CAD)${conditionNote}`);
          console.log(`   Raw price: "${selectedPrice}" → Cleaned: "${cleanPrice}" → CAD: ${priceCAD.toFixed(2)}`);
          
          return {
            ...game,
            'price-usd': priceCAD / exchangeRate, // Convert back to USD for reference
            'price-cad': priceCAD,
            'available-prices': availablePrices,
            'selected-price-field': selectedPriceField,
            'raw-price': selectedPrice,
            'is-cad-price': true
          };
        } else {
          // USD price, convert to CAD
          cleanPrice = selectedPrice.replace(/[$,]/g, '');
          const priceUSD = parseFloat(cleanPrice) || 0;
          const priceCAD = priceUSD * exchangeRate;
          
          console.log(`💰 ${game['product-name']}: ${priceUSD} USD → ${priceCAD.toFixed(2)} CAD${conditionNote}`);
          console.log(`   Raw price: "${selectedPrice}" → Cleaned: "${cleanPrice}" → USD: ${priceUSD} → CAD: ${priceCAD.toFixed(2)}`);
          
          return {
            ...game,
            'price-usd': priceUSD,
            'price-cad': priceCAD,
            'available-prices': availablePrices,
            'selected-price-field': selectedPriceField,
            'raw-price': selectedPrice,
            'is-cad-price': false
          };
        }
      });
      
      // Match each of YOUR games with the price data
      for (const game of consoleGames) {
        try {
          // Try exact match first
          let gameData = processedGames.find(pg => 
            pg['product-name'] && 
            pg['product-name'].toLowerCase() === game.title.toLowerCase()
          );
          
          // If no exact match, try fuzzy matching
          if (!gameData) {
            console.log(`🔍 No exact match for "${game.title}", trying fuzzy matching...`);
            
            // Remove common words and punctuation for better matching
            const cleanTitle = game.title.toLowerCase()
              .replace(/[^\w\s]/g, '') // Remove punctuation
              .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '') // Remove common words
              .replace(/\s+/g, ' ') // Normalize spaces
              .trim();
            
            gameData = processedGames.find(pg => {
              if (!pg['product-name']) return false;
              
              const cleanProductName = pg['product-name'].toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              
              return cleanProductName.includes(cleanTitle) || cleanTitle.includes(cleanProductName);
            });
            
            if (gameData) {
              console.log(`✅ Fuzzy match found: "${game.title}" → "${gameData['product-name']}"`);
            }
          }
          
          if (gameData) {
            // Get the appropriate price field for this game's condition
            const priceField = getPriceFieldForCondition(game.condition);
            let rawPrice = gameData[priceField] || gameData['loose-price'] || '$0';
            
            // Check if the selected price field is empty or $0, try other fields
            if (!rawPrice || rawPrice === '$0' || rawPrice === 'N/A' || rawPrice === '0') {
              console.log(`⚠️ Selected price field "${priceField}" is empty for "${game.title}", trying other fields...`);
              
              // Try all available price fields in order of preference
              const priceFields = ['loose-price', 'complete-price', 'new-price', 'box-only-price', 'manual-only-price', 'graded-price'];
              
              for (const field of priceFields) {
                const testPrice = gameData[field];
                if (testPrice && testPrice !== '$0' && testPrice !== 'N/A' && testPrice !== '0') {
                  console.log(`✅ Found valid price in "${field}": ${testPrice}`);
                  rawPrice = testPrice;
                  break;
                }
              }
            }
            
            // Handle Canadian dollar format (C$)
            let finalPriceCAD;
            let finalPriceUSD;
            let isCADPrice = false;
            
            if (rawPrice.startsWith('C$') || rawPrice.startsWith('C ')) {
              // Already in CAD, no conversion needed
              const cleanPrice = rawPrice.replace(/[C$\s]/g, '');
              finalPriceCAD = parseFloat(cleanPrice) || 0;
              finalPriceUSD = finalPriceCAD / exchangeRate;
              isCADPrice = true;
            } else {
              // USD price, convert to CAD
              const cleanPrice = rawPrice.replace(/[$,]/g, '');
              finalPriceUSD = parseFloat(cleanPrice) || 0;
              finalPriceCAD = finalPriceUSD * exchangeRate;
              isCADPrice = false;
            }
            
            // Log detailed price information for debugging
            console.log(`\n🎯 Price details for "${game.title}":`);
            console.log(`   Your condition: ${game.condition}`);
            console.log(`   Selected price field: ${priceField}`);
            console.log(`   Matched product: ${gameData['product-name']}`);
            console.log(`   Available prices:`, gameData['available-prices']);
            console.log(`   Raw price: ${rawPrice}`);
            console.log(`   USD price: $${finalPriceUSD.toFixed(2)}`);
            console.log(`   CAD price: $${finalPriceCAD.toFixed(2)} (rate: ${exchangeRate})`);
            console.log(`   Price format: ${isCADPrice ? 'CAD' : 'USD'}`);
            
            // Warn if we still have $0 price
            if (finalPriceCAD === 0) {
              console.warn(`⚠️ WARNING: "${game.title}" still shows $0.00 CAD`);
              console.log(`   This might be due to:`);
              console.log(`   - Game not found in PriceCharting data`);
              console.log(`   - All price fields are empty in the data`);
              console.log(`   - Data parsing issue`);
              console.log(`   Try running: debugGamePrice("${game.title}", "${game.console}", "${game.condition}")`);
              
              // Check if this is a "N/A" case (no recent sales data)
              const allPricesEmpty = Object.values(gameData['available-prices']).every(price => 
                !price || price === 'N/A' || price === '$0' || price === '0'
              );
              
              if (allPricesEmpty) {
                console.log(`\n💡 SOLUTION: This game has no recent sales data.`);
                console.log(`   Options:`);
                console.log(`   1. Check PriceCharting website manually for estimated value`);
                console.log(`   2. Use eBay sold listings as reference`);
                console.log(`   3. Enter a manual price estimate`);
                console.log(`   4. Skip this game for now`);
                
                // Add to errors with specific message
                errors.push({
                  id: game.id,
                  title: game.title,
                  error: `No recent sales data - all price fields show N/A`,
                  type: 'no_sales_data',
                  available_prices: gameData['available-prices']
                });
              }
            }
            
            results.push({
              id: game.id,
              console: game.console,
              title: game.title,
              condition: game.condition,
              price_cad: finalPriceCAD,
              price_usd: finalPriceUSD,
              exchange_rate: exchangeRate,
              matched_product: gameData['product-name'],
              available_prices: gameData['available-prices'],
              selected_price_field: priceField,
              raw_price: rawPrice,
              is_cad_price: isCADPrice
            });
            console.log(`✅ Successfully updated price for: ${game.title}`);
          } else {
            console.warn(`❌ "${game.title}" not found in PriceCharting ${game.console} data`);
            console.log(`   Available products in this console:`, processedGames.map(pg => pg['product-name']).slice(0, 10));
            console.log(`   Try running: debugGamePrice("${game.title}", "${game.console}", "${game.condition}")`);
            errors.push({
              id: game.id,
              title: game.title,
              error: `Game not found in PriceCharting data`
            });
          }
        } catch (gameError) {
          console.error(`❌ Error processing ${game.title}:`, gameError);
          errors.push({
            id: game.id,
            title: game.title,
            error: gameError.message
          });
        }
      }
      
    } catch (consoleError) {
      console.error(`❌ Error fetching data for console ${consoleId}:`, consoleError);
      consoleGames.forEach(game => {
        errors.push({
          id: game.id,
          title: game.title,
          error: `Console data fetch failed: ${consoleError.message}`
        });
      });
    }
  }
  
  console.log(`\n🎉 Price fetch complete! Successfully updated ${results.length} games, ${errors.length} errors`);
  
  return { results, errors, exchangeRate };
}

// Add condition mapping function
function getPriceFieldForCondition(condition) {
  const conditionMap = {
    'Cart Only': 'loose-price',
    'Loose': 'loose-price',
    'Complete in Box': 'complete-price',
    'New/Sealed': 'new-price',
    'Box Only': 'box-only-price',
    'Manual Only': 'manual-only-price',
    'Graded': 'graded-price'
  };
  
  return conditionMap[condition] || 'loose-price';
}

// Add this function for testing proxies
async function testProxies() {
  console.log('🧪 Testing proxy services...');
  
  const testUrl = 'https://www.pricecharting.com/price-guide/download-custom?t=7266e10ff3b667fb944fc578b289faffb0b9c2dc&category=nes-games';
  
  const proxies = [
    { name: 'CorsProxy.io', url: 'https://corsproxy.io/?' },
    { name: 'CodeTabs', url: 'https://api.codetabs.com/v1/proxy?quest=' },
    { name: 'CORS Anywhere', url: 'https://cors-anywhere.herokuapp.com/' },
    { name: 'ThingProxy', url: 'https://thingproxy.freeboard.io/fetch/' },
    { name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=' }
  ];
  
  for (const proxy of proxies) {
    try {
      console.log(`\n🔍 Testing ${proxy.name}...`);
      
      let fullUrl;
      if (proxy.name === 'CorsProxy.io' || proxy.name === 'CodeTabs' || proxy.name === 'AllOrigins') {
        fullUrl = proxy.url + encodeURIComponent(testUrl);
      } else {
        fullUrl = proxy.url + testUrl;
      }
      
      console.log(`  GET ${fullUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const startTime = Date.now();
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const endTime = Date.now();
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`✅ ${proxy.name} SUCCESS - Status: ${response.status}, Size: ${text.length} chars, Time: ${endTime - startTime}ms`);
        if (text.includes('product-name') && text.includes('loose-price')) {
          console.log(`   📊 Valid CSV data detected`);
        } else {
          console.log(`   ⚠️ Response may not be valid CSV data`);
        }
      } else {
        console.log(`❌ ${proxy.name} FAILED - Status: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`❌ ${proxy.name} ERROR - ${error.message}`);
    }
  }
  
  console.log('\n🎯 Proxy testing complete!');
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  window.testProxies = testProxies;
}

// Add debug function for investigating pricing issues
async function debugGamePrice(gameTitle, consoleName, condition = 'Cart Only') {
  console.log(`🔍 Debugging price for: "${gameTitle}" (${consoleName}) - Condition: ${condition}`);
  
  try {
    const exchangeRate = await getExchangeRate();
    console.log(`💱 Current exchange rate: 1 USD = ${exchangeRate.toFixed(6)} CAD`);
    
    const consoleId = getConsoleId(consoleName);
    const targetUrl = `${BASE_URL}?t=${API_TOKEN}&category=${consoleId}-games`;
    
    console.log(`📡 Fetching data from: ${targetUrl}`);
    
    // Use the first working proxy
    const proxy = 'https://corsproxy.io/?';
    const url = proxy + encodeURIComponent(targetUrl);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const allGames = parseCSV(csvText);
    
    console.log(`📊 Found ${allGames.length} total games in ${consoleId} data`);
    
    // Find the specific game with multiple matching strategies
    let gameData = allGames.find(game => 
      game['product-name'] && 
      game['product-name'].toLowerCase().includes(gameTitle.toLowerCase())
    );
    
    // If no match, try fuzzy matching
    if (!gameData) {
      console.log(`🔍 No exact match, trying fuzzy matching...`);
      
      const cleanTitle = gameTitle.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      gameData = allGames.find(game => {
        if (!game['product-name']) return false;
        
        const cleanProductName = game['product-name'].toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        return cleanProductName.includes(cleanTitle) || cleanTitle.includes(cleanProductName);
      });
    }
    
    if (gameData) {
      console.log(`\n🎯 Found game data:`);
      console.log(`   Product name: ${gameData['product-name']}`);
      console.log(`   Console: ${gameData['console-name'] || 'N/A'}`);
      
      // Show all available prices
      const allPrices = {
        'Loose': gameData['loose-price'] || 'N/A',
        'Complete': gameData['complete-price'] || 'N/A',
        'New': gameData['new-price'] || 'N/A',
        'Graded': gameData['graded-price'] || 'N/A',
        'Box Only': gameData['box-only-price'] || 'N/A',
        'Manual Only': gameData['manual-only-price'] || 'N/A'
      };
      
      console.log(`\n💰 All available prices:`);
      let hasValidPrice = false;
      Object.entries(allPrices).forEach(([priceType, price]) => {
        const isValid = price && price !== 'N/A' && price !== '$0' && price !== '0';
        const status = isValid ? '✅' : '❌';
        console.log(`   ${status} ${priceType}: ${price}`);
        if (isValid) hasValidPrice = true;
      });
      
      if (!hasValidPrice) {
        console.log(`\n⚠️ PROBLEM: All price fields are empty or $0!`);
        console.log(`   This could mean:`);
        console.log(`   - The game has no recent sales data`);
        console.log(`   - PriceCharting data is incomplete for this game`);
        console.log(`   - The game might be listed under a different name`);
        console.log(`   - Try searching on PriceCharting website manually`);
      }
      
      // Get condition-appropriate price
      const priceField = getPriceFieldForCondition(condition);
      let rawPrice = gameData[priceField] || gameData['loose-price'] || '$0';
      
      // Try to find any valid price if the selected one is empty
      if (!rawPrice || rawPrice === '$0' || rawPrice === 'N/A' || rawPrice === '0') {
        console.log(`\n🔍 Selected price field "${priceField}" is empty, searching for any valid price...`);
        
        const priceFields = ['loose-price', 'complete-price', 'new-price', 'box-only-price', 'manual-only-price', 'graded-price'];
        
        for (const field of priceFields) {
          const testPrice = gameData[field];
          if (testPrice && testPrice !== '$0' && testPrice !== 'N/A' && testPrice !== '0') {
            console.log(`✅ Found valid price in "${field}": ${testPrice}`);
            rawPrice = testPrice;
            break;
          }
        }
      }
      
      console.log(`\n🎯 Price for condition "${condition}":`);
      console.log(`   Selected field: ${priceField}`);
      console.log(`   Raw price: ${rawPrice}`);
      
      // Calculate final price
      let finalPriceCAD;
      let finalPriceUSD;
      let isCADPrice = false;
      
      if (rawPrice.startsWith('C$') || rawPrice.startsWith('C ')) {
        // Already in CAD
        const cleanPrice = rawPrice.replace(/[C$\s]/g, '');
        finalPriceCAD = parseFloat(cleanPrice) || 0;
        finalPriceUSD = finalPriceCAD / exchangeRate;
        isCADPrice = true;
        console.log(`   Price format: CAD`);
        console.log(`   Cleaned price: ${cleanPrice}`);
        console.log(`   CAD price: $${finalPriceCAD.toFixed(2)}`);
        console.log(`   USD equivalent: $${finalPriceUSD.toFixed(2)}`);
      } else {
        // USD price
        const cleanPrice = rawPrice.replace(/[$,]/g, '');
        finalPriceUSD = parseFloat(cleanPrice) || 0;
        finalPriceCAD = finalPriceUSD * exchangeRate;
        isCADPrice = false;
        console.log(`   Price format: USD`);
        console.log(`   Cleaned price: ${cleanPrice}`);
        console.log(`   USD price: $${finalPriceUSD.toFixed(2)}`);
        console.log(`   CAD price: $${finalPriceCAD.toFixed(2)}`);
      }
      
      if (finalPriceCAD === 0) {
        console.log(`\n❌ RESULT: Game shows $0.00 CAD`);
        console.log(`   SOLUTIONS:`);
        console.log(`   1. Check PriceCharting website manually`);
        console.log(`   2. Try different game title variations`);
        console.log(`   3. Check if game is listed under different console`);
        console.log(`   4. Game might have no recent sales data`);
      } else {
        console.log(`\n✅ RESULT: Game shows $${finalPriceCAD.toFixed(2)} CAD`);
      }
      
      console.log(`\n🔗 Check this game on PriceCharting: https://www.pricecharting.com/game/${consoleId}/${gameData['product-name'].toLowerCase().replace(/\s+/g, '-')}`);
      
    } else {
      console.log(`❌ Game "${gameTitle}" not found in ${consoleId} data`);
      console.log(`\n🔍 Similar games found:`);
      const similarGames = allGames.filter(game => 
        game['product-name'] && 
        game['product-name'].toLowerCase().includes(gameTitle.toLowerCase().split(' ')[0])
      ).slice(0, 10);
      
      similarGames.forEach(game => {
        console.log(`   - ${game['product-name']} (${game['loose-price'] || 'N/A'})`);
      });
      
      console.log(`\n💡 SUGGESTIONS:`);
      console.log(`   1. Try different title variations (e.g., "Super Mario Bros" vs "Super Mario Bros.")`);
      console.log(`   2. Check if game is listed under different console`);
      console.log(`   3. Search PriceCharting website manually`);
      console.log(`   4. Game might not be in PriceCharting database`);
    }
    
  } catch (error) {
    console.error(`❌ Error debugging game price:`, error);
  }
}

// Make debug function available globally
if (typeof window !== 'undefined') {
  window.debugGamePrice = debugGamePrice;
}

// Add specific debug function for Golf
async function debugGolf() {
  console.log('🔍 Debugging Golf specifically...');
  
  try {
    const exchangeRate = await getExchangeRate();
    console.log(`💱 Current exchange rate: 1 USD = ${exchangeRate.toFixed(6)} CAD`);
    
    const consoleId = getConsoleId('NES');
    const targetUrl = `${BASE_URL}?t=${API_TOKEN}&category=${consoleId}-games`;
    
    console.log(`📡 Fetching data from: ${targetUrl}`);
    
    // Use the first working proxy
    const proxy = 'https://corsproxy.io/?';
    const url = proxy + encodeURIComponent(targetUrl);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const allGames = parseCSV(csvText);
    
    console.log(`📊 Found ${allGames.length} total games in NES data`);
    
    // Search for Golf specifically
    const golfGames = allGames.filter(game => 
      game['product-name'] && 
      game['product-name'].toLowerCase().includes('golf')
    );
    
    console.log(`\n🎯 Found ${golfGames.length} Golf-related games:`);
    golfGames.forEach((game, index) => {
      console.log(`   ${index + 1}. "${game['product-name']}" - Loose: ${game['loose-price'] || 'N/A'}`);
    });
    
    // Try exact match
    const exactMatch = allGames.find(game => 
      game['product-name'] && 
      game['product-name'].toLowerCase() === 'golf'
    );
    
    if (exactMatch) {
      console.log(`\n✅ Exact match found: "${exactMatch['product-name']}"`);
      console.log(`   Loose price: ${exactMatch['loose-price'] || 'N/A'}`);
      console.log(`   Complete price: ${exactMatch['complete-price'] || 'N/A'}`);
      console.log(`   New price: ${exactMatch['new-price'] || 'N/A'}`);
    } else {
      console.log(`\n❌ No exact match for "Golf"`);
    }
    
    // Try fuzzy matching
    const fuzzyMatches = allGames.filter(game => {
      if (!game['product-name']) return false;
      
      const cleanTitle = 'golf'.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const cleanProductName = game['product-name'].toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return cleanProductName.includes(cleanTitle) || cleanTitle.includes(cleanProductName);
    });
    
    console.log(`\n🔍 Fuzzy matches for "Golf":`);
    fuzzyMatches.forEach((game, index) => {
      console.log(`   ${index + 1}. "${game['product-name']}" - Loose: ${game['loose-price'] || 'N/A'}`);
    });
    
  } catch (error) {
    console.error(`❌ Error debugging Golf:`, error);
  }
}

// Make debug function available globally
if (typeof window !== 'undefined') {
  window.debugGolf = debugGolf;
}

// Add function to estimate prices for games with no sales data
function estimateGamePrice(gameTitle, consoleName, condition) {
  console.log(`🔍 Estimating price for "${gameTitle}" (${consoleName}) - ${condition}`);
  
  // Common price estimates based on game rarity and condition
  const estimates = {
    'NES': {
      'common': { loose: 5, complete: 15, new: 30 },
      'uncommon': { loose: 10, complete: 25, new: 50 },
      'rare': { loose: 25, complete: 50, new: 100 },
      'very_rare': { loose: 50, complete: 100, new: 200 }
    },
    'SNES': {
      'common': { loose: 8, complete: 20, new: 40 },
      'uncommon': { loose: 15, complete: 35, new: 70 },
      'rare': { loose: 35, complete: 70, new: 150 },
      'very_rare': { loose: 75, complete: 150, new: 300 }
    }
  };
  
  // Simple rarity detection based on game title
  const commonGames = ['mario', 'sonic', 'tetris', 'pac-man', 'donkey kong', 'zelda', 'metroid'];
  const rareGames = ['earthbound', 'chrono trigger', 'final fantasy', 'castlevania', 'mega man'];
  
  let rarity = 'common';
  const titleLower = gameTitle.toLowerCase();
  
  if (rareGames.some(game => titleLower.includes(game))) {
    rarity = 'rare';
  } else if (commonGames.some(game => titleLower.includes(game))) {
    rarity = 'common';
  } else {
    rarity = 'uncommon'; // Default for unknown games
  }
  
  const consoleEstimates = estimates[consoleName] || estimates['NES'];
  const conditionMap = {
    'Cart Only': 'loose',
    'Loose': 'loose',
    'Complete in Box': 'complete',
    'New/Sealed': 'new'
  };
  
  const priceType = conditionMap[condition] || 'loose';
  const estimatedPrice = consoleEstimates[rarity][priceType];
  
  console.log(`   Estimated rarity: ${rarity}`);
  console.log(`   Condition type: ${priceType}`);
  console.log(`   Estimated price: $${estimatedPrice} USD`);
  console.log(`   Estimated CAD: $${(estimatedPrice * 1.37).toFixed(2)} CAD`);
  
  return {
    estimatedPriceUSD: estimatedPrice,
    estimatedPriceCAD: estimatedPrice * 1.37,
    rarity: rarity,
    confidence: 'low' // Always low confidence for estimates
  };
}

// Make estimate function available globally
if (typeof window !== 'undefined') {
  window.estimateGamePrice = estimateGamePrice;
}

// Add debug function to show current state
function debugPriceUpdateState() {
  console.log('🔍 Debugging price update state...');
  console.log('📊 Manually fixed games:', Array.from(manuallyFixedGames));
  console.log('📈 Results (successfully updated):', results ? results.map(r => {
    const game = inventory.find(item => item.id === r.id);
    return game ? game.title : 'Unknown';
  }) : 'No results yet');
  console.log('❌ Errors:', errors ? errors.map(e => e.title) : 'No errors yet');
  console.log('🎯 Filtered errors:', updateErrors.map(e => e.title));
}

// Make debug function available globally
if (typeof window !== 'undefined') {
  window.debugPriceUpdateState = debugPriceUpdateState;
}

const RetroGameInventory = () => {
  // Sample data - replace with your actual data source
  const [inventory, setInventory] = useState([
    {
      id: 1,
      console: 'NES',
      title: 'Super Mario Bros 3',
      quantity: 5,
      currentPrice: 45.99,
      lastPrice: 42.50,
      condition: 'Complete in Box'
    },
    {
      id: 2,
      console: 'NES',
      title: 'The Legend of Zelda',
      quantity: 3,
      currentPrice: 62.75,
      lastPrice: 58.99,
      condition: 'Cart Only'
    },
    {
      id: 3,
      console: 'SNES',
      title: 'Super Mario World',
      quantity: 8,
      currentPrice: 28.50,
      lastPrice: 31.25,
      condition: 'Complete in Box'
    },
    {
      id: 4,
      console: 'SNES',
      title: 'Super Metroid',
      quantity: 2,
      currentPrice: 89.99,
      lastPrice: 85.75,
      condition: 'Cart Only'
    },
    {
      id: 5,
      console: 'N64',
      title: 'Super Mario 64',
      quantity: 4,
      currentPrice: 35.99,
      lastPrice: 38.50,
      condition: 'Cart Only'
    },
    {
      id: 6,
      console: 'GameBoy',
      title: 'Pokemon Red',
      quantity: 6,
      currentPrice: 55.25,
      lastPrice: 52.99,
      condition: 'Cart Only'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConsole, setSelectedConsole] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [updateErrors, setUpdateErrors] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1.35);
  const [exchangeRateDate, setExchangeRateDate] = useState(null);
  const [isUpdatingExchangeRate, setIsUpdatingExchangeRate] = useState(false);
  const [manuallyFixedGames, setManuallyFixedGames] = useState(new Set());

  const [formData, setFormData] = useState({
    console: '',
    title: '',
    quantity: 1,
    condition: 'Cart Only'
  });

  // Add function to clear manually fixed games
  const clearManuallyFixedGames = () => {
    setManuallyFixedGames(new Set());
    localStorage.removeItem('manually-fixed-games');
    console.log('✅ Cleared manually fixed games list');
  };

  // Make clear function available globally
  if (typeof window !== 'undefined') {
    window.clearManuallyFixedGames = clearManuallyFixedGames;
  }

  // Save to localStorage
  const saveInventory = (inventoryData) => {
    try {
      localStorage.setItem('retro-game-inventory', JSON.stringify(inventoryData));
      localStorage.setItem('inventory-last-updated', new Date().toISOString());
      localStorage.setItem('manually-fixed-games', JSON.stringify([...manuallyFixedGames]));
    } catch (error) {
      console.error('Failed to save inventory:', error);
    }
  };

  // Load from localStorage
  const loadInventory = () => {
    try {
      const saved = localStorage.getItem('retro-game-inventory');
      const lastUpdated = localStorage.getItem('inventory-last-updated');
      const savedRate = localStorage.getItem('exchange-rate-usd-cad');
      const savedRateDate = localStorage.getItem('exchange-rate-date');
      const savedManuallyFixed = localStorage.getItem('manually-fixed-games');
      
      if (saved) {
        return {
          inventory: JSON.parse(saved),
          lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
          exchangeRate: savedRate ? parseFloat(savedRate) : 1.35,
          exchangeRateDate: savedRateDate || null,
          manuallyFixedGames: savedManuallyFixed ? new Set(JSON.parse(savedManuallyFixed)) : new Set()
        };
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
    return null;
  };

  // Update exchange rate
  const updateExchangeRate = async () => {
    setIsUpdatingExchangeRate(true);
    try {
      const newRate = await getExchangeRate();
      setExchangeRate(newRate);
      
      const rateDate = localStorage.getItem('exchange-rate-date');
      const rateTimestamp = localStorage.getItem('exchange-rate-timestamp');
      setExchangeRateDate(rateTimestamp ? new Date(rateTimestamp) : new Date());
      
      // Update inventory storage with new rate
      const inventoryData = JSON.parse(localStorage.getItem('retro-game-inventory') || '[]');
      saveInventory(inventoryData);
      
      console.log(`💱 Exchange rate updated: 1 USD = ${newRate.toFixed(4)} CAD`);
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
    } finally {
      setIsUpdatingExchangeRate(false);
    }
  };

  // Check if exchange rate needs updating (daily check)
  const checkExchangeRateUpdate = async () => {
    const cachedDate = localStorage.getItem('exchange-rate-date');
    const today = new Date().toDateString();
    
    if (!cachedDate || cachedDate !== today) {
      console.log('🔄 Exchange rate is outdated, updating...');
      await updateExchangeRate();
    } else {
      console.log('✅ Exchange rate is current for today');
      const savedRate = localStorage.getItem('exchange-rate-usd-cad');
      const rateTimestamp = localStorage.getItem('exchange-rate-timestamp');
      if (savedRate) {
        setExchangeRate(parseFloat(savedRate));
        setExchangeRateDate(rateTimestamp ? new Date(rateTimestamp) : new Date());
      }
    }
  };

  // Load data on startup
  useEffect(() => {
    const initializeApp = async () => {
      const savedData = loadInventory();
      if (savedData) {
        setInventory(savedData.inventory);
        setLastUpdated(savedData.lastUpdated);
        setExchangeRate(savedData.exchangeRate);
        setExchangeRateDate(savedData.exchangeRateDate);
        setManuallyFixedGames(savedData.manuallyFixedGames);
      }
      
      // Check and update exchange rate if needed
      await checkExchangeRateUpdate();
    };
    
    initializeApp();
  }, []);

  // Get unique consoles for filtering
  const consoles = [...new Set(inventory.map(item => item.console))].sort();

  // Filter and sort inventory
  const filteredInventory = inventory
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesConsole = selectedConsole === 'All' || item.console === selectedConsole;
      return matchesSearch && matchesConsole;
    })
    .sort((a, b) => {
      if (a.console !== b.console) {
        return a.console.localeCompare(b.console);
      }
      return a.title.localeCompare(b.title);
    });

  // Group by console
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.console]) {
      acc[item.console] = [];
    }
    acc[item.console].push(item);
    return acc;
  }, {});

  // Real price update function using PriceCharting API
  const updatePrices = async () => {
    setIsUpdatingPrices(true);
    setUpdateProgress({ current: 0, total: inventory.length });
    setUpdateErrors([]);
    
    try {
      console.log('Starting price update for', inventory.length, 'games');
      console.log('Using exchange rate:', exchangeRate);
      
      // Use current exchange rate instead of fetching new one
      const { results, errors } = await fetchMultipleGamePrices(inventory, exchangeRate);
      
      console.log('Price update results:', { 
        successful: results.length, 
        errors: errors.length,
        exchangeRate: exchangeRate 
      });
      
      // Update inventory with new prices
      const updatedInventory = inventory.map(item => {
        const priceUpdate = results.find(r => r.id === item.id);
        
        if (priceUpdate) {
          // Game was found in PriceCharting data
          const newPrice = priceUpdate.price_cad;
          const oldPrice = item.currentPrice;
          const priceChange = newPrice - oldPrice;
          
          console.log(`💰 ${item.title}: ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} CAD (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)})`);
          
          return {
            ...item,
            lastPrice: item.currentPrice,
            currentPrice: newPrice
          };
        } else {
          // Game not found in PriceCharting data
          if (manuallyFixedGames.has(item.title)) {
            console.log(`✅ Preserving manually fixed price for "${item.title}" (not found in PriceCharting data)`);
            return item; // Keep the current price unchanged
          } else {
            // Regular game not found - keep existing price
            console.warn(`No price update found for: ${item.title} (${item.console})`);
            return item;
          }
        }
      });
      
      setInventory(updatedInventory);
      saveInventory(updatedInventory);
      setLastUpdated(new Date());
      
      // Set errors for display, but filter out manually fixed games
      if (errors.length > 0) {
        // Show errors for games that couldn't be found in PriceCharting data
        // This allows manual price entry for games that need it
        const filteredErrors = errors.filter(error => {
          // Check if this game was successfully updated in this run
          const wasUpdated = results.some(r => r.id === error.id);
          
          if (wasUpdated) {
            // Game was updated successfully - don't show as error
            return false;
          }
          
          // Game wasn't updated - show as error so user can manually fix it
          return true;
        });
        
        setUpdateErrors(filteredErrors);
        console.warn('Price update completed with errors:', filteredErrors);
        
        // Log which games were successfully updated
        const updatedGames = results.map(r => {
          const game = inventory.find(item => item.id === r.id);
          return game ? game.title : 'Unknown';
        });
        
        if (updatedGames.length > 0) {
          console.log('✅ Successfully updated games:', updatedGames);
        }
        
        // Log which games still need manual attention
        if (filteredErrors.length > 0) {
          console.log('⚠️ Games needing manual attention:', filteredErrors.map(e => e.title));
        }
      }
      
      // Show success message
      const successCount = results.length;
      const errorCount = errors.length;
      alert(`Price update completed!\n\nSuccessful: ${successCount}\nErrors: ${errorCount}\nExchange Rate: 1 USD = ${exchangeRate.toFixed(4)} CAD`);
      
    } catch (error) {
      console.error('Error updating prices:', error);
      alert(`Failed to update prices: ${error.message}`);
    } finally {
      setIsUpdatingPrices(false);
      setUpdateProgress({ current: 0, total: 0 });
    }
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.console.trim() || !formData.title.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (editingItem) {
      const updatedInventory = inventory.map(item => 
        item.id === editingItem.id 
          ? { ...item, ...formData }
          : item
      );
      setInventory(updatedInventory);
      saveInventory(updatedInventory);
      setEditingItem(null);
    } else {
      const newItem = {
        id: Date.now(),
        ...formData,
        currentPrice: 0, // Will be updated by price API
        lastPrice: 0
      };
      const updatedInventory = [...inventory, newItem];
      setInventory(updatedInventory);
      saveInventory(updatedInventory);
    }
    
    setFormData({ console: '', title: '', quantity: 1, condition: 'Cart Only' });
    setShowAddForm(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      console: item.console,
      title: item.title,
      quantity: item.quantity,
      condition: item.condition
    });
    setShowAddForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const updatedInventory = inventory.filter(item => item.id !== id);
      setInventory(updatedInventory);
      saveInventory(updatedInventory);
    }
  };

  const getPriceChangeIcon = (current, last) => {
    if (current > last) return '↗️';
    if (current < last) return '↘️';
    return '→';
  };

  const getPriceChangeColor = (current, last) => {
    if (current > last) return '#16a34a'; // green
    if (current < last) return '#dc2626'; // red
    return '#6b7280'; // gray
  };

  const totalValue = inventory.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    maxWidth: {
      maxWidth: '1400px',
      margin: '0 auto'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    title: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: '#1f2937',
      margin: 0
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    },
    buttonGreen: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: '#16a34a',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    },
    buttonSecondary: {
      padding: '8px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      backgroundColor: 'white',
      cursor: 'pointer',
      fontSize: '14px'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    statCard: {
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#f0f9ff'
    },
    statCardGreen: {
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#f0fdf4'
    },
    statCardPurple: {
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#faf5ff'
    },
    statCardOrange: {
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#fff7ed'
    },
    statLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#2563eb',
      marginBottom: '4px'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#1e40af'
    },
    controls: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    controlsRow: {
      display: 'flex',
      gap: '20px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchContainer: {
      position: 'relative',
      width: '200px',         // Much smaller
      marginRight: '20px',    // Explicit right margin
      flexShrink: 0
    },
    searchInput: {
      width: '100%',
      paddingLeft: '40px',
      paddingRight: '16px',
      paddingTop: '8px',
      paddingBottom: '8px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      boxSizing: 'border-box'  // Added to prevent overflow
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af'
    },
    select: {
      padding: '8px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      minWidth: '150px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '16px'
    },
    input: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px'
    },
    consoleHeader: {
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '12px 24px',
      margin: 0,
      fontSize: '20px',
      fontWeight: '600'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    tableHeader: {
      backgroundColor: '#f9fafb',
      padding: '12px 24px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: '500',
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderBottom: '1px solid #e5e7eb'
    },
    tableCell: {
      padding: '16px 24px',
      borderBottom: '1px solid #e5e7eb',
      fontSize: '14px'
    },
    tableRow: {
      transition: 'background-color 0.15s'
    },
    conditionBadge: {
      padding: '2px 8px',
      borderRadius: '12px',
      backgroundColor: '#dbeafe',
      color: '#1e40af',
      fontSize: '12px',
      fontWeight: '600'
    },
    actionButton: {
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      marginRight: '8px',
      borderRadius: '4px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px'
    },
    errorCard: {
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    },
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: '#e5e7eb',
      borderRadius: '4px',
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#2563eb',
      transition: 'width 0.3s ease'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Retro Game Inventory</h1>
            <div style={{display: 'flex', gap: '8px'}}>
              <button
                onClick={updateExchangeRate}
                disabled={isUpdatingExchangeRate}
                style={{
                  ...styles.buttonSecondary,
                  opacity: isUpdatingExchangeRate ? 0.5 : 1,
                  fontSize: '12px',
                  padding: '6px 12px'
                }}
              >
                <RefreshCw size={14} style={{
                  animation: isUpdatingExchangeRate ? 'spin 1s linear infinite' : 'none'
                }} />
                {isUpdatingExchangeRate ? 'Updating Rate...' : 'Refresh Rate'}
              </button>
              <button
                onClick={updatePrices}
                disabled={isUpdatingPrices}
                style={{
                  ...styles.button,
                  opacity: isUpdatingPrices ? 0.5 : 1
                }}
              >
                <RefreshCw size={16} style={{
                  animation: isUpdatingPrices ? 'spin 1s linear infinite' : 'none'
                }} />
                {isUpdatingPrices ? 'Updating Prices...' : 'Update Prices from PriceCharting'}
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {isUpdatingPrices && updateProgress.total > 0 && (
            <div style={{marginBottom: '16px'}}>
              <div style={{fontSize: '14px', marginBottom: '8px', color: '#6b7280'}}>
                Updating prices... ({updateProgress.current}/{updateProgress.total})
              </div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${(updateProgress.current / updateProgress.total) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>
                <Package size={20} />
                <span>Total Items</span>
              </div>
              <p style={styles.statValue}>{totalItems}</p>
            </div>
            <div style={styles.statCardGreen}>
              <div style={{...styles.statLabel, color: '#16a34a'}}>
                <DollarSign size={20} />
                <span>Total Value</span>
              </div>
              <p style={{...styles.statValue, color: '#15803d'}}>${totalValue.toFixed(2)} CAD</p>
            </div>
            <div style={styles.statCardPurple}>
              <div style={{...styles.statLabel, color: '#7c3aed'}}>
                <Calendar size={20} />
                <span>Last Updated</span>
              </div>
              <p style={{...styles.statValue, color: '#6d28d9', fontSize: '14px'}}>
                {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            <div style={styles.statCardOrange}>
              <div style={{...styles.statLabel, color: '#ea580c'}}>
                <DollarSign size={20} />
                <span>Exchange Rate</span>
              </div>
              <p style={{...styles.statValue, color: '#c2410c', fontSize: '16px'}}>
                1 USD = {exchangeRate.toFixed(6)} CAD
              </p>
              <div style={{fontSize: '12px', color: '#9a3412', marginTop: '2px'}}>
                {exchangeRateDate ? (
                  <>
                    {new Date().toDateString() === new Date(exchangeRateDate).toDateString() ? (
                      <span>✅ Current (updated today)</span>
                    ) : (
                      <span>⚠️ Updated {new Date(exchangeRateDate).toLocaleDateString()}</span>
                    )}
                    <br />
                    <span style={{fontSize: '10px'}}>
                      Source: {localStorage.getItem('exchange-rate-source') || 'ExchangeRate-API'}
                    </span>
                  </>
                ) : (
                  <span>📅 Click refresh to update</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {updateErrors.length > 0 && (
            <div style={styles.errorCard}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <AlertCircle size={16} style={{color: '#dc2626'}} />
                <span style={{fontWeight: '500', color: '#dc2626'}}>
                  Price Update Errors ({updateErrors.length})
                </span>
              </div>
              <div style={{fontSize: '14px', color: '#6b7280'}}>
                {updateErrors.slice(0, 5).map((error, index) => (
                  <div key={index} style={{marginBottom: '8px'}}>
                    <div>• {error.title}: {error.error}</div>
                    {error.type === 'no_sales_data' && (
                      <div style={{marginLeft: '16px', marginTop: '4px'}}>
                        <button
                          onClick={() => {
                            const estimate = estimateGamePrice(error.title, 'NES', 'Loose');
                            const manualPrice = prompt(
                              `Enter manual price for "${error.title}" (estimated: $${estimate.estimatedPriceCAD.toFixed(2)} CAD):`,
                              estimate.estimatedPriceCAD.toFixed(2)
                            );
                            if (manualPrice && !isNaN(parseFloat(manualPrice))) {
                              // Update the specific game with manual price
                              const updatedInventory = inventory.map(item => 
                                item.title === error.title 
                                  ? { ...item, currentPrice: parseFloat(manualPrice), lastPrice: item.currentPrice }
                                  : item
                              );
                              setInventory(updatedInventory);
                              
                              // Add to manually fixed games
                              const newManuallyFixed = new Set(manuallyFixedGames);
                              newManuallyFixed.add(error.title);
                              setManuallyFixedGames(newManuallyFixed);
                              
                              saveInventory(updatedInventory);
                              alert(`Updated "${error.title}" to $${manualPrice} CAD and marked as manually fixed`);
                            }
                          }}
                          style={{
                            ...styles.buttonSecondary,
                            fontSize: '12px',
                            padding: '4px 8px',
                            marginTop: '4px'
                          }}
                        >
                          💰 Enter Manual Price
                        </button>
                        <button
                          onClick={() => {
                            const estimate = estimateGamePrice(error.title, 'NES', 'Loose');
                            const updatedInventory = inventory.map(item => 
                              item.title === error.title 
                                ? { ...item, currentPrice: estimate.estimatedPriceCAD, lastPrice: item.currentPrice }
                                : item
                            );
                            setInventory(updatedInventory);
                            
                            // Add to manually fixed games
                            const newManuallyFixed = new Set(manuallyFixedGames);
                            newManuallyFixed.add(error.title);
                            setManuallyFixedGames(newManuallyFixed);
                            
                            saveInventory(updatedInventory);
                            alert(`Updated "${error.title}" to estimated price: $${estimate.estimatedPriceCAD.toFixed(2)} CAD and marked as manually fixed`);
                          }}
                          style={{
                            ...styles.buttonSecondary,
                            fontSize: '12px',
                            padding: '4px 8px',
                            marginTop: '4px',
                            marginLeft: '8px'
                          }}
                        >
                          🎯 Use Estimate
                        </button>
                        {manuallyFixedGames.has(error.title) && (
                          <button
                            onClick={() => {
                              // Remove from manually fixed games
                              const newManuallyFixed = new Set(manuallyFixedGames);
                              newManuallyFixed.delete(error.title);
                              setManuallyFixedGames(newManuallyFixed);
                              saveInventory(inventory);
                              alert(`Removed "${error.title}" from manually fixed list - it will be re-evaluated on next update`);
                            }}
                            style={{
                              ...styles.buttonSecondary,
                              fontSize: '12px',
                              padding: '4px 8px',
                              marginTop: '4px',
                              marginLeft: '8px',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              borderColor: '#fecaca'
                            }}
                          >
                            🔄 Re-evaluate
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              // Try to fetch current PriceCharting data for this game
                              const estimate = estimateGamePrice(error.title, 'NES', 'Loose');
                              const newPrice = prompt(
                                `Enter new PriceCharting price for "${error.title}" (current: $${estimate.estimatedPriceCAD.toFixed(2)} CAD):`,
                                estimate.estimatedPriceCAD.toFixed(2)
                              );
                              
                              if (newPrice && !isNaN(parseFloat(newPrice))) {
                                const updatedInventory = inventory.map(item => 
                                  item.title === error.title 
                                    ? { 
                                        ...item, 
                                        lastPrice: item.currentPrice,
                                        currentPrice: parseFloat(newPrice)
                                      }
                                    : item
                                );
                                setInventory(updatedInventory);
                                saveInventory(updatedInventory);
                                alert(`Updated "${error.title}" to $${newPrice} CAD with price change tracking`);
                              }
                            } catch (err) {
                              alert(`Error updating price: ${err.message}`);
                            }
                          }}
                          style={{
                            ...styles.buttonSecondary,
                            fontSize: '12px',
                            padding: '4px 8px',
                            marginTop: '4px',
                            marginLeft: '8px',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            borderColor: '#bbf7d0'
                          }}
                        >
                          📈 Update from PriceCharting
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {updateErrors.length > 5 && (
                  <div>• ... and {updateErrors.length - 5} more errors</div>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={styles.controls}>
            <div style={styles.controlsRow}>
              <div style={styles.searchContainer}>
                <Search size={16} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
              <select
                value={selectedConsole}
                onChange={(e) => setSelectedConsole(e.target.value)}
                style={styles.select}
              >
                <option value="All">All Consoles</option>
                {consoles.map(console => (
                  <option key={console} value={console}>{console}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAddForm(true)}
                style={styles.buttonGreen}
              >
                <Plus size={16} />
                Add Game
              </button>
            </div>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div style={styles.card}>
            <h2 style={{fontSize: '20px', fontWeight: '600', marginBottom: '16px'}}>
              {editingItem ? 'Edit Game' : 'Add New Game'}
            </h2>
            <div style={styles.formGrid}>
              <input
                type="text"
                placeholder="Console (e.g., NES, SNES)"
                value={formData.console}
                onChange={(e) => setFormData({...formData, console: e.target.value})}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Game Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                style={styles.input}
              />
              <input
                type="number"
                placeholder="Quantity"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                style={styles.input}
              />
              <select
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
                style={styles.input}
              >
                <option value="Cart Only">Cart Only</option>
                <option value="Complete in Box">Complete in Box</option>
                <option value="New/Sealed">New/Sealed</option>
                <option value="Loose">Loose</option>
              </select>
            </div>
            <div style={{display: 'flex', gap: '8px'}}>
              <button
                onClick={handleSubmit}
                style={styles.button}
              >
                {editingItem ? 'Update' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                  setFormData({ console: '', title: '', quantity: 1, condition: 'Cart Only' });
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Inventory Display */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
          {Object.entries(groupedInventory).map(([consoleName, games]) => (
            <div key={consoleName} style={{...styles.card, padding: 0, overflow: 'hidden'}}>
              <h2 style={styles.consoleHeader}>{consoleName}</h2>
              <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>Game Title</th>
                      <th style={styles.tableHeader}>Condition</th>
                      <th style={styles.tableHeader}>Quantity</th>
                      <th style={styles.tableHeader}>Price (CAD)</th>
                      <th style={styles.tableHeader}>Total Value</th>
                      <th style={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <tr key={game.id} style={styles.tableRow}
                          onMouseEnter={(e) => e.target.parentElement.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.target.parentElement.style.backgroundColor = 'white'}>
                        <td style={styles.tableCell}>
                          <div style={{fontWeight: '500'}}>{game.title}</div>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={styles.conditionBadge}>
                            {game.condition}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          {game.quantity}
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{
                            fontWeight: '500',
                            color: getPriceChangeColor(game.currentPrice, game.lastPrice)
                          }}>
                            ${game.currentPrice.toFixed(2)} {getPriceChangeIcon(game.currentPrice, game.lastPrice)}
                          </div>
                          <div style={{fontSize: '12px', color: '#6b7280'}}>
                            Was: ${game.lastPrice.toFixed(2)}
                          </div>
                        </td>
                        <td style={{...styles.tableCell, fontWeight: '500'}}>
                          ${(game.currentPrice * game.quantity).toFixed(2)}
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{display: 'flex'}}>
                            <button
                              onClick={() => handleEdit(game)}
                              style={{...styles.actionButton, color: '#2563eb'}}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(game.id)}
                              style={{...styles.actionButton, color: '#dc2626'}}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {filteredInventory.length === 0 && (
          <div style={{...styles.card, ...styles.emptyState}}>
            <Package size={48} style={{color: '#9ca3af', margin: '0 auto 16px'}} />
            <h3 style={{fontSize: '18px', fontWeight: '500', marginBottom: '8px'}}>No games found</h3>
            <p style={{color: '#6b7280', marginBottom: '16px'}}>
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first game to the inventory'}
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={styles.button}
            >
              Add Your First Game
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        input:focus, select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </div>
  );
};

export default RetroGameInventory;