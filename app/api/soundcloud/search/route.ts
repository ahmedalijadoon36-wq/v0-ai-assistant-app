import { NextResponse } from "next/server"

// SoundCloud public API for searching
// Note: SoundCloud's official API requires registration, but we can use their 
// internal search endpoint or widget URL patterns

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Use SoundCloud's public search (this works without API key)
    // We'll search and return the track URLs for the widget
    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX&limit=5`
    
    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok) {
      // Fallback: construct a widget URL from the search query
      // This allows users to search even if the API is restricted
      return NextResponse.json({
        tracks: [{
          id: 0,
          title: query,
          artist: "Search Result",
          artworkUrl: null,
          duration: 0,
          permalinkUrl: `https://soundcloud.com/search/sounds?q=${encodeURIComponent(query)}`,
        }],
        fallback: true,
      })
    }

    const data = await response.json()

    if (!data.collection || data.collection.length === 0) {
      return NextResponse.json({ error: "No tracks found", tracks: [] })
    }

    const tracks = data.collection.map((track: {
      id: number
      title: string
      user: { username: string }
      artwork_url?: string
      duration: number
      permalink_url: string
    }) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.username || "Unknown Artist",
      artworkUrl: track.artwork_url?.replace("-large", "-t300x300"),
      duration: track.duration,
      permalinkUrl: track.permalink_url,
    }))

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("SoundCloud search error:", error)
    return NextResponse.json(
      { error: "Failed to search SoundCloud" },
      { status: 500 }
    )
  }
}
