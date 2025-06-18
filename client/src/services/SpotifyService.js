export class SpotifyService {
  static BASE_URL = 'https://api.spotify.com/v1';
  static AUTH_URL = 'https://accounts.spotify.com/api/token';
  static AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';

  static async fetchWithAuth(url, options = {}) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      await this.refreshAccessToken();
      // Retry the request with new token
      return this.fetchWithAuth(url, options);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Spotify API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  static splitArtistName(artistName) {
    // Split by '&', 'and', or '+' and trim whitespace
    const artists = artistName.split(/\s*(?:&|and|\+)\s*/);
    return artists.map(artist => artist.trim());
  }

  static async searchSongWithArtist(songName, artistName) {
    const params = new URLSearchParams({
      q: `track:${songName} artist:${artistName}`,
      type: 'track',
      limit: 1
    });

    console.log(`Searching for song: ${songName} by ${artistName}`);

    const data = await this.fetchWithAuth(
      `${this.BASE_URL}/search?${params.toString()}`
    );

    if (!data.tracks || !data.tracks.items) {
      console.warn(`No tracks found for: ${songName} by ${artistName}`);
    } else if (data.tracks.items.length > 0) {
      return data.tracks.items[0];
    }
    console.warn(`Song not found: ${songName} by ${artistName}`);
    return null;
  }

  static async getAccessToken() {
    const credentials = btoa(
      `${process.env.REACT_APP_SPOTIFY_CLIENT_ID}:${process.env.REACT_APP_SPOTIFY_CLIENT_SECRET}`
    );

    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Failed to get access token');
    }

    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    return data.access_token;
  }

  static async getArtistImage(artistName) {
    try {
      await this.getAccessToken();
      const params = new URLSearchParams({
        q: artistName,
        type: 'artist',
        limit: 1
      });

      const data = await this.fetchWithAuth(
        `${this.BASE_URL}/search?${params.toString()}`
      );
      
      if (data.artists.items.length === 0) {
        throw new Error('Artist not found');
      }

      const artist = data.artists.items[0];
      return artist.images[0]?.url || null;
    } catch (error) {
      console.error('Error getting artist image:', error);
      throw error;
    }
  }

  static async getSongsByArtistAndNames(artistName, songNames) {
    try {
      await this.getAccessToken();
      const songs = await Promise.all(
        songNames.map(async (songName) => {
          // First try with the full artist name
          let song = await this.searchSongWithArtist(songName, artistName);
          
          // If not found and artist name contains separators, try individual artists
          if (!song) {
            const artists = this.splitArtistName(artistName);
            if (artists.length > 1) {
              console.log(`Trying individual artists for: ${songName}`);
              for (const artist of artists) {
                song = await this.searchSongWithArtist(songName, artist);
                if (song) break;
              }
            }
          }

          if (!song) {
            console.warn(`Song not found: ${songName} by any artist variation`);
          }
          return song;
        })
      );

      return songs.filter(song => song !== null);
    } catch (error) {
      console.error('Error getting songs:', error);
      throw error;
    }
  }

  static async createPlaylist(userId, playlistName, songUris) {
    try {
      // Create the playlist
      const playlist = await this.fetchWithAuth(
        `${this.BASE_URL}/users/${userId}/playlists`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: playlistName,
            description: 'Created via Setlist App',
            public: false
          })
        }
      );

      if (songUris.length > 0) {
        // Add tracks in chunks of 100 (Spotify's limit)
        for (let i = 0; i < songUris.length; i += 100) {
          const uriChunk = songUris.slice(i, i + 100);
          await this.fetchWithAuth(
            `${this.BASE_URL}/playlists/${playlist.id}/tracks`,
            {
              method: 'POST',
              body: JSON.stringify({
                uris: uriChunk
              })
            }
          );
        }
      }

      return playlist;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }

  static authenticateUser() {
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-email'
    ];
    
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.REACT_APP_SPOTIFY_REDIRECT_URI,
      scope: scopes.join(' '),
      show_dialog: true,
      state: Math.random().toString(36).substring(7)
    });

    return `${this.AUTHORIZE_URL}?${params.toString()}`;
  }

  static async handleAuthCallback(code) {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REACT_APP_SPOTIFY_REDIRECT_URI
      });

      const credentials = btoa(
        `${process.env.REACT_APP_SPOTIFY_CLIENT_ID}:${process.env.REACT_APP_SPOTIFY_CLIENT_SECRET}`
      );

      const response = await fetch(this.AUTH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Auth error: ${error.error_description || response.statusText}`);
      }

      const data = await response.json();
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      
      return data;
    } catch (error) {
      console.error('Error handling auth callback:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  }

  static async refreshAccessToken() {
    try {
      const refreshToken = localStorage.getItem('spotify_refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const credentials = btoa(
        `${process.env.REACT_APP_SPOTIFY_CLIENT_ID}:${process.env.REACT_APP_SPOTIFY_CLIENT_SECRET}`
      );

      const response = await fetch(this.AUTH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Refresh token error: ${error.error_description || response.statusText}`);
      }

      const data = await response.json();
      localStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      
      return data;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

export default SpotifyService;
