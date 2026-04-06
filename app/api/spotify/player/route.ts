import { NextResponse } from "next/server"
import { cookies } from "next/headers"

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  if (accessToken) {
    return accessToken
  }

  // Try to refresh
  if (refreshToken) {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) return null

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      })

      const data = await response.json()

      if (response.ok && data.access_token) {
        cookieStore.set("spotify_access_token", data.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: data.expires_in,
        })
        return data.access_token
      }
    } catch (error) {
      console.error("Token refresh error:", error)
    }
  }

  return null
}

// GET - Get current playback state
export async function GET() {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return NextResponse.json({ connected: false }, { status: 200 })
  }

  try {
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (response.status === 204) {
      return NextResponse.json({ connected: true, playing: false, noDevice: true })
    }

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ connected: false })
      }
      throw new Error("Failed to get playback state")
    }

    const data = await response.json()

    return NextResponse.json({
      connected: true,
      playing: data.is_playing,
      track: data.item ? {
        name: data.item.name,
        artist: data.item.artists?.map((a: { name: string }) => a.name).join(", "),
        album: data.item.album?.name,
        albumArt: data.item.album?.images?.[0]?.url,
        duration: data.item.duration_ms,
        progress: data.progress_ms,
      } : null,
      device: data.device?.name,
    })
  } catch (error) {
    console.error("Playback state error:", error)
    return NextResponse.json({ error: "Failed to get playback state" }, { status: 500 })
  }
}

// POST - Control playback (play, pause, skip, search & play)
export async function POST(req: Request) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 })
  }

  const { action, query, uri } = await req.json()

  try {
    let response: Response

    switch (action) {
      case "play":
        if (uri) {
          // Play specific track/album/playlist
          response = await fetch("https://api.spotify.com/v1/me/player/play", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(
              uri.includes("track") 
                ? { uris: [uri] } 
                : { context_uri: uri }
            ),
          })
        } else {
          // Resume playback
          response = await fetch("https://api.spotify.com/v1/me/player/play", {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        }
        break

      case "pause":
        response = await fetch("https://api.spotify.com/v1/me/player/pause", {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        break

      case "next":
        response = await fetch("https://api.spotify.com/v1/me/player/next", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        break

      case "previous":
        response = await fetch("https://api.spotify.com/v1/me/player/previous", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        break

      case "search":
        if (!query) {
          return NextResponse.json({ error: "Query required for search" }, { status: 400 })
        }

        // Search for tracks
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,artist,album&limit=5`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!searchResponse.ok) {
          throw new Error("Search failed")
        }

        const searchData = await searchResponse.json()

        return NextResponse.json({
          tracks: searchData.tracks?.items?.map((t: {
            name: string
            uri: string
            artists: Array<{ name: string }>
            album: { name: string; images: Array<{ url: string }> }
          }) => ({
            name: t.name,
            uri: t.uri,
            artist: t.artists?.map(a => a.name).join(", "),
            album: t.album?.name,
            albumArt: t.album?.images?.[0]?.url,
          })) || [],
          artists: searchData.artists?.items?.map((a: {
            name: string
            uri: string
            images: Array<{ url: string }>
          }) => ({
            name: a.name,
            uri: a.uri,
            image: a.images?.[0]?.url,
          })) || [],
        })

      case "searchAndPlay":
        if (!query) {
          return NextResponse.json({ error: "Query required" }, { status: 400 })
        }

        // Search for the track
        const findResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!findResponse.ok) {
          throw new Error("Search failed")
        }

        const findData = await findResponse.json()
        const track = findData.tracks?.items?.[0]

        if (!track) {
          return NextResponse.json({ error: "No tracks found", found: false })
        }

        // Play the found track
        response = await fetch("https://api.spotify.com/v1/me/player/play", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [track.uri] }),
        })

        if (response.status === 404) {
          return NextResponse.json({ 
            error: "No active device. Please open Spotify on a device first.", 
            found: true,
            track: {
              name: track.name,
              artist: track.artists?.map((a: { name: string }) => a.name).join(", "),
            }
          }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          found: true,
          track: {
            name: track.name,
            artist: track.artists?.map((a: { name: string }) => a.name).join(", "),
            album: track.album?.name,
          },
        })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (response!.status === 204 || response!.ok) {
      return NextResponse.json({ success: true })
    }

    if (response!.status === 404) {
      return NextResponse.json({ 
        error: "No active device. Please open Spotify on a device first." 
      }, { status: 404 })
    }

    const errorData = await response!.json().catch(() => ({}))
    throw new Error(errorData.error?.message || "Spotify API error")
  } catch (error) {
    console.error("Spotify player error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to control playback" 
    }, { status: 500 })
  }
}
