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
  
  // Process each console that YOU have games for
  for (const [consoleId, consoleGames] of Object.entries(gamesByConsole)) {
    try {
      console.log(`\n🔍 Fetching data for YOUR ${consoleGames.length} ${consoleId.toUpperCase()} games:`);
      consoleGames.forEach(game => console.log(`   - ${game.title}`));
      
      // Determine API base URL based on environment
      const API_BASE = process.env.NODE_ENV === 'production' 
        ? '' // Use same domain in production
        : 'http://localhost:3001';
      
      const url = `${API_BASE}/api/pricecharting/${consoleId}`;
      
      console.log(`🌐 Fetching from: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
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
        const loosePrice = game['loose-price'] || '$0';
        const cleanPrice = loosePrice.replace(/[$,]/g, '');
        const priceUSD = parseFloat(cleanPrice) || 0;
        const priceCAD = priceUSD * exchangeRate;
        
        console.log(`💰 ${game['product-name']}: ${priceUSD} USD → ${priceCAD.toFixed(2)} CAD`);
        
        return {
          ...game,
          'price-usd': priceUSD,
          'price-cad': priceCAD
        };
      });
      
      // Match each of YOUR games with the price data
      for (const game of consoleGames) {
        try {
          const gameData = processedGames.find(pg => 
            pg['product-name'] && 
            pg['product-name'].toLowerCase() === game.title.toLowerCase()
          );
          
          if (gameData) {
            results.push({
              id: game.id,
              console: game.console,
              title: game.title,
              condition: game.condition,
              price_cad: gameData['price-cad'],
              exchange_rate: exchangeRate
            });
            console.log(`✅ Successfully updated price for: ${game.title}`);
          } else {
            console.warn(`❌ "${game.title}" not found in PriceCharting ${game.console} data`);
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

  const [formData, setFormData] = useState({
    console: '',
    title: '',
    quantity: 1,
    condition: 'Cart Only'
  });

  // Save to localStorage
  const saveInventory = (inventoryData) => {
    try {
      localStorage.setItem('retro-game-inventory', JSON.stringify(inventoryData));
      localStorage.setItem('inventory-last-updated', new Date().toISOString());
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
      
      if (saved) {
        return {
          inventory: JSON.parse(saved),
          lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
          exchangeRate: savedRate ? parseFloat(savedRate) : 1.35,
          exchangeRateDate: savedRateDate || null
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
          return {
            ...item,
            lastPrice: item.currentPrice,
            currentPrice: priceUpdate.price_cad
          };
        } else {
          // Keep existing price if update failed
          console.warn(`No price update found for: ${item.title} (${item.console})`);
          return item;
        }
      });
      
      setInventory(updatedInventory);
      saveInventory(updatedInventory);
      setLastUpdated(new Date());
      
      // Set errors for display
      if (errors.length > 0) {
        setUpdateErrors(errors);
        console.warn('Price update completed with errors:', errors);
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
                  <div key={index}>• {error.title}: {error.error}</div>
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