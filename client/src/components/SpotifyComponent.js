import React, { useState } from 'react';
import SpotifyService from '../services/SpotifyService';

const IS_TEST = process.env.REACT_APP_IS_TEST === 'true';

const logSuccessMetric = (spotifyTracks, songs) => {
  const is_same_song = (fullName, name) => {
    return fullName.toLowerCase().trim().includes(name.toLowerCase().trim());
  };

  console.table(spotifyTracks.map((track, index) => ({
    original_song_name: songs[index],
    actual_song_name: track.name,
    is_same: is_same_song(track.name, songs[index])
  })));

  const successfulTracks = spotifyTracks.filter((track, index) => (
    is_same_song(track.name, songs[index]) ||
    (index < songs.length - 1 && is_same_song(track.name, songs[index + 1])) ||
    (index < songs.length - 2 && is_same_song(track.name, songs[index + 2]))
  ));

  const unSuccessfulTracks = spotifyTracks.filter((track, index) => (
    !(
      is_same_song(track.name, songs[index]) ||
      (index < songs.length - 1 && is_same_song(track.name, songs[index + 1])) ||
      (index < songs.length - 2 && is_same_song(track.name, songs[index + 2]))
    )
  ));


  console.log("unSuccessfulTracks", unSuccessfulTracks.map(track => track.name).join('\n'));
  console.log(`Successful tracks: ${successfulTracks.length} / ${spotifyTracks.length}. Success Rate: ${(successfulTracks.length / songs.length) * 100 + '%'}`);
}

export function CreatePlaylistButton({
  songs,
  artistName,
  isLoggedIn,
  spotifyUser,
}) {
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState(null);

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

      if (IS_TEST) {
        logSuccessMetric(spotifyTracks, songs);
      }

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

  return <>
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
    {
      playlistError && (
        <p className="error-message">{playlistError}</p>
      )
    }
  </>
}


function SpotifyComponent({
  isLoggedIn,
  spotifyUser,
  setIsLoggedIn,
  setSpotifyUser
}) {

  const handleLogin = async () => {
    try {
      const authUrl = await SpotifyService.authenticateUser();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error during Spotify login:', error);
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
            </div>
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
      )}
    </div>
  );
}

export default SpotifyComponent;


