// pages/api/scrape-aggregators.js - Focus on reliable aggregator sites
import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'concerts.json');

// Expanded venue list - map various name formats to canonical names
const VENUE_MAPPINGS = {
  // Favorite venues (Ryan's list)
  "Emo's Austin": ["emo's", "emos", "emo's austin", "emos austin"],
  "ACL Live at The Moody Theater": ["acl live", "moody theater", "acl moody", "the moody theater", "moody theatre"],
  "Scoot Inn": ["scoot inn", "the scoot inn"],
  
  // Additional popular Austin venues to track
  "Stubb's Bar-B-Q": ["stubb's", "stubbs", "stubb's bar-b-q", "stubbs bar-b-q"],
  "Antone's Nightclub": ["antone's", "antones", "antone's nightclub"],
  "The Continental Club": ["continental club", "the continental club", "continental"],
  "Saxon Pub": ["saxon pub", "the saxon pub", "saxon"],
  "Cheer Up Charlies": ["cheer up charlies", "cheer up charlie's"],
  "The Far Out": ["the far out", "far out", "far out lounge"],
  "Mohawk": ["mohawk", "the mohawk"],
  "Red River Cultural District": ["red river", "red river district"],
  "Hole in the Wall": ["hole in the wall"],
  "C-Boys Heart & Soul": ["c-boys", "c boys", "c-boys heart & soul"],
  "Paramount Theatre": ["paramount", "paramount theatre", "paramount theater"],
  "The Long Center": ["long center", "the long center"],
  "Zilker Park": ["zilker", "zilker park"],
  "Austin City Limits Music Festival": ["acl", "austin city limits", "acl fest"]
};

const FAVORITE_VENUES = [
  "Emo's Austin",
  "ACL Live at The Moody Theater", 
  "Scoot Inn"
];

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// HELPER FUNCTIONS - DEFINED FIRST
function createConcertId(artist, venue, date) {
  const cleanStr = `${artist}-${venue}-${date}`.replace(/[^a-zA-Z0-9]/g, '');
  return cleanStr.substring(0, 16) + Date.now().toString().slice(-4);
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
}

// Helper function to identify if text is a day name or date
function isDateOrDayName(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^(today|tomorrow)$/i
  ];
  
  // Check if it's a day name
  if (dayNames.includes(lower)) return true;
  
  // Check if it matches date patterns
  for (const pattern of datePatterns) {
    if (pattern.test(lower)) return true;
  }
  
  // Check if it's mostly numbers and date separators
  if (/^[\d\/\-\s]+$/.test(text)) return true;
  
  return false;
}

// Helper function to identify venue indicators
function isVenueIndicator(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const venueKeywords = ['at', '@', 'venue:', 'location:', 'where:'];
  return venueKeywords.some(keyword => lower.startsWith(keyword));
}

// Helper function to identify time indicators
function isTimeIndicator(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  
  // Check for time patterns
  if (/\d{1,2}:\d{2}/.test(text)) return true;
  if (/(am|pm)/i.test(text)) return true;
  if (/^(doors|starts|begins)/i.test(lower)) return true;
  
  return false;
}

