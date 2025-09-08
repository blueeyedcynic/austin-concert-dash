// pages/api/scrape.js - Complete scraping implementation
import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'concerts.json');

// Updated favorite venues
const FAVORITE_VENUES = [
  "Emo's Austin",
  "ACL Live at The Moody Theater", 
  "Scoot Inn"
];

// Venue-specific scrapers
const VENUE_SCRAPERS = {
  "Emo's Austin": {
    url: "https://www.emosaustin.com/shows",
    scraper: scrapeEmos
  },
  "ACL Live at The Moody Theater": {
    url: "https://www.acllive.com/events/",
    scraper: scrapeACLLive
  },
  "Scoot Inn": {
    url: "https://www.scootinnaustin.com/shows",
    scraper: scrapeScootInn
  }
};

// General concert listing scrapers
const GENERAL_SCRAPERS = [
  {
    name: "Do512",
    url: "https://do512.com/events/live-music/",
    scraper: scrapeDo512
  },
  {
    name: "Austin Texas",
    url: "https://www.austintexas.org/music-scene/concerts-in-austin/",
    scraper: scrapeAustinTexas
  }
];

// Utility functions
function createConcertId(artist, venue, date) {
  return btoa(`${artist}-${venue}-${date}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

function parseDate(dateString) {
  // Handle various date formats
  const cleanDate = dateString.trim().replace(/[^\w\s\d\/\-\.]/g, '');
  
  // Try different date parsing strategies
  const strategies = [
    // MM/DD/YYYY or MM-DD-YYYY
    () => {
      const match = cleanDate.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(year, month - 1, day);
      }
    },
    // Month Day, Year (e.g., "September 12, 2025")
    () => {
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) return date;
    },
    // Relative dates (today, tomorrow, this weekend)
    () => {
      const lower = cleanDate.toLowerCase();
      const today = new Date();
      
      if (lower.includes('today')) {
        return today;
      } else if (lower.includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
      } else if (lower.includes('this weekend') || lower.includes('saturday') || lower.includes('sunday')) {
        // Return next Saturday as default
        const nextSaturday = new Date(today);
        nextSaturday.setDate(today.getDate() + (6 - today.getDay()));
        return nextSaturday;
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

  // Fallback to a week from now
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString().split('T')[0];
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Emo's Austin scraper
async function scrapeEmos() {
  try {
    const response = await axios.get("https://www.emosaustin.com/shows", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    // Emo's likely uses a show listing structure
    $('.show-item, .event-item, .concert-listing, [class*="show"], [class*="event"]').each((i, element) => {
      try {
        const $el = $(element);
        
        // Try multiple selectors for artist name
        const artist = cleanText(
          $el.find('.artist-name, .headline, .artist, h1, h2, h3, .title').first().text() ||
          $el.find('[class*="artist"], [class*="headline"], [class*="title"]').first().text()
        );
        
        // Try multiple selectors for date
        const dateText = cleanText(
          $el.find('.date, .show-date, .event-date, [class*="date"]').first().text()
        );
        
        // Try multiple selectors for time
        const timeText = cleanText(
          $el.find('.time, .show-time, .doors, [class*="time"]').first().text() || 
          $el.find('.start-time, .door-time').first().text()
        );
        
        // Try multiple selectors for price
        const priceText = cleanText(
          $el.find('.price, .cost, .ticket-price, [class*="price"]').first().text()
        );
        
        if (artist && artist.length > 2) {
          const concert = {
            id: createConcertId(artist, "Emo's Austin", dateText),
            artist: artist,
            venue: "Emo's Austin",
            date: parseDate(dateText),
            time: timeText || 'TBD',
            price: priceText || 'TBD',
            genre: 'Live Music',
            isFavoriteVenue: true,
            source: 'Emo\'s Austin'
          };
          concerts.push(concert);
        }
      } catch (error) {
        console.log(`Error parsing Emo's item ${i}:`, error.message);
      }
    });
    
    console.log(`Scraped ${concerts.length} concerts from Emo's Austin`);
    return concerts;
  } catch (error) {
    console.error('Error scraping Emo\'s Austin:', error.message);
    return [];
  }
}

