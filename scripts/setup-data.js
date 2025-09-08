// File: scripts/setup-data.js
import { promises as fs } from 'fs';
import path from 'path';

// Mock concert data to initialize the app
const mockConcerts = [
  {
    id: 1,
    artist: "Black Pumas",
    venue: "ACL Live at The Moody Theater",
    date: "2025-09-12",
    time: "8:00 PM",
    price: "$45-65",
    genre: "Soul/Rock",
    isFavoriteVenue: true
  },
  {
    id: 2,
    artist: "Spoon",
    venue: "Emo's Austin",
    date: "2025-09-13", 
    time: "7:30 PM",
    price: "$38-55",
    genre: "Indie Rock",
    isFavoriteVenue: true
  },
  {
    id: 3,
    artist: "Gary Clark Jr.",
    venue: "ACL Live at The Moody Theater",
    date: "2025-09-15",
    time: "9:00 PM", 
    price: "$48-78",
    genre: "Blues/Rock",
    isFavoriteVenue: true
  },
  {
    id: 4,
    artist: "White Denim",
    venue: "Scoot Inn",
    date: "2025-09-17",
    time: "9:00 PM",
    price: "$25-35", 
    genre: "Garage Rock",
    isFavoriteVenue: true
  },
  {
    id: 5,
    artist: "Shakey Graves", 
    venue: "Emo's Austin",
    date: "2025-09-18",
    time: "8:00 PM",
    price: "$35-50",
    genre: "Folk/Rock",
    isFavoriteVenue: true
  },
  {
    id: 6,
    artist: "The Midnight",
    venue: "Scoot Inn",
    date: "2025-09-19",
    time: "8:00 PM",
    price: "$32-45",
    genre: "Synthwave",
    isFavoriteVenue: true
  },
  {
    id: 7,
    artist: "Explosions in the Sky",
    venue: "The Long Center",
    date: "2025-09-20",
    time: "8:30 PM",
    price: "$42-62",
    genre: "Post-Rock",
    isFavoriteVenue: false
  },
  {
    id: 8,
    artist: "Wild Child",
    venue: "Cheer Up Charlies",
    date: "2025-09-21",
    time: "9:30 PM",
    price: "$20-30",
    genre: "Indie Folk",
    isFavoriteVenue: false
  }
];

async function setupInitialData() {
  const dataDir = path.join(process.cwd(), 'data');
  const dataFile = path.join(dataDir, 'concerts.json');
  
  try {
    // Check if data file already exists
    try {
      await fs.access(dataFile);
      console.log('📁 Data file already exists at:', dataFile);
      console.log('🔄 To reset data, delete the file and run this script again.');
      return;
    } catch {
      // File doesn't exist, continue with setup
    }

    // Create data directory if it doesn't exist
    await fs.mkdir(dataDir, { recursive: true });
    console.log('📁 Created data directory:', dataDir);
    
    // Write initial mock data
    const dataToWrite = {
      concerts: mockConcerts,
      lastUpdated: new Date().toISOString(),
      totalConcerts: mockConcerts.length
    };

    await fs.writeFile(dataFile, JSON.stringify(dataToWrite, null, 2));
    
    console.log('✅ Initial data setup complete!');
    console.log(`📄 Data file created at: ${dataFile}`);
    console.log(`🎵 Initialized with ${mockConcerts.length} sample concerts`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Run "npm run dev" to start your development server');
    console.log('2. Visit http://localhost:3000 to see your dashboard');
    console.log('3. Click "Update Data" to test the scraping functionality');
  } catch (error) {
    console.error('❌ Error setting up data:', error);
    process.exit(1);
  }
}

// Run the setup function
setupInitialData();