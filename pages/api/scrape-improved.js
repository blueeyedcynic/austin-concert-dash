// pages/api/scrape-improved.js - Fixed version
import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'concerts.json');

const FAVORITE_VENUES = [
  "Emo's Austin",
  "ACL Live at The Moody Theater", 
  "Scoot Inn"
];

// Enhanced request headers to avoid being blocked
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

function createConcertId(artist, venue, date) {
  const cleanStr = `${artist}-${venue}-${date}`.replace(/[^a-zA-Z0-9]/g, '');
  return cleanStr.substring(0, 16) + Date.now().toString().slice(-4);
}

function parseDate(dateString) {
  if (!dateString) return getDefaultDate();
  
  const cleanDate = dateString.trim().replace(/[^\w\s\d\/\-\.,]/g, '');
  console.log(`Parsing date: "${dateString}" -> "${cleanDate}"`);
  
  // Try multiple parsing strategies
  const strategies = [
    // Standard formats
    () => {
      const match = cleanDate.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(year, month - 1, day);
      }
    },
    // Month name formats
    () => {
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime()) && date > new Date()) return date;
    },
    // Relative dates
    () => {
      const lower = cleanDate.toLowerCase();
      const today = new Date();
      
      if (lower.includes('today')) return today;
      if (lower.includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
      }
      if (lower.includes('weekend') || lower.includes('saturday')) {
        const nextSat = new Date(today);
        nextSat.setDate(today.getDate() + (6 - today.getDay()));
        return nextSat;
      }
    }
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result && !isNaN(result.getTime()) && result > new Date()) {
        return result.toISOString().split('T')[0];
      }
    } catch (e) {
      continue;
    }
  }

  return getDefaultDate();
}

function getDefaultDate() {
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString().split('T')[0];
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
}