function parseDate(dateString, fullText = '') {
  console.log(`🚨 PARSEDATE FUNCTION CALLED WITH: "${dateString}" | Context: "${fullText.substring(0, 50)}"`);
  
  if (!dateString && !fullText) {
    console.log(`No date info provided, using default`);
    return getDefaultDate();
  }
  
  // Combine both date string and full text for parsing
  const textToParse = `${dateString} ${fullText}`.toLowerCase().trim();
  console.log(`Combined text to parse: "${textToParse.substring(0, 100)}"`);
  
  const today = new Date();
  
  // PRIORITY 1: Handle specific date with year (September 25th 2025, Nov 18th 2025, etc.)
  const fullDateRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})/i;
  const fullDateMatch = textToParse.match(fullDateRegex);
  console.log(`🔍 Testing full date regex against: "${textToParse.substring(0, 100)}"`);
  console.log(`🔍 Full date regex result:`, fullDateMatch);
  
  if (fullDateMatch) {
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const monthName = fullDateMatch[1].toLowerCase().substring(0, 3);
    const day = parseInt(fullDateMatch[2]);
    const year = parseInt(fullDateMatch[3]);
    const month = monthMap[monthName];
    
    if (month !== undefined) {
      const date = new Date(year, month, day);
      console.log(`✅ PRIORITY 1: Found full date with year "${fullDateMatch[0]}": ${date.toISOString().split('T')[0]}`);
      return date.toISOString().split('T')[0];
    }
  }
  
  console.log(`❌ Full date regex failed, trying other patterns...`);
  
  // PRIORITY 2: Standard MM/DD/YYYY or MM-DD-YYYY
  const standardMatch = textToParse.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (standardMatch) {
    const [, month, day, year] = standardMatch;
    const date = new Date(year, month - 1, day);
    console.log(`✅ PRIORITY 2: Found standard date: ${date.toISOString().split('T')[0]}`);
    return date.toISOString().split('T')[0];
  }
  
  // Only proceed to day names if no full date was found
  console.log(`🔍 No full dates found, checking day names as last resort...`);
  
  // PRIORITY 5: Day names (Monday, Tuesday, etc.) - LAST RESORT ONLY
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (textToParse.includes(dayNames[i])) {
      const targetDay = new Date(today);
      let daysUntil = (i - today.getDay() + 7) % 7;
      if (daysUntil === 0) {
        daysUntil = 7;
      }
      targetDay.setDate(today.getDate() + daysUntil);
      console.log(`✅ PRIORITY 5 (LAST RESORT): Found day name "${dayNames[i]}": next ${dayNames[i]} is ${targetDay.toISOString().split('T')[0]}`);
      return targetDay.toISOString().split('T')[0];
    }
  }

  console.log(`❌ No date patterns found, using default: ${getDefaultDate()}`);
  return getDefaultDate();
}

function getDefaultDate() {
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString().split('T')[0];
}

