import { NextResponse } from "next/server"
import { getSpotifyAuthUrl } from "@/lib/spotify-api"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const redirectUri = `${origin}/api/spotify/callback`
  
  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(7)
  
  const authUrl = getSpotifyAuthUrl(redirectUri, state)
  
  // Create response with state cookie
  const response = NextResponse.redirect(authUrl)
  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  })
  
  return response
}
