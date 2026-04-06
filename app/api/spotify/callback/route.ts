import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL("/?spotify_error=" + error, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?spotify_error=no_code", request.url))
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  
  // Get the host from headers to build the redirect URL dynamically
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = headersList.get("x-forwarded-proto") || "http"
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
  const redirectUri = `${baseUrl}/api/spotify/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?spotify_error=not_configured", request.url))
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Spotify token error:", data)
      return NextResponse.redirect(new URL("/?spotify_error=token_failed", request.url))
    }

    // Store tokens in cookies (httpOnly for security)
    const cookieStore = await cookies()
    
    cookieStore.set("spotify_access_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: data.expires_in,
    })

    cookieStore.set("spotify_refresh_token", data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.redirect(new URL("/?spotify_connected=true", request.url))
  } catch (error) {
    console.error("Spotify callback error:", error)
    return NextResponse.redirect(new URL("/?spotify_error=callback_failed", request.url))
  }
}
