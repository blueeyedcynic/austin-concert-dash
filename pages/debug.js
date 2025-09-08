import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, Loader, Eye, RefreshCw } from 'lucide-react';

const ScrapeDebugger = () => {
  const [debugResults, setDebugResults] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const testSites = [
    { name: "Emo's Austin", url: "https://www.emosaustin.com/shows" },
    { name: "ACL Live", url: "https://www.acllive.com/events/" },
    { name: "Scoot Inn", url: "https://www.scootinnaustin.com/shows" },
    { name: "Do512", url: "https://do512.com/events/live-music/" },
    { name: "Austin Texas", url: "https://www.austintexas.org/music-scene/concerts-in-austin/" }
  ];

  const debugSite = async (site) => {
    setLoading(prev => ({ ...prev, [site.name]: true }));
    setError(null);

    try {
      const response = await fetch('/api/debug-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: site.url,
          site: site.name
        })
      });

      const data = await response.json();
      
      setDebugResults(prev => ({
        ...prev,
        [site.name]: data
      }));
    } catch (error) {
      setError(`Failed to debug ${site.name}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [site.name]: false }));
    }
  };

  const testImprovedScraping = async () => {
    setLoading(prev => ({ ...prev, 'improved': true }));
    setError(null);

    try {
      const response = await fetch('/api/scrape-improved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      setDebugResults(prev => ({
        ...prev,
        'improved-results': data
      }));
    } catch (error) {
      setError(`Failed to run improved scraping: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, 'improved': false }));
    }
  };

  const clearResults = () => {
    setDebugResults({});
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Web Scraping Debugger</h1>
              <p className="text-gray-600">Test and debug individual venue websites to see what data we can extract.</p>
            </div>
            <button
              onClick={clearResults}
              className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear Results
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Test Individual Sites */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Individual Sites</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testSites.map(site => (
                <div key={site.name} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{site.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 break-all">{site.url}</p>
                  
                  <button
                    onClick={() => debugSite(site)}
                    disabled={loading[site.name]}
                    className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading[site.name] ? (
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    {loading[site.name] ? 'Testing...' : 'Debug Site'}
                  </button>

                  {debugResults[site.name] && (
                    <div className="mt-3 text-sm">
                      {debugResults[site.name].success ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Connected Successfully
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Connection Failed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Test Improved Scraping */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Improved Scraping System</h2>
            <button
              onClick={testImprovedScraping}
              disabled={loading.improved}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading.improved ? (
                <Loader className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Eye className="w-5 h-5 mr-2" />
              )}
              {loading.improved ? 'Running Scraper...' : 'Run Improved Scraper'}
            </button>
          </div>

          {/* Debug Results */}
          {Object.keys(debugResults).length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Debug Results</h2>
              <div className="space-y-6">
                {Object.entries(debugResults).map(([siteName, result]) => (
                  <div key={siteName} className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">{siteName}</h3>
                    
                    {result.success ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Status:</span>
                            <div className="text-green-600">✅ Success</div>
                          </div>
                          <div>
                            <span className="font-medium">Content Length:</span>
                            <div>{result.debug?.contentLength?.toLocaleString() || 'N/A'} chars</div>
                          </div>
                          <div>
                            <span className="font-medium">Title:</span>
                            <div className="truncate">{result.debug?.title || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="font-medium">Has Content:</span>
                            <div>{result.debug?.hasContent ? '✅ Yes' : '❌ No'}</div>
                          </div>
                        </div>

                        {result.debug?.potentialEventSelectors && result.debug.potentialEventSelectors.length > 0 ? (
                          <div>
                            <h4 className="font-medium mb-2">Potential Event Selectors Found:</h4>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {result.debug.potentialEventSelectors.map((selector, i) => (
                                <div key={i} className="text-xs bg-white p-3 rounded border">
                                  <div className="font-mono text-blue-600 mb-1">{selector.selector}</div>
                                  <div className="text-gray-700">
                                    <span className="font-medium">Count:</span> {selector.count} elements
                                  </div>
                                  {selector.sampleClasses && (
                                    <div className="text-gray-700">
                                      <span className="font-medium">Classes:</span> {selector.sampleClasses}
                                    </div>
                                  )}
                                  {selector.sampleText && (
                                    <div className="text-gray-600 mt-1">
                                      <span className="font-medium">Sample:</span> {selector.sampleText.substring(0, 100)}...
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <div className="text-yellow-800">⚠️ No obvious event selectors found. This site might use dynamic loading or have unusual HTML structure.</div>
                          </div>
                        )}

                        {result.debug?.eventClasses && result.debug.eventClasses.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Event-related CSS Classes:</h4>
                            <div className="flex flex-wrap gap-1">
                              {result.debug.eventClasses.slice(0, 10).map((className, i) => (
                                <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {className}
                                </span>
                              ))}
                              {result.debug.eventClasses.length > 10 && (
                                <span className="text-xs text-gray-500">+{result.debug.eventClasses.length - 10} more</span>
                              )}
                            </div>
                          </div>
                        )}

                        {result.debug?.sampleText && (
                          <div>
                            <h4 className="font-medium mb-2">Page Sample Text:</h4>
                            <div className="text-xs bg-gray-100 p-3 rounded max-h-32 overflow-y-auto font-mono">
                              {result.debug.sampleText}
                            </div>
                          </div>
                        )}

                        {/* Show scraping results if this is the improved scraper results */}
                        {result.summary && (
                          <div>
                            <h4 className="font-medium mb-2">Scraping Results:</h4>
                            <div className="bg-white p-4 rounded border">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                <div>
                                  <span className="font-medium">Total Concerts:</span>
                                  <div className="text-2xl font-bold text-blue-600">{result.concertsFound || 0}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Successful Sources:</span>
                                  <div className="text-2xl font-bold text-green-600">{result.summary?.successfulSources || 0}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Failed Sources:</span>
                                  <div className="text-2xl font-bold text-red-600">{result.summary?.failedSources || 0}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Total Sources:</span>
                                  <div className="text-2xl font-bold text-gray-600">{result.summary?.totalSources || 0}</div>
                                </div>
                              </div>
                              
                              {result.summary?.concertsPerSource && result.summary.concertsPerSource.length > 0 && (
                                <div>
                                  <h5 className="font-medium mb-2">Concerts Per Source:</h5>
                                  <ul className="text-sm space-y-1">
                                    {result.summary.concertsPerSource.map((source, i) => (
                                      <li key={i} className="flex justify-between bg-gray-50 px-3 py-1 rounded">
                                        <span>{source}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {result.results?.successful && (
                                <div className="mt-4">
                                  <h5 className="font-medium mb-2">Successful Sources:</h5>
                                  <div className="space-y-1">
                                    {result.results.successful.map((source, i) => (
                                      <div key={i} className="text-sm bg-green-50 px-3 py-2 rounded flex justify-between">
                                        <span>{source.source} ({source.type})</span>
                                        <span className="font-medium">{source.count} concerts</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {result.results?.failed && result.results.failed.length > 0 && (
                                <div className="mt-4">
                                  <h5 className="font-medium mb-2">Failed Sources:</h5>
                                  <div className="space-y-1">
                                    {result.results.failed.map((source, i) => (
                                      <div key={i} className="text-sm bg-red-50 px-3 py-2 rounded">
                                        <div className="flex justify-between">
                                          <span>{source.source} ({source.type})</span>
                                          <span className="text-red-600">Failed</span>
                                        </div>
                                        <div className="text-xs text-red-600 mt-1">{source.error}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-red-600">
                        <div className="flex items-center mb-2">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          <span className="font-medium">Error: {result.error}</span>
                        </div>
                        {result.details && (
                          <div className="text-sm text-gray-600 bg-red-50 p-3 rounded">
                            <div><span className="font-medium">Code:</span> {result.details.code}</div>
                            <div><span className="font-medium">Response Status:</span> {result.details.response}</div>
                            <div><span className="font-medium">Message:</span> {result.details.message}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-medium text-blue-900 mb-2">How to Use This Debugger:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>First, test individual sites to see if they're accessible and what HTML structure they have</li>
              <li>Look for "Potential Event Selectors" to understand how events are structured on each site</li>
              <li>If sites are accessible but no selectors are found, they might use JavaScript to load content</li>
              <li>Run the "Improved Scraper" to see the actual scraping results with detailed logs</li>
              <li>Check the browser console for additional debugging information</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrapeDebugger;