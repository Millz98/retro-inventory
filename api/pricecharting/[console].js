// api/pricecharting/[console].js
import fetch from 'node-fetch';

const API_TOKEN = process.env.PRICECHARTING_API_TOKEN || '7266e10ff3b667fb944fc578b289faffb0b9c2dc';
const BASE_URL = 'https://www.pricecharting.com/price-guide/download-custom';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { console: consoleName } = req.query;
    
    if (!consoleName) {
      res.status(400).json({ error: 'Console parameter is required' });
      return;
    }
    
    const url = `${BASE_URL}?t=${API_TOKEN}&category=${consoleName}-games`;
    
    console.log(`Fetching data for console: ${consoleName}`);
    console.log(`URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`PriceCharting API error: ${response.status} ${response.statusText}`);
      res.status(500).json({ 
        error: `PriceCharting API error: ${response.status}`,
        message: response.statusText 
      });
      return;
    }
    
    const csvData = await response.text();
    
    console.log(`Successfully fetched ${csvData.length} characters of CSV data`);
    
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).send(csvData);
    
  } catch (error) {
    console.error('Error fetching PriceCharting data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PriceCharting data',
      message: error.message 
    });
  }
}