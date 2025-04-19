import SpotifyWebApi from 'spotify-web-api-node';

// Initialize Spotify API - Client credentials should be stored in environment variables
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.REACT_APP_SPOTIFY_REDIRECT_URI,
});

class SpotifyService {
  static async getAccessToken() {
    try {
      const data = await spotifyApi.clientCredentialsGrant();
      spotifyApi.setAccessToken(data.body.access_token);
    } catch (error) {
      console.error('Error getting Spotify access token:', error);
      throw error;
    }
  }

  static async getArtistImage(artistName) {
    try {
      await this.getAccessToken();
      const searchResult = await spotifyApi.searchArtists(artistName, { limit: 1 });
      
      if (searchResult.body.artists.items.length === 0) {
        throw new Error('Artist not found');
      }

      const artist = searchResult.body.artists.items[0];
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
          const searchResult = await spotifyApi.searchTracks(`track:${songName} artist:${artistName}`, { limit: 1 });
          if (searchResult.body.tracks.items.length === 0) {
            console.warn(`Song not found: ${songName}`);
            return null;
          }
          return searchResult.body.tracks.items[0];
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
      // This requires user authentication - make sure the user is logged in
      const playlist = await spotifyApi.createPlaylist(userId, {
        name: playlistName,
        description: 'Created via Setlist App',
        public: false
      });

      if (songUris.length > 0) {
        // Spotify has a limit of 100 tracks per request
        for (let i = 0; i < songUris.length; i += 100) {
          const uriChunk = songUris.slice(i, i + 100);
          await spotifyApi.addTracksToPlaylist(playlist.body.id, uriChunk);
        }
      }

      return playlist.body;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }

  static authenticateUser() {
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private'
    ];
    const state = 'some-state-value';
    return spotifyApi.createAuthorizeURL(scopes, state, { show_dialog: true });
  }

  static async handleAuthCallback(code) {
    try {
      const data = await spotifyApi.authorizationCodeGrant(code);
      spotifyApi.setAccessToken(data.body.access_token);
      spotifyApi.setRefreshToken(data.body.refresh_token);
      return data.body;
    } catch (error) {
      console.error('Error handling auth callback:', error);
      throw error;
    }
  }

  static async refreshAccessToken() {
    try {
      const data = await spotifyApi.refreshAccessToken();
      spotifyApi.setAccessToken(data.body.access_token);
      return data.body;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

export default SpotifyService;
