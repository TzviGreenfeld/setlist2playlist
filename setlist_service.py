from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from setlist_scraper import extract_song_titles, get_setlist_with_proxies, SetlistEvent

app = FastAPI(title="Setlist Scraper Service", version="1.0.0")

class SetlistResponse(BaseModel):
    artist: str
    date: str
    location: str
    setlist: List[str]

class ErrorResponse(BaseModel):
    detail: str

@app.get("/setlist/", response_model=SetlistResponse, responses={404: {"model": ErrorResponse}})
async def get_setlist(url: HttpUrl, use_proxies: bool = False):
    """
    Fetch setlist information from a setlist.fm URL.
    
    Args:
        url: The setlist.fm URL to fetch data from
        use_proxies: Whether to use proxies from valid-proxy.txt file
    
    Returns:
        SetlistResponse: The setlist information including artist, date, location, and setlist
    """
    setlist_event: Optional[SetlistEvent] = None
    
    if use_proxies:
        setlist_event = get_setlist_with_proxies(str(url))
    else:
        setlist_event = extract_song_titles(str(url))
        
    if not setlist_event:
        raise HTTPException(status_code=404, detail="Failed to fetch setlist data")
        
    return SetlistResponse(
        artist=setlist_event.artist,
        date=setlist_event.date,
        location=setlist_event.location,
        setlist=setlist_event.setlist
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
