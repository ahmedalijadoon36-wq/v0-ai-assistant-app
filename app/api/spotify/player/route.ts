import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SpotifyClient, refreshAccessToken } from "@/lib/spotify-api"

// Helper to get authenticated Spotify client
async function getSpotifyClient() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value
  const tokenExpiry = cookieStore.get("spotify_token_expiry")?.value

  if (!accessToken && !refreshToken) {
    return { client: null, error: "Not authenticated with Spotify" }
  }

  // Check if token is expired or about to expire
  if (tokenExpiry && Date.now() > parseInt(tokenExpiry) - 60000) {
    if (refreshToken) {
      try {
        const tokens = await refreshAccessToken(refreshToken)
        accessToken = tokens.access_token
        // Note: In a real app, you'd want to update the cookies here
        // For now, the client will need to re-authenticate
      } catch {
        return { client: null, error: "Token refresh failed" }
      }
    }
  }

  if (!accessToken) {
    return { client: null, error: "No access token available" }
  }

  return { client: new SpotifyClient(accessToken), error: null }
}

// GET - Get current playback state
export async function GET() {
  const { client, error } = await getSpotifyClient()

  if (!client) {
    return NextResponse.json({ error, authenticated: false }, { status: 401 })
  }

  try {
    const [playback, devices] = await Promise.all([
      client.getPlaybackState(),
      client.getDevices(),
    ])

    return NextResponse.json({
      authenticated: true,
      playback,
      devices,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get playback" },
      { status: 500 }
    )
  }
}

// POST - Control playback
export async function POST(req: Request) {
  const { client, error } = await getSpotifyClient()

  if (!client) {
    return NextResponse.json({ error, authenticated: false }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action, ...params } = body

    switch (action) {
      case "play":
        if (params.query) {
          // Search for tracks and play the first result
          const searchResults = await client.search(params.query, ["track"], 1)
          const track = searchResults.tracks?.items[0]
          if (track) {
            await client.play({ uris: [track.uri] })
            return NextResponse.json({
              success: true,
              message: `Now playing: ${track.name} by ${track.artists[0].name}`,
              track,
            })
          }
          return NextResponse.json({ error: "No tracks found" }, { status: 404 })
        }
        await client.play(params)
        return NextResponse.json({ success: true, message: "Playback resumed" })

      case "pause":
        await client.pause()
        return NextResponse.json({ success: true, message: "Playback paused" })

      case "next":
        await client.skipToNext()
        return NextResponse.json({ success: true, message: "Skipped to next track" })

      case "previous":
        await client.skipToPrevious()
        return NextResponse.json({ success: true, message: "Skipped to previous track" })

      case "volume":
        await client.setVolume(params.volume)
        return NextResponse.json({ success: true, message: `Volume set to ${params.volume}%` })

      case "seek":
        await client.seek(params.position_ms)
        return NextResponse.json({ success: true, message: "Seeked to position" })

      case "shuffle":
        await client.setShuffle(params.state)
        return NextResponse.json({ success: true, message: `Shuffle ${params.state ? "on" : "off"}` })

      case "repeat":
        await client.setRepeat(params.state)
        return NextResponse.json({ success: true, message: `Repeat mode: ${params.state}` })

      case "transfer":
        await client.transferPlayback(params.device_id, params.play)
        return NextResponse.json({ success: true, message: "Playback transferred" })

      case "search":
        const results = await client.search(
          params.query,
          params.types || ["track"],
          params.limit || 10
        )
        return NextResponse.json({ success: true, results })

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Playback control failed" },
      { status: 500 }
    )
  }
}