// ACL Live scraper
async function scrapeACLLive() {
  try {
    const response = await axios.get("https://www.acllive.com/events/", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    $('.event-item, .show-listing, .concert-item, [class*="event"], [class*="show"]').each((i, element) => {
      try {
        const $el = $(element);
        
        const artist = cleanText(
          $el.find('.artist-name, .headline, .event-title, h1, h2, h3').first().text() ||
          $el.find('[class*="artist"], [class*="headline"], [class*="title"]').first().text()
        );
        
        const dateText = cleanText(
          $el.find('.date, .event-date, .show-date, [class*="date"]').first().text()
        );
        
        const timeText = cleanText(
          $el.find('.time, .show-time, .event-time, [class*="time"]').first().text()
        );
        
        const priceText = cleanText(
          $el.find('.price, .ticket-price, .cost, [class*="price"]').first().text()
        );
        
        if (artist && artist.length > 2) {
          const concert = {
            id: createConcertId(artist, "ACL Live at The Moody Theater", dateText),
            artist: artist,
            venue: "ACL Live at The Moody Theater",
            date: parseDate(dateText),
            time: timeText || 'TBD',
            price: priceText || 'TBD',
            genre: 'Live Music',
            isFavoriteVenue: true,
            source: 'ACL Live'
          };
          concerts.push(concert);
        }
      } catch (error) {
        console.log(`Error parsing ACL Live item ${i}:`, error.message);
      }
    });
    
    console.log(`Scraped ${concerts.length} concerts from ACL Live`);
    return concerts;
  } catch (error) {
    console.error('Error scraping ACL Live:', error.message);
    return [];
  }
}

// Scoot Inn scraper
async function scrapeScootInn() {
  try {
    const response = await axios.get("https://www.scootinnaustin.com/shows", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    $('.show-item, .event-listing, .concert-item, [class*="show"], [class*="event"]').each((i, element) => {
      try {
        const $el = $(element);
        
        const artist = cleanText(
          $el.find('.artist-name, .headline, .band-name, h1, h2, h3').first().text() ||
          $el.find('[class*="artist"], [class*="band"], [class*="headline"]').first().text()
        );
        
        const dateText = cleanText(
          $el.find('.date, .show-date, .event-date, [class*="date"]').first().text()
        );
        
        const timeText = cleanText(
          $el.find('.time, .show-time, .doors, [class*="time"]').first().text()
        );
        
        const priceText = cleanText(
          $el.find('.price, .cover, .admission, [class*="price"]').first().text()
        );
        
        if (artist && artist.length > 2) {
          const concert = {
            id: createConcertId(artist, "Scoot Inn", dateText),
            artist: artist,
            venue: "Scoot Inn",
            date: parseDate(dateText),
            time: timeText || 'TBD',
            price: priceText || 'TBD',
            genre: 'Live Music',
            isFavoriteVenue: true,
            source: 'Scoot Inn'
          };
          concerts.push(concert);
        }
      } catch (error) {
        console.log(`Error parsing Scoot Inn item ${i}:`, error.message);
      }
    });
    
    console.log(`Scraped ${concerts.length} concerts from Scoot Inn`);
    return concerts;
  } catch (error) {
    console.error('Error scraping Scoot Inn:', error.message);
    return [];
  }
}

// Do512 scraper
async function scrapeDo512() {
  try {
    const response = await axios.get("https://do512.com/events/live-music/", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    $('.event-item, .event-listing, .show-item, [class*="event"]').each((i, element) => {
      try {
        const $el = $(element);
        
        const artist = cleanText(
          $el.find('.event-title, .artist-name, .headline, h1, h2, h3').first().text() ||
          $el.find('[class*="title"], [class*="artist"], [class*="headline"]').first().text()
        );
        
        const venue = cleanText(
          $el.find('.venue-name, .location, .venue, [class*="venue"]').first().text()
        );
        
        const dateText = cleanText(
          $el.find('.date, .event-date, .show-date, [class*="date"]').first().text()
        );
        
        const timeText = cleanText(
          $el.find('.time, .show-time, .event-time, [class*="time"]').first().text()
        );
        
        const priceText = cleanText(
          $el.find('.price, .ticket-price, .cost, [class*="price"]').first().text()
        );
        
        if (artist && venue && artist.length > 2 && venue.length > 2) {
          const concert = {
            id: createConcertId(artist, venue, dateText),
            artist: artist,
            venue: venue,
            date: parseDate(dateText),
            time: timeText || 'TBD',
            price: priceText || 'TBD',
            genre: 'Live Music',
            isFavoriteVenue: FAVORITE_VENUES.includes(venue),
            source: 'Do512'
          };
          concerts.push(concert);
        }
      } catch (error) {
        console.log(`Error parsing Do512 item ${i}:`, error.message);
      }
    });
    
    console.log(`Scraped ${concerts.length} concerts from Do512`);
    return concerts;
  } catch (error) {
    console.error('Error scraping Do512:', error.message);
    return [];
  }
}

// Austin Texas scraper
async function scrapeAustinTexas() {
  try {
    const response = await axios.get("https://www.austintexas.org/music-scene/concerts-in-austin/", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    $('.event-item, .concert-listing, .show-item, [class*="event"], [class*="concert"]').each((i, element) => {
      try {
        const $el = $(element);
        
        const artist = cleanText(
          $el.find('.event-title, .artist-name, .concert-title, h1, h2, h3').first().text() ||
          $el.find('[class*="title"], [class*="artist"], [class*="name"]').first().text()
        );
        
        const venue = cleanText(
          $el.find('.venue-name, .location, .venue, [class*="venue"], [class*="location"]').first().text()
        );
        
        const dateText = cleanText(
          $el.find('.date, .event-date, .concert-date, [class*="date"]').first().text()
        );
        
        const timeText = cleanText(
          $el.find('.time, .show-time, .event-time, [class*="time"]').first().text()
        );
        
        const priceText = cleanText(
          $el.find('.price, .ticket-price, .admission, [class*="price"]').first().text()
        );
        
        if (artist && venue && artist.length > 2 && venue.length > 2) {
          const concert = {
            id: createConcertId(artist, venue, dateText),
            artist: artist,
            venue: venue,
            date: parseDate(dateText),
            time: timeText || 'TBD',
            price: priceText || 'TBD',
            genre: 'Live Music',
            isFavoriteVenue: FAVORITE_VENUES.includes(venue),
            source: 'Austin Texas'
          };
          concerts.push(concert);
        }
      } catch (error) {
        console.log(`Error parsing Austin Texas item ${i}:`, error.message);
      }
    });
    
    console.log(`Scraped ${concerts.length} concerts from Austin Texas`);
    return concerts;
  } catch (error) {
    console.error('Error scraping Austin Texas:', error.message);
    return [];
  }
}

// Main scraping function
async function scrapeAllSources() {
  const allConcerts = [];
  const scrapeResults = {
    successful: [],
    failed: [],
    totalConcerts: 0
  };

  console.log('🎵 Starting Austin concert scraping...');
  
  // Scrape favorite venues
  console.log('📍 Scraping favorite venues...');
  for (const [venueName, config] of Object.entries(VENUE_SCRAPERS)) {
    try {
      console.log(`Scraping ${venueName}...`);
      const concerts = await config.scraper();
      allConcerts.push(...concerts);
      scrapeResults.successful.push({
        source: venueName,
        count: concerts.length,
        type: 'venue'
      });
      
      // Be respectful - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape ${venueName}:`, error.message);
      scrapeResults.failed.push({
        source: venueName,
        error: error.message,
        type: 'venue'
      });
    }
  }
  
  // Scrape general sources
  console.log('🌐 Scraping general concert listings...');
  for (const config of GENERAL_SCRAPERS) {
    try {
      console.log(`Scraping ${config.name}...`);
      const concerts = await config.scraper();
      allConcerts.push(...concerts);
      scrapeResults.successful.push({
        source: config.name,
        count: concerts.length,
        type: 'general'
      });
      
      // Be respectful - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape ${config.name}:`, error.message);
      scrapeResults.failed.push({
        source: config.name,
        error: error.message,
        type: 'general'
      });
    }
  }
  
  // Remove duplicates based on artist + venue + date
  const uniqueConcerts = [];
  const seen = new Set();
  
  for (const concert of allConcerts) {
    const key = `${concert.artist}-${concert.venue}-${concert.date}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueConcerts.push(concert);
    }
  }
  
  scrapeResults.totalConcerts = uniqueConcerts.length;
  console.log(`🎯 Found ${uniqueConcerts.length} unique concerts from ${scrapeResults.successful.length} successful sources`);
  
  return { concerts: uniqueConcerts, results: scrapeResults };
}

// API endpoint
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      console.log('🚀 Starting concert scraping process...');
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
      
      console.log(`✅ Scraping completed! Found ${concerts.length} concerts`);
      
      res.status(200).json({ 
        success: true, 
        concertsFound: concerts.length,
        message: 'Scraping completed successfully',
        results: results
      });
    } catch (error) {
      console.error('❌ Scraping error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        message: 'Scraping failed'
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}