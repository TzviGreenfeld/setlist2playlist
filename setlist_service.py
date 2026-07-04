from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from setlist_scraper import extract_song_titles, SetlistEvent

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

class ErrorResponse(BaseModel):
    detail: str

@app.get("/setlist/", response_model=SetlistResponse, responses={404: {"model": ErrorResponse}})
async def get_setlist(url: HttpUrl):
    """
    Fetch setlist information from a setlist.fm URL.

    Args:
        url: The setlist.fm URL to fetch data from

    Returns:
        SetlistResponse: The setlist information including artist, date, location, and setlist
    """
    setlist_event: Optional[SetlistEvent] = extract_song_titles(str(url))

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
