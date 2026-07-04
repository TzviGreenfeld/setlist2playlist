import os
import re
import requests
from bs4 import BeautifulSoup
from typing import Optional


SETLIST_FM_API_BASE = "https://api.setlist.fm/rest/1.0"


class SetlistFmError(Exception):
    """Raised when the setlist.fm API cannot be reached or returns an error."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class SetlistEvent:
    def __init__(self, artist: str, date: str, location: str, setlist: list[str]):
        self.artist = artist
        self.date = date
        self.location = location
        self.setlist = setlist

    def __str__(self) -> str:
        return f"Artist: {self.artist}\nDate: {self.date}\nLocation: {self.location}\nSetlist: {', '.join(self.setlist)}"


def _api_headers() -> dict:
    api_key = os.environ.get("SETLIST_FM_API_KEY")
    if not api_key:
        raise SetlistFmError(
            "Search is not configured: SETLIST_FM_API_KEY is not set on the server.",
            status_code=503,
        )
    return {"x-api-key": api_key, "Accept": "application/json"}


def _flatten_songs(sets: dict) -> list[str]:
    songs = []
    for set_ in (sets or {}).get("set", []):
        for song in set_.get("song", []):
            name = song.get("name")
            if name:
                songs.append(name)
    return songs


def _setlist_to_summary(item: dict) -> dict:
    venue = item.get("venue") or {}
    city = venue.get("city") or {}
    country = (city.get("country") or {}).get("name", "")
    location_parts = [p for p in (venue.get("name"), city.get("name"), country) if p]
    return {
        "id": item.get("id", ""),
        "artist": (item.get("artist") or {}).get("name", ""),
        "eventDate": item.get("eventDate", ""),
        "venue": venue.get("name", ""),
        "city": city.get("name", ""),
        "location": ", ".join(location_parts),
        "url": item.get("url", ""),
        "songCount": len(_flatten_songs(item.get("sets") or {})),
    }


def search_artists(artist_name: str) -> list[dict]:
    """Search setlist.fm for artists by name, ranked by relevance.

    Returns a list of {mbid, name, disambiguation} dicts (best match first).
    """
    try:
        response = requests.get(
            f"{SETLIST_FM_API_BASE}/search/artists",
            headers=_api_headers(),
            params={"artistName": artist_name, "sort": "relevance", "p": 1},
            timeout=10,
        )
    except requests.exceptions.RequestException as e:
        raise SetlistFmError(f"Could not reach setlist.fm: {e}")

    if response.status_code == 404:
        return []
    if response.status_code == 429:
        raise SetlistFmError("setlist.fm rate limit reached, please try again shortly.", status_code=429)
    if not response.ok:
        raise SetlistFmError(f"setlist.fm returned an error (HTTP {response.status_code}).")

    data = response.json()
    artists = []
    for a in data.get("artist", []):
        mbid = a.get("mbid")
        if not mbid:
            continue
        artists.append({
            "mbid": mbid,
            "name": a.get("name", ""),
            "disambiguation": a.get("disambiguation", ""),
        })
    return artists


def _fetch_artist_setlists(mbid: str, page: int) -> dict:
    try:
        response = requests.get(
            f"{SETLIST_FM_API_BASE}/artist/{mbid}/setlists",
            headers=_api_headers(),
            params={"p": page},
            timeout=10,
        )
    except requests.exceptions.RequestException as e:
        raise SetlistFmError(f"Could not reach setlist.fm: {e}")

    if response.status_code == 404:
        return {"setlist": [], "total": 0, "page": page}
    if response.status_code == 429:
        raise SetlistFmError("setlist.fm rate limit reached, please try again shortly.", status_code=429)
    if not response.ok:
        raise SetlistFmError(f"setlist.fm returned an error (HTTP {response.status_code}).")
    return response.json()


def search_setlists_by_artist(artist_name: str, page: int = 1) -> dict:
    """Find an artist by name, then return that artist's setlists.

    Resolves the artist via the relevance-ranked artist search first (so
    "radiohead" returns the real band, not a tribute act), then fetches that
    specific artist's shows. Only setlists that contain songs are returned, so
    the user never picks an empty show.
    """
    artists = search_artists(artist_name)
    if not artists:
        return {"setlists": [], "total": 0, "page": page, "artist": None}

    best = artists[0]
    data = _fetch_artist_setlists(best["mbid"], page)

    summaries = [_setlist_to_summary(item) for item in data.get("setlist", [])]
    summaries = [s for s in summaries if s["songCount"] > 0]
    return {
        "setlists": summaries,
        "total": data.get("total", len(summaries)),
        "page": data.get("page", page),
        "artist": best["name"],
    }


def get_setlist_by_id(setlist_id: str) -> Optional[SetlistEvent]:
    """Fetch a single setlist by its setlist.fm id and return a SetlistEvent."""
    try:
        response = requests.get(
            f"{SETLIST_FM_API_BASE}/setlist/{setlist_id}",
            headers=_api_headers(),
            timeout=10,
        )
    except requests.exceptions.RequestException as e:
        raise SetlistFmError(f"Could not reach setlist.fm: {e}")

    if response.status_code == 404:
        return None
    if response.status_code == 429:
        raise SetlistFmError("setlist.fm rate limit reached, please try again shortly.", status_code=429)
    if not response.ok:
        raise SetlistFmError(f"setlist.fm returned an error (HTTP {response.status_code}).")

    item = response.json()
    summary = _setlist_to_summary(item)
    return SetlistEvent(
        artist=summary["artist"],
        date=summary["eventDate"],
        location=summary["location"],
        setlist=_flatten_songs(item.get("sets") or {}),
    )


def extract_song_titles(url: str) -> Optional[SetlistEvent]:
    """
    Fetches the HTML content from a given URL, extracts the text from all <a>
    elements with the class 'songLabel', stores them in a list, and prints the list.

    Args:
        url (str): The URL of the webpage to scrape.

    Returns:
        Optional[SetlistEvent]: A SetlistEvent object containing the extracted data, or None if an error occurs.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

        soup = BeautifulSoup(response.text, 'html.parser')

        # Find all <a> elements with class 'songLabel'
        song_links = soup.find_all('a', class_='songLabel')

        # Extract songs
        song_titles = []
        if song_links:
            for link in song_links:
                song_titles.append(link.get_text(strip=True))

        month = soup.find("span", class_="month").text
        day = soup.find("span", class_="day").text
        year = soup.find("span", class_="year").text
        date = f"{month} {day}, {year}"

        # Extract artist name (support both current and legacy markup)
        artist_tag = (
            soup.select_one(".setlistHeadline h1 strong a")
            or soup.select_one(".setlistHeadline h1 strong span a span")
            or soup.select_one(".setlistHeadline h1 strong")
        )
        artist = artist_tag.get_text(strip=True) if artist_tag else ""

        # Extract location (support both current and legacy markup)
        location_tag = (
            soup.select_one(".setlistHeadline h1 span a span")
            or soup.select_one(".setlistHeadline h1 span a")
            or soup.select_one(".setlistHeadline h1 span span a span")
        )
        location = location_tag.get_text(strip=True) if location_tag else ""

        return SetlistEvent(artist, date, location, song_titles)

    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


