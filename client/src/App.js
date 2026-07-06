import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';
import SpotifyComponent, { CreatePlaylistButton } from './components/SpotifyComponent';
import SongTrackList from './components/SongTrackList';
import SpotifyService from './services/SpotifyService';

const IS_TEST = process.env.REACT_APP_IS_TEST === 'true';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function formatEventDate(ddmmyyyy) {
  // setlist.fm returns dates as dd-MM-yyyy
  const parts = (ddmmyyyy || '').split('-');
  if (parts.length !== 3) return ddmmyyyy || '';
  const [day, month, year] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(date.getTime())) return ddmmyyyy;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function App() {
  const [mode, setMode] = useState('search'); // 'search' | 'url'
  const [url, setUrl] = useState(IS_TEST ? 'https://www.setlist.fm/setlist/kendrick-lamar-and-sza/2025/hersheypark-stadium-hershey-pa-b5fe986.html' : '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [setlistData, setSetlistData] = useState(null);
  const [resolvedTracks, setResolvedTracks] = useState(null);
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

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
  };

  const fetchSetlist = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await fetch(`${BACKEND_URL}/setlist/?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch setlist');
      }
      const data = await response.json();
      setSetlistData(data);
      setResolvedTracks(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchShows = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    setSetlistData(null);
    try {
      const response = await fetch(`${BACKEND_URL}/search/?artist=${encodeURIComponent(query.trim())}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Search failed');
      }
      const data = await response.json();
      setResults(data.setlists);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const loadShow = async (show) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/setlist/${encodeURIComponent(show.id)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to load setlist');
      }
      const data = await response.json();
      setSetlistData(data);
      setResolvedTracks(null);
      setResults(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <div className="App">
        <nav className="topbar">
          <span className="brand">
            setlist<span className="brand-accent">2</span>playlist
          </span>
          <SpotifyComponent
            isLoggedIn={isLoggedIn}
            spotifyUser={spotifyUser}
            setIsLoggedIn={setIsLoggedIn}
            setSpotifyUser={setSpotifyUser}
            songs={null}
            artistName={null}
          />
        </nav>

        <main className="main-content">
          <header className="hero">
            <h1>Turn any setlist into a playlist</h1>
            <p className="app-description">
              Search for an artist's concert, or paste a setlist.fm link, and we'll build the setlist as a Spotify playlist.
            </p>
          </header>

          <div className="mode-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'search'}
              className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
              onClick={() => switchMode('search')}
            >
              Search artist
            </button>
            <button
              role="tab"
              aria-selected={mode === 'url'}
              className={`mode-tab ${mode === 'url' ? 'active' : ''}`}
              onClick={() => switchMode('url')}
            >
              Paste URL
            </button>
          </div>

          {mode === 'search' ? (
            <form onSubmit={searchShows} className="setlist-form">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search an artist, e.g. Radiohead"
                className="url-input"
              />
              <button type="submit" className="submit-btn" disabled={searching || !query.trim()}>
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>
          ) : (
            <form onSubmit={fetchSetlist} className="setlist-form">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a setlist.fm URL (show or tour average)"
                required
                className="url-input"
              />
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Fetching…' : 'Get setlist'}
              </button>
            </form>
          )}

          {error && <div className="error">{error}</div>}

          {results && (
            <div className="search-results">
              {results.length === 0 ? (
                <p className="no-results">No shows with a setlist found. Try a different spelling.</p>
              ) : (
                results.map((show) => (
                  <button key={show.id} className="show-card" onClick={() => loadShow(show)} disabled={loading}>
                    <div className="show-main">
                      <span className="show-venue">{show.venue || 'Unknown venue'}</span>
                      <span className="show-meta">{show.location}</span>
                    </div>
                    <div className="show-side">
                      <span className="show-date">{formatEventDate(show.eventDate)}</span>
                      <span className="show-songs">{show.songCount} songs</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {setlistData && (
            <div className="setlist-result">
              <div className="result-head">
                <h2>{setlistData.artist}</h2>
                <p className="event-details">
                  {[setlistData.date, setlistData.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              {isLoggedIn ? (
                <SongTrackList
                  key={setlistData.artist + '|' + setlistData.setlist.join('|')}
                  songs={setlistData.setlist}
                  artistName={setlistData.artist}
                  onTracksChange={setResolvedTracks}
                />
              ) : (
                <ol className="song-list">
                  {setlistData.setlist.map((song, index) => (
                    <li key={index}>
                      <span className="song-num">{index + 1}</span>
                      <span className="song-name">{song}</span>
                    </li>
                  ))}
                </ol>
              )}

              <CreatePlaylistButton
                songs={setlistData.setlist}
                artistName={setlistData.artist}
                isLoggedIn={isLoggedIn}
                spotifyUser={spotifyUser}
                resolvedTracks={resolvedTracks}
                playlistName={[
                  [setlistData.artist, setlistData.location].filter(Boolean).join(' ') + ' Setlist',
                  setlistData.date,
                ].filter(Boolean).join(' - ')}
              />
            </div>
          )}
        </main>
      </div>
    </Router>
  );

}

export default App;