// Map venue name variants to canonical names
function mapVenueName(rawVenueName) {
  if (!rawVenueName) return 'Unknown Venue';
  
  const cleanVenue = rawVenueName.toLowerCase().trim();
  
  for (const [canonicalName, variants] of Object.entries(VENUE_MAPPINGS)) {
    if (variants.some(variant => cleanVenue.includes(variant) || variant.includes(cleanVenue))) {
      return canonicalName;
    }
  }
  
  // If no mapping found, return the original name (title case)
  return rawVenueName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// SCRAPER FUNCTIONS

// Enhanced Do512 scraper with correct CSS classes
async function scrapeDo512() {
  console.log('🔍 Scraping Do512...');
  
  try {
    const response = await axios.get("https://do512.com/events/live-music/", {
      headers: REQUEST_HEADERS,
      timeout: 15000
    });

    console.log(`✅ Do512 loaded (${response.data.length} chars)`);
    
    const $ = cheerio.load(response.data);
    const concerts = [];

    // Do512 uses specific CSS classes
    const eventSelector = '.ds-listing.event-card.ds-event-category-live-music';
    const elements = $(eventSelector);
    
    if (elements.length > 0) {
      console.log(`📍 Do512: Found ${elements.length} events`);
      
      elements.each((i, element) => {
        try {
          const $el = $(element);
          
          // Get full text for debugging
          const fullText = cleanText($el.text());
          
          // Extract artist using Do512's specific classes
          let artist = '';
          const artistElement = $el.find('.ds-listing-event-title-text').first();
          if (artistElement.length > 0) {
            artist = cleanText(artistElement.text());
          }
          
          // If no specific artist element, try other selectors
          if (!artist) {
            const fallbackSelectors = ['.ds-byline', '.summary', 'h3', 'h2'];
            for (const selector of fallbackSelectors) {
              const found = cleanText($el.find(selector).first().text());
              if (found && found.length > 2 && !isDateOrDayName(found)) {
                artist = found;
                break;
              }
            }
          }
          
          // Extract venue using Do512's specific classes
          let rawVenue = '';
          const venueElement = $el.find('.ds-venue-name').first();
          if (venueElement.length > 0) {
            rawVenue = cleanText(venueElement.text());
          }
          
          // Extract time from details
          let timeText = '';
          const detailsElement = $el.find('.ds-listing-details').first();
          if (detailsElement.length > 0) {
            const detailsText = cleanText(detailsElement.text());
            const timeMatch = detailsText.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))/);
            if (timeMatch) {
              timeText = timeMatch[1];
            }
          }
          
          // For Do512, since dates are grouped, we'll need to look for "Every Mon" patterns
          // or assume events are for upcoming dates
          let dateText = '';
          
          // Check if it's a recurring event
          if (fullText.toLowerCase().includes('every mon')) {
            dateText = 'Monday';
          } else if (fullText.toLowerCase().includes('every tue')) {
            dateText = 'Tuesday';
          } else if (fullText.toLowerCase().includes('every wed')) {
            dateText = 'Wednesday';
          } else if (fullText.toLowerCase().includes('every thu')) {
            dateText = 'Thursday';
          } else if (fullText.toLowerCase().includes('every fri')) {
            dateText = 'Friday';
          } else if (fullText.toLowerCase().includes('every sat')) {
            dateText = 'Saturday';
          } else if (fullText.toLowerCase().includes('every sun')) {
            dateText = 'Sunday';
          } else {
            // Look for date patterns in the full text or nearby elements
            const datePatterns = [
              /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i,
              /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
              /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/,
              /(today|tomorrow)/i
            ];
            
            for (const pattern of datePatterns) {
              const match = fullText.match(pattern);
              if (match) {
                dateText = match[0];
                break;
              }
            }
            
            // If still no date, check parent elements or previous siblings for date headers
            if (!dateText) {
              const $parent = $el.parent();
              const $prevSibling = $el.prev();
              
              // Check previous elements for date headers
              for (let j = 0; j < 3; j++) {
                const $checkElement = $el.prevAll().eq(j);
                if ($checkElement.length > 0) {
                  const headerText = cleanText($checkElement.text());
                  for (const pattern of datePatterns) {
                    const match = headerText.match(pattern);
                    if (match) {
                      dateText = match[0];
                      break;
                    }
                  }
                  if (dateText) break;
                }
              }
            }
          }
          
          // Extract price
          let priceText = '';
          const priceMatch = fullText.match(/\$\d+(?:\.\d{2})?(?:\s*-\s*\$\d+(?:\.\d{2})?)?/);
          if (priceMatch) {
            priceText = priceMatch[0];
          } else if (fullText.toLowerCase().includes('free')) {
            priceText = 'Free';
          }
          
          // Only create concert if we have valid artist and venue
          if (artist && rawVenue && artist.length > 2 && rawVenue.length > 2 && 
              !isDateOrDayName(artist) && !isDateOrDayName(rawVenue)) {
            const mappedVenue = mapVenueName(rawVenue);
            
            const concert = {
              id: createConcertId(artist, mappedVenue, dateText),
              artist: artist,
              venue: mappedVenue,
              date: parseDate(dateText, fullText),
              time: timeText || 'TBD',
              price: priceText || 'TBD',
              genre: 'Live Music',
              isFavoriteVenue: FAVORITE_VENUES.includes(mappedVenue),
              source: 'Do512',
              debug: {
                originalVenue: rawVenue,
                originalDateText: dateText,
                fullText: fullText.substring(0, 100),
                elementIndex: i
              }
            };
            
            concerts.push(concert);
            console.log(`🎵 Do512: ${artist} at ${mappedVenue} (${rawVenue}) on ${concert.date}`);
          } else {
            console.log(`⚠️ Do512: Filtered out - Artist: "${artist}", Venue: "${rawVenue}"`);
          }
        } catch (itemError) {
          console.log(`⚠️ Do512 parsing error item ${i}:`, itemError.message);
        }
      });
    } else {
      console.log('❌ Do512: No events found with expected selector');
    }
    
    console.log(`🎯 Do512: Found ${concerts.length} concerts`);
    return concerts;
    
  } catch (error) {
    console.error(`❌ Do512 scraping error:`, error.message);
    return [];
  }
}

