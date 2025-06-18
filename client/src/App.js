import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import SpotifyComponent, { CreatePlaylistButton } from './components/SpotifyComponent';
import SpotifyService from './services/SpotifyService';

const IS_TEST = process.env.REACT_APP_IS_TEST === 'true';

function App() {
  const [url, setUrl] = useState(IS_TEST ? 'https://www.setlist.fm/setlist/kendrick-lamar-and-sza/2025/hersheypark-stadium-hershey-pa-b5fe986.html' : '');
  const [useProxies, setUseProxies] = useState(false);
  const [setlistData, setSetlistData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState(null);

  // Handle the callback from Spotify OAuth
  useEffect(() => {
    if (window.location.pathname === '/callback') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('Error from Spotify:', error);
        return;
      }

      if (code) {
        handleSpotifyCallback(code);
        // Remove the callback URL from browser history
        window.history.replaceState({}, document.title, '/');
      }
    }
  }, []);

  const handleSpotifyCallback = async (code) => {
    try {
      const data = await SpotifyService.handleAuthCallback(code);
      if (data.access_token) {
        setIsLoggedIn(true);
        // Get user profile after successful login
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
        const userData = await response.json();
        setSpotifyUser(userData);
      }
    } catch (error) {
      console.error('Error handling Spotify callback:', error);
    }
  };

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
          <div className="header-content">
            <h1>Setlist Fetcher</h1>
            <SpotifyComponent
              isLoggedIn={isLoggedIn}
              spotifyUser={spotifyUser}
              setIsLoggedIn={setIsLoggedIn}
              setSpotifyUser={setSpotifyUser}
              songs={null}
              artistName={null}
            />
          </div>
          {/* </header> */}

          <form onSubmit={fetchSetlist} className="setlist-form">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter setlist.fm URL"
              required
              className="url-input"
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Fetching...' : 'Get Setlist'}
            </button>

            <label className="proxy-checkbox">
              <input
                type="checkbox"
                checked={useProxies}
                onChange={(e) => setUseProxies(e.target.checked)}
              />
              Use Proxies
            </label>
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

              <CreatePlaylistButton
                songs={setlistData.setlist}
                artistName={setlistData.artist}
                isLoggedIn={isLoggedIn}
                spotifyUser={spotifyUser}
              />

            </div>
          )}

        </header >
      </div >
    </Router>
  );

}

export default App;
