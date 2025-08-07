// backend/server.js - With enhanced debugging
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const API_TOKEN = '7266e10ff3b667fb944fc578b289faffb0b9c2dc';
const BASE_URL = 'https://www.pricecharting.com/price-guide/download-custom';

// Proxy endpoint for PriceCharting
app.get('/api/pricecharting/:console', async (req, res) => {
  try {
    const { console: consoleName } = req.params;  // Rename to avoid conflict!
    const url = `${BASE_URL}?t=${API_TOKEN}&category=${consoleName}-games`;
    
    console.log(`\n🔍 === NEW REQUEST ===`);
    console.log(`📱 Console requested: ${consoleName}`);
    console.log(`🌐 Full URL: ${url}`);
    console.log(`🔑 API Token: ${API_TOKEN ? 'Present' : 'MISSING!'}`);
    
    console.log(`⏳ Making request to PriceCharting...`);
    const response = await fetch(url);
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📋 Response headers:`, response.headers.raw());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ PriceCharting API error:`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Status Text: ${response.statusText}`);
      console.error(`   Error Body: ${errorText}`);
      
      return res.status(500).json({ 
        error: `PriceCharting API error: ${response.status}`,
        message: errorText,
        url: url
      });
    }
    
    const csvData = await response.text();
    
    console.log(`✅ Success! Received ${csvData.length} characters of CSV data`);
    console.log(`📄 First 200 characters:`, csvData.substring(0, 200) + '...');
    
    // Set correct content type for CSV
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
    
    console.log(`📤 Sent CSV data to React app`);
    
  } catch (error) {
    console.error(`💥 Backend error:`, error);
    console.error(`🔍 Error details:`, {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Backend server error',
      message: error.message,
      type: error.name
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend proxy is running!',
    nodeVersion: process.version,
    apiToken: API_TOKEN ? 'Present' : 'MISSING',
    baseUrl: BASE_URL
  });
});

// Test endpoint to check PriceCharting directly
app.get('/api/test/:console', async (req, res) => {
  try {
    const { console: consoleName } = req.params;  // Fix naming conflict here too
    const url = `${BASE_URL}?t=${API_TOKEN}&category=${consoleName}-games`;
    
    console.log(`🧪 TEST REQUEST for ${consoleName}`);
    console.log(`🌐 Testing URL: ${url}`);
    
    const response = await fetch(url);
    
    res.json({
      console: consoleName,
      url: url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers.raw(),
      ok: response.ok
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      type: error.name
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend proxy server running on http://localhost:${PORT}`);
  console.log(`📊 PriceCharting proxy: http://localhost:${PORT}/api/pricecharting/[console]`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test/nes`);
  console.log(`🔧 Node.js version: ${process.version}`);
  console.log(`🔑 API Token: ${API_TOKEN ? 'Loaded' : 'MISSING!'}`);
  console.log(`\n⚡ Ready to proxy requests!\n`);
});