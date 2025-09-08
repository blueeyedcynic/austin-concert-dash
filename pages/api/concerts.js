// pages/api/concerts.js
import { promises as fs } from 'fs';
import path from 'path';

// Simple JSON file storage - replace with database later
const DATA_FILE = path.join(process.cwd(), 'data', 'concerts.json');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Read concerts from JSON file
      const fileContents = await fs.readFile(DATA_FILE, 'utf8');
      const data = JSON.parse(fileContents);
      
      // Filter to next 2 weeks only
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const filteredConcerts = data.concerts.filter(concert => {
        const concertDate = new Date(concert.date);
        return concertDate >= today && concertDate <= twoWeeksFromNow;
      });

      // Sort concerts by date
      filteredConcerts.sort((a, b) => new Date(a.date) - new Date(b.date));

      res.status(200).json({ 
        concerts: filteredConcerts,
        lastUpdated: data.lastUpdated,
        totalConcerts: filteredConcerts.length
      });
    } catch (error) {
      console.error('Error reading concerts:', error);
      
      // Return empty array if file doesn't exist yet
      res.status(200).json({ 
        concerts: [],
        lastUpdated: null,
        totalConcerts: 0,
        error: 'No concert data found. Try updating the data first.'
      });
    }
  } else if (req.method === 'POST') {
    // Allow manual addition of concerts via POST
    try {
      const { concerts: newConcerts } = req.body;
      
      if (!newConcerts || !Array.isArray(newConcerts)) {
        return res.status(400).json({ error: 'Invalid concerts data' });
      }

      // Read existing data
      let existingData = { concerts: [], lastUpdated: null };
      try {
        const fileContents = await fs.readFile(DATA_FILE, 'utf8');
        existingData = JSON.parse(fileContents);
      } catch (error) {
        // File doesn't exist yet, use empty data
      }

      // Merge new concerts with existing ones (avoid duplicates by ID)
      const existingIds = new Set(existingData.concerts.map(c => c.id));
      const uniqueNewConcerts = newConcerts.filter(concert => !existingIds.has(concert.id));
      
      const updatedData = {
        concerts: [...existingData.concerts, ...uniqueNewConcerts],
        lastUpdated: new Date().toISOString(),
        totalConcerts: existingData.concerts.length + uniqueNewConcerts.length
      };

      // Ensure data directory exists
      const dataDir = path.dirname(DATA_FILE);
      await fs.mkdir(dataDir, { recursive: true });

      // Write updated data
      await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));

      res.status(200).json({ 
        success: true,
        message: `Added ${uniqueNewConcerts.length} new concerts`,
        totalConcerts: updatedData.totalConcerts
      });
    } catch (error) {
      console.error('Error adding concerts:', error);
      res.status(500).json({ error: 'Failed to add concerts' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}