// Simplified Austin Showlists scraper
async function scrapeAustinShowlists() {
  console.log('🔍 Scraping Austin Showlists...');
  
  try {
    const response = await axios.get("https://austin.showlists.net/", {
      headers: REQUEST_HEADERS,
      timeout: 15000
    });

    console.log(`✅ Austin Showlists loaded (${response.data.length} chars)`);
    
    const $ = cheerio.load(response.data);
    const concerts = [];

    // Try simpler selectors first
    const eventSelectors = [
      'tr', 'li', '.item', '.row', '.listing'
    ];

    let foundElements = 0;
    
    for (const selector of eventSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`📍 Showlists: Found ${elements.length} elements with selector: ${selector}`);
        foundElements += elements.length;
        
        elements.each((i, element) => {
          try {
            const $el = $(element);
            const fullText = cleanText($el.text());
            
            // Skip if too short or doesn't look like event data
            if (fullText.length < 15) return;
            
            // Simple text parsing approach for showlists
            let artist = '';
            let rawVenue = '';
            let dateText = '';
            
            // Look for basic patterns in the text
            const textParts = fullText.split(/[,\n@]/).map(part => part.trim());
            
            // Try to identify artist (usually first substantial text that's not a date)
            for (const part of textParts) {
              if (part.length > 3 && !isDateOrDayName(part) && !isVenueIndicator(part) && !isTimeIndicator(part)) {
                artist = part;
                break;
              }
            }
            
            // Look for venue after "@" or "at"
            const atMatch = fullText.match(/@\s*([^,\n]+)/i) || fullText.match(/\bat\s+([^,\n]+)/i);
            if (atMatch && atMatch[1] && !isDateOrDayName(atMatch[1])) {
              rawVenue = cleanText(atMatch[1]);
            }
            
            // Look for date patterns
            const datePatterns = [
              /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i,
              /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
              /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/,
              /(today|tomorrow)/i
            ];
            
            for (const pattern of datePatterns) {
              const match = fullText.match(pattern);
              if (match) {
                dateText = match[0];
                break;
              }
            }
            
            // Extract time
            let timeText = '';
            const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))/);
            if (timeMatch) {
              timeText = timeMatch[1];
            }
            
            // Extract price
            let priceText = '';
            const priceMatch = fullText.match(/\$\d+(?:\.\d{2})?(?:\s*-\s*\$\d+(?:\.\d{2})?)?/);
            if (priceMatch) {
              priceText = priceMatch[0];
            } else if (fullText.toLowerCase().includes('free')) {
              priceText = 'Free';
            }
            
            // Only create concert if we have valid data
            if (artist && rawVenue && artist.length > 2 && rawVenue.length > 2 &&
                !isDateOrDayName(artist) && !isDateOrDayName(rawVenue)) {
              const mappedVenue = mapVenueName(rawVenue);
              
              const concert = {
                id: createConcertId(artist, mappedVenue, dateText),
                artist: artist,
                venue: mappedVenue,
                date: parseDate(dateText, fullText),
                time: timeText || 'TBD',
                price: priceText || 'TBD',
                genre: 'Live Music',
                isFavoriteVenue: FAVORITE_VENUES.includes(mappedVenue),
                source: 'Austin Showlists',
                debug: {
                  originalVenue: rawVenue,
                  originalDateText: dateText,
                  fullText: fullText.substring(0, 100),
                  selector: selector,
                  elementIndex: i
                }
              };
              
              concerts.push(concert);
              console.log(`🎵 Showlists: ${artist} at ${mappedVenue} (${rawVenue}) on ${concert.date}`);
            }
          } catch (itemError) {
            console.log(`⚠️ Showlists parsing error item ${i}:`, itemError.message);
          }
        });
        
        // Only try first successful selector to avoid too much processing
        if (concerts.length > 5) break;
      }
    }
    
    console.log(`🎯 Showlists: Found ${concerts.length} concerts from ${foundElements} elements`);
    return concerts;
    
  } catch (error) {
    console.error(`❌ Showlists scraping error:`, error.message);
    return [];
  }
}

