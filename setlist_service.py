from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from setlist_scraper import (
    extract_song_titles,
    extract_average_setlist,
    is_average_setlist_url,
    search_setlists_by_artist,
    get_setlist_by_id,
    SetlistEvent,
    SetlistFmError,
)

app = FastAPI(title="Setlist Scraper Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SetlistResponse(BaseModel):
    artist: str
    date: str
    location: str
    setlist: List[str]

class SetlistSummary(BaseModel):
    id: str
    artist: str
    eventDate: str
    venue: str
    city: str
    location: str
    url: str
    songCount: int

class SearchResponse(BaseModel):
    setlists: List[SetlistSummary]
    total: int
    page: int
    artist: Optional[str] = None

class ErrorResponse(BaseModel):
    detail: str

@app.get("/setlist/", response_model=SetlistResponse, responses={404: {"model": ErrorResponse}})
async def get_setlist(url: HttpUrl):
    """
    Fetch setlist information from a setlist.fm URL.

    Accepts either a single-show setlist URL or an "average setlist" tour stats URL
    (``/stats/average-setlist/...``); the latter is scraped into a typical-show setlist.

    Args:
        url: The setlist.fm URL to fetch data from

    Returns:
        SetlistResponse: The setlist information including artist, date, location, and setlist
    """
    url_str = str(url)
    if is_average_setlist_url(url_str):
        setlist_event: Optional[SetlistEvent] = extract_average_setlist(url_str)
    else:
        setlist_event = extract_song_titles(url_str)

    if not setlist_event:
        raise HTTPException(status_code=404, detail="Failed to fetch setlist data")

    return SetlistResponse(
        artist=setlist_event.artist,
        date=setlist_event.date,
        location=setlist_event.location,
        setlist=setlist_event.setlist
    )

@app.get("/search/", response_model=SearchResponse, responses={503: {"model": ErrorResponse}})
async def search_setlists(artist: str, page: int = 1):
    """
    Search setlist.fm for an artist's shows.

    Args:
        artist: The artist name to search for
        page: Result page number (default 1)

    Returns:
        SearchResponse: Matching shows (date, venue, city) that contain songs
    """
    if not artist.strip():
        raise HTTPException(status_code=400, detail="Artist name is required")
    try:
        result = search_setlists_by_artist(artist.strip(), page)
    except SetlistFmError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return SearchResponse(**result)

@app.get("/setlist/{setlist_id}", response_model=SetlistResponse, responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
async def get_setlist_by_setlist_id(setlist_id: str):
    """
    Fetch a single setlist by its setlist.fm id.

    Args:
        setlist_id: The setlist.fm setlist id

    Returns:
        SetlistResponse: The setlist information
    """
    try:
        setlist_event: Optional[SetlistEvent] = get_setlist_by_id(setlist_id)
    except SetlistFmError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    if not setlist_event:
        raise HTTPException(status_code=404, detail="Setlist not found")

    return SetlistResponse(
        artist=setlist_event.artist,
        date=setlist_event.date,
        location=setlist_event.location,
        setlist=setlist_event.setlist
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
