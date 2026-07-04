import requests
from bs4 import BeautifulSoup
from typing import Optional


class SetlistEvent:
    def __init__(self, artist: str, date: str, location: str, setlist: list[str]):
        self.artist = artist
        self.date = date
        self.location = location
        self.setlist = setlist

    def __str__(self) -> str:
        return f"Artist: {self.artist}\nDate: {self.date}\nLocation: {self.location}\nSetlist: {', '.join(self.setlist)}"


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


if __name__ == "__main__":
    # Example usage
    target_url = "https://www.setlist.fm/setlist/lady-gaga/2025/empire-polo-club-indio-ca-35e0d6f.html"
    setlist_event = extract_song_titles(target_url)
    if setlist_event:
        print(setlist_event)
    else:
        print("Failed to fetch setlist data.")
