// pages/api/debug-scrape.js - Debug version to inspect HTML structure
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { url, site } = req.body;
    
    if (!url || !site) {
      return res.status(400).json({ error: 'URL and site name required' });
    }

    try {
      console.log(`🔍 Debugging ${site}: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      
      // Debug info
      const debugInfo = {
        statusCode: response.status,
        contentLength: response.data.length,
        title: $('title').text(),
        hasContent: response.data.length > 1000,
        
        // Look for common event-related classes and IDs
        potentialEventSelectors: [],
        sampleText: response.data.substring(0, 500),
        
        // Check for common patterns
        eventClasses: [],
        showClasses: [],
        concertClasses: [],
        dateClasses: [],
        venueClasses: [],
        artistClasses: []
      };

      // Find potential event containers
      const commonEventSelectors = [
        '.event', '.show', '.concert', '.listing', '.item',
        '[class*="event"]', '[class*="show"]', '[class*="concert"]',
        '[class*="listing"]', '[class*="item"]'
      ];

      commonEventSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          debugInfo.potentialEventSelectors.push({
            selector,
            count: elements.length,
            sampleClasses: elements.first().attr('class'),
            sampleText: elements.first().text().substring(0, 100)
          });
        }
      });

      // Collect all classes that might be event-related
      $('[class*="event"], [class*="Event"]').each((i, el) => {
        const classes = $(el).attr('class');
        if (classes) debugInfo.eventClasses.push(classes);
      });

      $('[class*="show"], [class*="Show"]').each((i, el) => {
        const classes = $(el).attr('class');
        if (classes) debugInfo.showClasses.push(classes);
      });

      $('[class*="concert"], [class*="Concert"]').each((i, el) => {
        const classes = $(el).attr('class');
        if (classes) debugInfo.concertClasses.push(classes);
      });

      $('[class*="date"], [class*="Date"]').each((i, el) => {
        const classes = $(el).attr('class');
        if (classes) debugInfo.dateClasses.push(classes);
      });

      // Remove duplicates
      debugInfo.eventClasses = [...new Set(debugInfo.eventClasses)];
      debugInfo.showClasses = [...new Set(debugInfo.showClasses)];
      debugInfo.concertClasses = [...new Set(debugInfo.concertClasses)];
      debugInfo.dateClasses = [...new Set(debugInfo.dateClasses)];

      console.log(`📊 Debug results for ${site}:`, debugInfo);

      res.status(200).json({
        success: true,
        site,
        url,
        debug: debugInfo
      });

    } catch (error) {
      console.error(`❌ Error debugging ${site}:`, error.message);
      res.status(500).json({
        success: false,
        site,
        url,
        error: error.message,
        details: {
          code: error.code,
          response: error.response?.status,
          message: error.message
        }
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}