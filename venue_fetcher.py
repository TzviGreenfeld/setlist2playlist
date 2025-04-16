import requests
from bs4 import BeautifulSoup
from typing import Optional

class Venue:
    def __init__(self, artist: str, date: str, location: str, setlist: list[str]):
        self.artist = artist
        self.date = date
        self.location = location
        self.setlist = setlist

    def __str__(self) -> str:
        return f"Artist: {self.artist}\nDate: {self.date}\nLocation: {self.location}\nSetlist: {', '.join(self.setlist)}"

def extract_song_titles(url: str, proxy: Optional[dict[str, str]] = None) -> Optional[Venue]:
    """
    Fetches the HTML content from a given URL, extracts the text from all <a>
    elements with the class 'songLabel', stores them in a list, and prints the list.

    Args:
        url (str): The URL of the webpage to scrape.
        proxy (Optional[dict[str, str]]): Optional proxy configuration.

    Returns:
        Optional[Venue]: A Venue object containing the extracted data, or None if an error occurs.
    """
    try:
        response = requests.get(url, proxies=proxy)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

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

        # Extract artist name
        artist_tag = soup.select_one(".setlistHeadline h1 strong span a span")
        artist = artist_tag.text if artist_tag else ""

        # Extract location
        location_tag = soup.select_one(".setlistHeadline h1 span span a span")
        location = location_tag.text if location_tag else ""

        return Venue(artist, date, location, song_titles)

    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

def get_proxies_from_file(file_path: str) -> list[str]:
    proxies = []
    with open(file_path, 'r') as f:
        proxies = f.read().splitlines()
    return proxies

def get_venue_with_proxies(target_url: str) -> Optional[Venue]:
    for proxy in get_proxies_from_file('valid-proxy.txt'):
        proxy_dict = {'http': proxy, 'https': proxy}
        venue = extract_song_titles(target_url, proxy=proxy_dict)
        if venue:
            return venue
        else:
            print(f"Failed to fetch data using proxy: {proxy}\n")
    return None


if __name__ == "__main__":
    target_url = "https://www.setlist.fm/setlist/lady-gaga/2025/empire-polo-club-indio-ca-35e0d6f.html"
    venue = get_venue_with_proxies(target_url)
    if venue:
        print(venue)
    else:
        print("Failed to fetch venue data with all proxies.")