def is_average_setlist_url(url: str) -> bool:
    """Return True if the URL is a setlist.fm 'average setlist' stats page."""
    return "/stats/average-setlist/" in url


def extract_average_setlist(url: str) -> Optional[SetlistEvent]:
    """Scrape a setlist.fm 'average setlist' (tour stats) page into a SetlistEvent.

    The setlist.fm REST API has no average-setlist endpoint and cannot resolve the
    page's internal ``?tour=<id>`` value, so these pages are scraped directly.

    The average page lists songs (some repeated). Songs are de-duplicated while
    preserving order. The tour name is used as the event location; there is no single
    date for a tour average, so ``date`` is left blank.

    Returns:
        Optional[SetlistEvent]: parsed event, or None on error / empty result.
    """
    try:
        # The stats page returns 403 without a browser-like User-Agent.
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; setlist2playlist/1.0)"},
            timeout=15,
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract songs and de-duplicate while preserving order.
        song_titles = []
        seen = set()
        for link in soup.find_all("a", class_="songLabel"):
            name = link.get_text(strip=True)
            if name and name not in seen:
                seen.add(name)
                song_titles.append(name)

        if not song_titles:
            return None

        # Artist from <title>: "Ye Average Setlists of tour: ..." -> "Ye"
        artist = ""
        title_tag = soup.find("title")
        if title_tag:
            m = re.match(r"(.+?)\s+Average Setlists?", title_tag.get_text(strip=True))
            if m:
                artist = m.group(1).strip()

        # Tour from <h1>: "Average setlist for tour: LIVE CONCERT TOUR 2O26"
        tour = ""
        h1_tag = soup.find("h1")
        if h1_tag:
            mt = re.search(r"tour:\s*(.+)$", h1_tag.get_text(" ", strip=True))
            if mt:
                tour = mt.group(1).strip()

        return SetlistEvent(artist=artist, date="", location=tour, setlist=song_titles)

    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


if __name__ == "__main__":
    # Example usage
    target_url = "https://www.setlist.fm/setlist/lady-gaga/2025/empire-polo-club-indio-ca-35e0d6f.html"
    setlist_event = extract_song_titles(target_url)
    if setlist_event:
        print(setlist_event)
    else:
        print("Failed to fetch setlist data.")
