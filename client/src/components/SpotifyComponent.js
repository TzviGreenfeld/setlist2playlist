import React, { useState, useEffect } from 'react';
import SpotifyService from '../services/SpotifyService';

function SpotifyComponent() {
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

  const handleLogin = async () => {
    try {
      const authUrl = await SpotifyService.authenticateUser();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error during Spotify login:', error);
    }
  };

  const handleSpotifyCallback = async (code) => {
    try {
      const data = await SpotifyService.handleAuthCallback(code);
      if (data.access_token) {
        setIsLoggedIn(true);
        // Here you could also fetch user data if needed
      }
    } catch (error) {
      console.error('Error handling Spotify callback:', error);
    }
  };

  return (
    <div className="spotify-container">
      {!isLoggedIn ? (
        <button onClick={handleLogin} className="spotify-login-btn">
          Login with Spotify
        </button>
      ) : (
        <div className="spotify-logged-in">
          <p>Connected to Spotify</p>
          {/* Add more Spotify functionality here like create playlist button */}
        </div>
      )}
    </div>
  );
}

export default SpotifyComponent;
