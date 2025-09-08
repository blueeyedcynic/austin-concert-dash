// pages/index.js
import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, ExternalLink, Music, RefreshCw, X } from 'lucide-react';

const favoriteVenues = [
  "Emo's Austin",
  "ACL Live at The Moody Theater", 
  "Scoot Inn"
];

const ConcertCard = ({ concert, isCompact = false }) => {
const formatDate = (dateString) => {
  // Split the date string and create date in local timezone
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

  return (
    <div className={`bg-white border border-gray-300 hover:border-gray-400 transition-colors ${isCompact ? 'p-3' : 'p-4'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className={`font-semibold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'}`}>
            {concert.artist}
          </h3>
          <div className="flex items-center text-gray-600 mt-1">
            <Calendar className="w-3 h-3 mr-1" />
            <span className="text-xs">{formatDate(concert.date)}</span>
            <Clock className="w-3 h-3 ml-3 mr-1" />
            <span className="text-xs">{concert.time}</span>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1">
          {concert.genre}
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-600">
          <MapPin className="w-3 h-3 mr-1" />
          <span>{concert.venue}</span>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-gray-900">{concert.price}</div>
          <button className="text-orange-600 hover:text-orange-700 text-xs flex items-center mt-1">
            Details
            <ExternalLink className="w-3 h-3 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

const VenueColumn = ({ venue, concerts }) => {
  const venueConcerts = concerts.filter(concert => concert.venue === venue)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  return (
    <div className="flex-1">
      <div className="bg-gray-900 text-white p-4 mb-4">
        <h2 className="text-lg font-bold text-center">{venue}</h2>
        <p className="text-gray-300 text-sm text-center mt-1">
          {venueConcerts.length} upcoming show{venueConcerts.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="space-y-3">
        {venueConcerts.length > 0 ? (
          venueConcerts.map(concert => (
            <ConcertCard key={concert.id} concert={concert} isCompact={true} />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Music className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No upcoming shows</p>
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingModal = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Finding concerts on the web...</h3>
          <p className="text-gray-600 text-sm">This may take a moment while we search multiple sources</p>
        </div>
      </div>
    </div>
  );
};

const SuccessModal = ({ isOpen, onClose, stats }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Concerts Updated!</h3>
          
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total concerts found:</span>
              <span className="font-semibold">{stats?.totalConcerts || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">At favorite venues:</span>
              <span className="font-semibold text-orange-600">{stats?.favoriteVenueConcerts || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sources checked:</span>
              <span className="font-semibold">{stats?.successfulSources || 0}</span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-3 px-4 hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [concerts, setConcerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedView, setSelectedView] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scrapingStats, setScrapingStats] = useState(null);

  // Fetch concerts from API
  const fetchConcerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/concerts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch concerts');
      }
      
      const data = await response.json();
      setConcerts(data.concerts || []);
      
      if (data.lastUpdated) {
        setLastUpdated(new Date(data.lastUpdated));
      }
    } catch (error) {
      console.error('Error fetching concerts:', error);
      setError('Failed to load concerts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger scraping
  const triggerScraping = async () => {
    try {
      setScraping(true);
      setError(null);
      
      const response = await fetch('/api/scrape-aggregators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh concerts after scraping
        await fetchConcerts();
        
        // Show success modal with stats
        setScrapingStats({
          totalConcerts: data.concertsFound,
          favoriteVenueConcerts: data.summary?.favoriteVenueConcerts || 0,
          successfulSources: data.summary?.successfulSources || 0
        });
        setShowSuccessModal(true);
      } else {
        throw new Error(data.error || 'Scraping failed');
      }
    } catch (error) {
      console.error('Error during scraping:', error);
      setError('Failed to scrape venue data. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  // Load concerts on component mount
  useEffect(() => {
    fetchConcerts();
  }, []);

  // Filter concerts based on view and search
  const filteredConcerts = concerts.filter(concert => {
    const matchesSearch = concert.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         concert.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         concert.genre.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedView === 'favorites') {
      return matchesSearch && concert.isFavoriteVenue;
    }
    return matchesSearch;
  });

  // Get non-favorite venue concerts for "All Venues" section
  const nonFavoriteConcerts = filteredConcerts
    .filter(concert => !favoriteVenues.includes(concert.venue))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group non-favorite concerts by date
  const concertsByDate = nonFavoriteConcerts.reduce((acc, concert) => {
    const date = concert.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(concert);
    return acc;
  }, {});

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Music className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading concerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Loading Modal */}
      <LoadingModal isOpen={scraping} />
      
      {/* Success Modal */}
      <SuccessModal 
        isOpen={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)}
        stats={scrapingStats}
      />

      {/* Header */}
      <header className="bg-black text-white border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Austin Live Music</h1>
              <p className="text-gray-300 mt-2">Your guide to upcoming concerts in the Live Music Capital</p>
              {lastUpdated && (
                <p className="text-sm text-gray-400 mt-2">
                  Last updated: {lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-6">
              <button
                onClick={triggerScraping}
                disabled={scraping}
                className="flex items-center px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${scraping ? 'animate-spin' : ''}`} />
                {scraping ? 'Refreshing...' : 'Refresh Concerts'}
              </button>
              <Music className="w-10 h-10 text-orange-600" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-white border-l-4 border-orange-600 p-4 mb-6">
            <p className="text-gray-700">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedView('all')}
              className={`px-4 py-2 font-medium transition-colors ${
                selectedView === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All Shows ({concerts.length})
            </button>
            <button
              onClick={() => setSelectedView('favorites')}
              className={`px-4 py-2 font-medium transition-colors ${
                selectedView === 'favorites'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Favorite Venues ({concerts.filter(c => c.isFavoriteVenue).length})
            </button>
          </div>
          
          <div className="w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search artists, venues, or genres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 px-4 py-2 border border-gray-300 focus:border-orange-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Ryan's Favorite Venues - 3 Column Layout */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Ryan's Favorite Venues</h2>
            <div className="w-16 h-1 bg-orange-600"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {favoriteVenues.map(venue => (
              <VenueColumn 
                key={venue} 
                venue={venue} 
                concerts={filteredConcerts}
              />
            ))}
          </div>
        </div>

        {/* All Venues Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">All Venues</h2>
            <div className="w-16 h-1 bg-orange-600"></div>
          </div>
          
          {Object.keys(concertsByDate).length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {concerts.length === 0 
                  ? 'No concerts found. Try refreshing the data.'
                  : 'No concerts found at other venues matching your criteria.'
                }
              </p>
              {concerts.length === 0 && (
                <button
                  onClick={triggerScraping}
                  disabled={scraping}
                  className="mt-4 px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {scraping ? 'Refreshing...' : 'Refresh Concert Data'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(concertsByDate)
                .sort(([a], [b]) => new Date(a) - new Date(b))
                .map(([date, daysConcerts]) => (
                  <div key={date}>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-300 pb-2">
                      {formatDateHeader(date)}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {daysConcerts.map(concert => (
                        <ConcertCard key={concert.id} concert={concert} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}