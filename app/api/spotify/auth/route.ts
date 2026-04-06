import { NextResponse } from "next/server"

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "app-remote-control",
  "user-library-read",
  "user-library-modify",
].join(" ")

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  
  if (!clientId) {
    return NextResponse.json({ error: "Spotify not configured" }, { status: 500 })
  }

  // Use the current origin for redirect
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/spotify/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    show_dialog: "true",
  })

  return NextResponse.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`)
}
