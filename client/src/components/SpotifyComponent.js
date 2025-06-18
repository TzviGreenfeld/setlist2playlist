import React, { useState } from 'react';
import SpotifyService from '../services/SpotifyService';

function SpotifyComponent({ 
  songs, 
  artistName, 
  isLoggedIn, 
  spotifyUser, 
  setIsLoggedIn,
  setSpotifyUser
}) {
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState(null);

  const handleLogin = async () => {
    try {
      const authUrl = await SpotifyService.authenticateUser();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error during Spotify login:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!isLoggedIn || !spotifyUser || !songs || songs.length === 0 || !artistName) {
      setPlaylistError('Please log in and ensure songs are fetched before creating a playlist');
      return;
    }

    setIsCreatingPlaylist(true);
    setPlaylistError(null);

    try {
      // First get the Spotify track URIs for the songs
      const spotifyTracks = await SpotifyService.getSongsByArtistAndNames(artistName, songs);
      const trackUris = spotifyTracks.map(track => track.uri);

      if (trackUris.length === 0) {
        throw new Error('No songs found on Spotify');
      }

      // Create the playlist with the found tracks
      const playlistName = `${artistName} Setlist`;
      await SpotifyService.createPlaylist(spotifyUser.id, playlistName, trackUris);
      alert('Playlist created successfully!');
    } catch (error) {
      console.error('Error creating playlist:', error);
      setPlaylistError(error.message);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const hasSongs = songs && songs.length > 0 && artistName;

  return (
    <div className="spotify-container">
      {!isLoggedIn ? (
        <button onClick={handleLogin} className="spotify-login-btn">
          Login with Spotify
        </button>
      ) : (
        <div className="spotify-logged-in">
          <div className="user-info">
            {spotifyUser?.images?.[0]?.url && (
              <img
                src={spotifyUser.images[0].url}
                alt={spotifyUser.display_name}
                className="profile-image"
              />
            )}
            <div className="user-details">
              <p className="username">Connected as {spotifyUser?.display_name}</p>
              {spotifyUser?.email && <p className="email">{spotifyUser.email}</p>}
               <button
              onClick={() => {
                setIsLoggedIn(false);
                setSpotifyUser(null);
                window.localStorage.removeItem('spotify_token');
              }}
              className="spotify-logout-btn"
            >
              Logout
            </button>
            </div>
          </div>
          <div className="actions">
            {hasSongs && (
              <button
                onClick={handleCreatePlaylist}
                disabled={isCreatingPlaylist}
                className="create-playlist-btn"
              >
                {isCreatingPlaylist ? 'Creating Playlist...' : 'Create Playlist'}
              </button>
            )}
           
          </div>
          {playlistError && (
            <p className="error-message">{playlistError}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SpotifyComponent;