// Generic scraper that tries multiple selector strategies
async function genericScraper(url, venueName = null, siteName = '') {
  console.log(`🔍 Scraping ${siteName}: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
      maxRedirects: 5
    });

    console.log(`✅ Successfully fetched ${siteName} (${response.data.length} chars)`);
    
    const $ = cheerio.load(response.data);
    const concerts = [];

    // Strategy 1: Look for common event container patterns
    const eventSelectors = [
      '.event-item', '.show-item', '.concert-item', '.listing-item',
      '.event', '.show', '.concert', '.listing',
      '[class*="event-"]', '[class*="show-"]', '[class*="concert-"]',
      '.calendar-event', '.upcoming-show', '.event-listing',
      'article', '.post', '.entry'
    ];

    let foundElements = 0;
    
    for (const selector of eventSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`📍 Found ${elements.length} elements with selector: ${selector}`);
        foundElements += elements.length;
        
        elements.each((i, element) => {
          try {
            const $el = $(element);
            
            // Multiple strategies for finding artist name
            const artistSelectors = [
              '.artist-name', '.headline', '.artist', '.performer', '.band',
              '.event-title', '.title', '.name', 'h1', 'h2', 'h3', 'h4',
              '[class*="artist"]', '[class*="headline"]', '[class*="title"]',
              '[class*="name"]', '[class*="performer"]'
            ];
            
            let artist = '';
            for (const artSelector of artistSelectors) {
              const found = $el.find(artSelector).first().text().trim();
              if (found && found.length > 2) {
                artist = cleanText(found);
                break;
              }
            }
            
            // Multiple strategies for finding venue (if not provided)
            let venue = venueName;
            if (!venue) {
              const venueSelectors = [
                '.venue-name', '.venue', '.location', '.place',
                '[class*="venue"]', '[class*="location"]', '[class*="place"]'
              ];
              
              for (const venSelector of venueSelectors) {
                const found = $el.find(venSelector).first().text().trim();
                if (found && found.length > 2) {
                  venue = cleanText(found);
                  break;
                }
              }
            }
            
            // Multiple strategies for finding date
            const dateSelectors = [
              '.date', '.event-date', '.show-date', '.when',
              '[class*="date"]', '[class*="when"]', '[class*="time"]',
              '.datetime', '.schedule'
            ];
            
            let dateText = '';
            for (const dateSelector of dateSelectors) {
              const found = $el.find(dateSelector).first().text().trim();
              if (found) {
                dateText = found;
                break;
              }
            }
            
            // Multiple strategies for finding time
            const timeSelectors = [
              '.time', '.show-time', '.start-time', '.doors',
              '[class*="time"]', '.schedule'
            ];
            
            let timeText = '';
            for (const timeSelector of timeSelectors) {
              const found = $el.find(timeSelector).first().text().trim();
              if (found && found.includes(':')) {
                timeText = cleanText(found);
                break;
              }
            }
            
            // Multiple strategies for finding price
            const priceSelectors = [
              '.price', '.cost', '.ticket-price', '.admission',
              '[class*="price"]', '[class*="cost"]', '[class*="ticket"]'
            ];
            
            let priceText = '';
            for (const priceSelector of priceSelectors) {
              const found = $el.find(priceSelector).first().text().trim();
              if (found && (found.includes('$') || found.includes('free'))) {
                priceText = cleanText(found);
                break;
              }
            }
            
            // Only add if we have minimum required data
            if (artist && artist.length > 2 && (!venueName || venue)) {
              const concert = {
                id: createConcertId(artist, venue || 'Unknown Venue', dateText),
                artist: artist,
                venue: venue || 'Unknown Venue',
                date: parseDate(dateText),
                time: timeText || 'TBD',
                price: priceText || 'TBD',
                genre: 'Live Music',
                isFavoriteVenue: FAVORITE_VENUES.includes(venue),
                source: siteName,
                debug: {
                  originalDateText: dateText,
                  selector: selector,
                  elementIndex: i
                }
              };
              
              concerts.push(concert);
              console.log(`🎵 Found: ${artist} at ${venue} on ${concert.date}`);
            }
          } catch (itemError) {
            console.log(`⚠️ Error parsing item ${i}:`, itemError.message);
          }
        });
        
        // If we found concerts with this selector, we can break
        if (concerts.length > 0) break;
      }
    }
    
    console.log(`🎯 ${siteName}: Found ${concerts.length} concerts from ${foundElements} total elements`);
    return concerts;
    
  } catch (error) {
    console.error(`❌ Error scraping ${siteName}:`, error.message);
    return [];
  }
}

// Specific venue scrapers using the generic function
async function scrapeEmos() {
  return await genericScraper(
    "https://www.emosaustin.com/shows", 
    "Emo's Austin", 
    "Emo's Austin"
  );
}

async function scrapeACLLive() {
  return await genericScraper(
    "https://www.acllive.com/events/", 
    "ACL Live at The Moody Theater", 
    "ACL Live"
  );
}

async function scrapeScootInn() {
  return await genericScraper(
    "https://www.scootinnaustin.com/shows", 
    "Scoot Inn", 
    "Scoot Inn"
  );
}

// General site scrapers
async function scrapeDo512() {
  return await genericScraper(
    "https://do512.com/events/live-music/", 
    null, 
    "Do512"
  );
}

async function scrapeAustinTexas() {
  return await genericScraper(
    "https://www.austintexas.org/music-scene/concerts-in-austin/", 
    null, 
    "Austin Texas"
  );
}

// Main scraping orchestrator
async function scrapeAllSources() {
  const allConcerts = [];
  const scrapeResults = {
    successful: [],
    failed: [],
    totalConcerts: 0
  };

  console.log('🎵 Starting enhanced Austin concert scraping...');
  
  const scrapers = [
    { name: "Emo's Austin", scraper: scrapeEmos, type: 'venue' },
    { name: "ACL Live", scraper: scrapeACLLive, type: 'venue' },
    { name: "Scoot Inn", scraper: scrapeScootInn, type: 'venue' },
    { name: "Do512", scraper: scrapeDo512, type: 'general' },
    { name: "Austin Texas", scraper: scrapeAustinTexas, type: 'general' }
  ];
  
  for (const { name, scraper, type } of scrapers) {
    try {
      console.log(`\n🔄 Scraping ${name}...`);
      const concerts = await scraper();
      allConcerts.push(...concerts);
      
      scrapeResults.successful.push({
        source: name,
        count: concerts.length,
        type: type
      });
      
      console.log(`✅ ${name}: ${concerts.length} concerts found`);
      
      // Be respectful - wait between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${name}:`, error.message);
      scrapeResults.failed.push({
        source: name,
        error: error.message,
        type: type
      });
    }
  }
  
  // Remove duplicates
  const uniqueConcerts = [];
  const seen = new Set();
  
  for (const concert of allConcerts) {
    const key = `${concert.artist.toLowerCase()}-${concert.venue.toLowerCase()}-${concert.date}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueConcerts.push(concert);
    } else {
      console.log(`🔄 Duplicate removed: ${concert.artist} at ${concert.venue}`);
    }
  }
  
  scrapeResults.totalConcerts = uniqueConcerts.length;
  console.log(`\n🎯 FINAL RESULTS: ${uniqueConcerts.length} unique concerts from ${scrapeResults.successful.length} successful sources`);
  
  return { concerts: uniqueConcerts, results: scrapeResults };
}

// API endpoint
export default async function handler(req, res) {
  // Add proper error handling and CORS
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: `Method ${req.method} Not Allowed` 
    });
  }

  try {
    console.log('\n🚀 Starting enhanced concert scraping process...');
    const { concerts, results } = await scrapeAllSources();
    
    // Ensure data directory exists
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Save to JSON file
    const dataToSave = {
      concerts,
      lastUpdated: new Date().toISOString(),
      totalConcerts: concerts.length,
      scrapeResults: results
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    
    console.log(`\n✅ SCRAPING COMPLETED! Saved ${concerts.length} concerts to file`);
    
    return res.status(200).json({ 
      success: true, 
      concertsFound: concerts.length,
      message: 'Enhanced scraping completed successfully',
      results: results,
      summary: {
        totalSources: results.successful.length + results.failed.length,
        successfulSources: results.successful.length,
        failedSources: results.failed.length,
        concertsPerSource: results.successful.map(s => `${s.source}: ${s.count}`)
      }
    });
  } catch (error) {
    console.error('\n❌ SCRAPING ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Enhanced scraping failed'
    });
  }
}