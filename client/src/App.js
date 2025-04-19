import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import SpotifyComponent from './components/SpotifyComponent';

function App() {
  const [url, setUrl] = useState('');
  const [useProxies, setUseProxies] = useState(false);
  const [setlistData, setSetlistData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSetlist = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/setlist/?url=${encodeURIComponent(url)}&use_proxies=${useProxies}`);
      if (!response.ok) {
        throw new Error('Failed to fetch setlist');
      }
      const data = await response.json();
      setSetlistData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <div className="App">
      <header className="App-header">
        <h1>Setlist Fetcher</h1>
        <SpotifyComponent />
        <form onSubmit={fetchSetlist} className="setlist-form">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter setlist.fm URL"
            required
            className="url-input"
          />
          <label className="proxy-checkbox">
            <input
              type="checkbox"
              checked={useProxies}
              onChange={(e) => setUseProxies(e.target.checked)}
            />
            Use Proxies
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Fetching...' : 'Get Setlist'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {setlistData && (
          <div className="setlist-result">
            <h2>{setlistData.artist}</h2>
            <p className="event-details">
              {setlistData.date} - {setlistData.location}
            </p>
            <ol className="song-list">
              {setlistData.setlist.map((song, index) => (
                <li key={index}>{song}</li>
              ))}
            </ol>
          </div>
        )}
      </header>
      <Routes>
        <Route path="/callback" element={<SpotifyComponent />} />
      </Routes>
      </div>
    </Router>
  );
}

export default App;