// Main scraping function focused on Austin Showlists only
async function scrapeAggregators() {
  const allConcerts = [];
  const scrapeResults = {
    successful: [],
    failed: [],
    totalConcerts: 0
  };

  console.log('🎵 Starting Austin Showlists scraping...');
  
  try {
    console.log(`\n🔄 Scraping Austin Showlists...`);
    const concerts = await scrapeAustinShowlistsOnly();
    allConcerts.push(...concerts);
    
    scrapeResults.successful.push({
      source: "Austin Showlists",
      count: concerts.length,
      type: 'aggregator'
    });
    
    console.log(`✅ Austin Showlists: ${concerts.length} concerts found`);
    
  } catch (error) {
    console.error(`❌ Failed to scrape Austin Showlists:`, error.message);
    scrapeResults.failed.push({
      source: "Austin Showlists",
      error: error.message,
      type: 'aggregator'
    });
  }
  
  // Remove duplicates based on artist + venue + date
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
  
  // Sort by date and then by venue
  uniqueConcerts.sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.venue.localeCompare(b.venue);
  });
  
  scrapeResults.totalConcerts = uniqueConcerts.length;
  
  // Log summary by venue
  const venueStats = {};
  uniqueConcerts.forEach(concert => {
    venueStats[concert.venue] = (venueStats[concert.venue] || 0) + 1;
  });
  
  console.log('\n📊 VENUE BREAKDOWN:');
  Object.entries(venueStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([venue, count]) => {
      const isFavorite = FAVORITE_VENUES.includes(venue) ? '⭐' : '';
      console.log(`${isFavorite} ${venue}: ${count} concerts`);
    });
  
  console.log(`\n🎯 FINAL RESULTS: ${uniqueConcerts.length} unique concerts from Austin Showlists`);
  
  return { concerts: uniqueConcerts, results: scrapeResults, venueStats };
}

// Focused Austin Showlists scraper that handles date headers
async function scrapeAustinShowlistsOnly() {
  console.log('🔍 Scraping Austin Showlists with date header parsing...');
  
  try {
    const response = await axios.get("https://austin.showlists.net/", {
      headers: REQUEST_HEADERS,
      timeout: 15000
    });

    console.log(`✅ Austin Showlists loaded (${response.data.length} chars)`);
    
    const $ = cheerio.load(response.data);
    const concerts = [];
    
    let currentDate = '';
    
    // Parse the page looking for date headers followed by event listings
    $('*').each((i, element) => {
      const $el = $(element);
      const text = cleanText($el.text());
      
      // Skip empty elements
      if (!text || text.length < 3) return;
      
      // Check if this element looks like a date header
      const datePatterns = [
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i,
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{4}?/i,
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/
      ];
      
      let isDateHeader = false;
      for (const pattern of datePatterns) {
        if (pattern.test(text.trim())) {
          currentDate = text.trim();
          isDateHeader = true;
          console.log(`📅 Found date header: "${currentDate}"`);
          break;
        }
      }
      
      // If not a date header, check if it looks like an event listing
      if (!isDateHeader && currentDate && text.length > 15) {
        // Look for event patterns: "Artist @ Venue" or "Artist at Venue"
        const eventPatterns = [
          /^(.+?)\s+@\s+(.+)$/,
          /^(.+?)\s+at\s+(.+)$/,
          /^(.+?)\s+-\s+(.+)$/
        ];
        
        for (const pattern of eventPatterns) {
          const match = text.match(pattern);
          if (match) {
            let [, artistPart, venuePart] = match;
            
            // Clean up the parts
            artistPart = cleanText(artistPart);
            venuePart = cleanText(venuePart);
            
            // Filter out obvious non-artist text
            if (artistPart.length > 2 && venuePart.length > 2 &&
                !isDateOrDayName(artistPart) && !isDateOrDayName(venuePart) &&
                !artistPart.toLowerCase().includes('http') &&
                !venuePart.toLowerCase().includes('http')) {
              
              // Extract time and price from the venue part if present
              let timeText = '';
              let priceText = '';
              
              // Look for time patterns
              const timeMatch = venuePart.match(/(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))/);
              if (timeMatch) {
                timeText = timeMatch[1];
                venuePart = venuePart.replace(timeMatch[0], '').trim();
              }
              
              // Look for price patterns
              const priceMatch = venuePart.match(/\$\d+(?:\.\d{2})?(?:\s*-\s*\$\d+(?:\.\d{2})?)?/);
              if (priceMatch) {
                priceText = priceMatch[0];
                venuePart = venuePart.replace(priceMatch[0], '').trim();
              } else if (venuePart.toLowerCase().includes('free')) {
                priceText = 'Free';
                venuePart = venuePart.replace(/free/i, '').trim();
              }
              
              // Clean up venue name
              venuePart = venuePart.replace(/[,\-]+$/, '').trim();
              
              const mappedVenue = mapVenueName(venuePart);
              
              const concert = {
                id: createConcertId(artistPart, mappedVenue, currentDate),
                artist: artistPart,
                venue: mappedVenue,
                date: parseDate(currentDate, text),
                time: timeText || 'TBD',
                price: priceText || 'TBD',
                genre: 'Live Music',
                isFavoriteVenue: FAVORITE_VENUES.includes(mappedVenue),
                source: 'Austin Showlists',
                debug: {
                  originalVenue: venuePart,
                  originalDateText: currentDate,
                  fullText: text.substring(0, 100),
                  pattern: pattern.toString()
                }
              };
              
              concerts.push(concert);
              console.log(`🎵 Showlists: ${artistPart} at ${mappedVenue} (${venuePart}) on ${concert.date}`);
              break;
            }
          }
        }
      }
    });
    
    console.log(`🎯 Austin Showlists: Found ${concerts.length} concerts`);
    return concerts;
    
  } catch (error) {
    console.error(`❌ Austin Showlists scraping error:`, error.message);
    return [];
  }
}

// API endpoint
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: `Method ${req.method} Not Allowed` 
    });
  }

  try {
    console.log('\n🚀 Starting aggregator-focused concert scraping...');
    const { concerts, results, venueStats } = await scrapeAggregators();
    
    // Ensure data directory exists
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Save to JSON file
    const dataToSave = {
      concerts,
      lastUpdated: new Date().toISOString(),
      totalConcerts: concerts.length,
      scrapeResults: results,
      venueStats
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    
    console.log(`\n✅ SCRAPING COMPLETED! Saved ${concerts.length} concerts to file`);
    
    return res.status(200).json({ 
      success: true, 
      concertsFound: concerts.length,
      message: 'Aggregator scraping completed successfully',
      results: results,
      venueStats: venueStats,
      summary: {
        totalSources: results.successful.length + results.failed.length,
        successfulSources: results.successful.length,
        failedSources: results.failed.length,
        concertsPerSource: results.successful.map(s => `${s.source}: ${s.count}`),
        favoriteVenueConcerts: concerts.filter(c => c.isFavoriteVenue).length,
        totalVenues: Object.keys(venueStats).length
      }
    });
  } catch (error) {
    console.error('\n❌ SCRAPING ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Aggregator scraping failed'
    });
  }
}