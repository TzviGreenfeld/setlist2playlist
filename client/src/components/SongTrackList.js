import React, { useState, useEffect, useRef } from 'react';
import SpotifyService from '../services/SpotifyService';

function smallestImage(images) {
  if (!images || images.length === 0) return null;
  return images.reduce((smallest, img) =>
    img.width && smallest.width && img.width < smallest.width ? img : smallest
  );
}

function TrackLine({ track, placeholder }) {
  const image = smallestImage(track?.album?.images);
  return (
    <div className="track-line">
      {image ? (
        <img src={image.url} alt="" className="track-thumb" />
      ) : (
        <div className="track-thumb track-thumb-empty" aria-hidden="true" />
      )}
      <div className="track-meta">
        <span className="track-title">{track ? track.name : placeholder}</span>
        {track && (
          <span className="track-artist">
            {track.artists.map((a) => a.name).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

function SongRow({ song, index, track, onPick, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(song);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const runSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const items = await SpotifyService.searchTracks(q, { limit: 5 });
      setResults(items);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const pick = (chosen) => {
    onPick(index, chosen);
    setEditing(false);
    setResults([]);
  };

  return (
    <li className={`song-row ${track ? '' : 'song-row-unmatched'}`}>
      <div className="song-row-main">
        <span className="song-num">{index + 1}</span>
        <div className="song-body">
          <span className="song-name">{song}</span>
          {track ? (
            <TrackLine track={track} />
          ) : (
            <span className="track-missing">Not found — excluded from playlist</span>
          )}
        </div>
        <button
          type="button"
          className="song-menu-btn"
          aria-label="Change matched track"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          &#8942;
        </button>
      </div>

      {editing && (
        <div className="song-editor">
          <form className="song-search-form" onSubmit={runSearch}>
            <input
              ref={inputRef}
              type="text"
              className="song-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Spotify for a track"
            />
            <button type="submit" className="song-search-btn" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && <p className="error-message">{searchError}</p>}

          {results.length > 0 && (
            <ul className="song-results">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="song-result-card"
                    onClick={() => pick(result)}
                  >
                    <TrackLine track={result} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {track && (
            <button
              type="button"
              className="song-remove-btn"
              onClick={() => {
                onRemove(index);
                setEditing(false);
              }}
            >
              Remove from playlist
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function SongTrackList({ songs, artistName, onTracksChange }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    SpotifyService.resolveTracksForSongs(artistName, songs)
      .then((resolved) => {
        if (cancelled) return;
        setMatches(resolved);
        onTracksChange(resolved);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error resolving tracks:', error);
        const empty = songs.map(() => null);
        setMatches(empty);
        onTracksChange(empty);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, artistName]);

  const updateMatch = (index, track) => {
    setMatches((prev) => {
      const next = prev.slice();
      next[index] = track;
      onTracksChange(next);
      return next;
    });
  };

  const matchedCount = matches.filter(Boolean).length;

  return (
    <div className="song-track-list">
      {loading ? (
        <p className="resolving-note">Matching songs to Spotify…</p>
      ) : (
        <p className="resolving-note">
          {matchedCount} of {songs.length} songs matched
        </p>
      )}
      <ol className="song-list">
        {songs.map((song, index) => (
          <SongRow
            key={index}
            song={song}
            index={index}
            track={matches[index] ?? null}
            onPick={updateMatch}
            onRemove={(i) => updateMatch(i, null)}
          />
        ))}
      </ol>
    </div>
  );
}
