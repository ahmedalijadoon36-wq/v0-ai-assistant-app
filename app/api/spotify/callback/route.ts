import { NextResponse } from "next/server"
import { exchangeCodeForToken } from "@/lib/spotify-api"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const origin = url.origin
  
  const cookieStore = await cookies()
  const storedState = cookieStore.get("spotify_auth_state")?.value
  
  // Check for errors
  if (error) {
    return NextResponse.redirect(`${origin}?spotify_error=${error}`)
  }
  
  // Validate state
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${origin}?spotify_error=state_mismatch`)
  }
  
  // Exchange code for tokens
  if (!code) {
    return NextResponse.redirect(`${origin}?spotify_error=no_code`)
  }
  
  try {
    const redirectUri = `${origin}/api/spotify/callback`
    const tokens = await exchangeCodeForToken(code, redirectUri)
    
    // Create response and set token cookies
    const response = NextResponse.redirect(`${origin}?spotify_connected=true`)
    
    // Store tokens in HTTP-only cookies
    response.cookies.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
    })
    
    response.cookies.set("spotify_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    
    response.cookies.set("spotify_token_expiry", String(Date.now() + tokens.expires_in * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    })
    
    // Clear the auth state cookie
    response.cookies.delete("spotify_auth_state")
    
    return response
  } catch {
    return NextResponse.redirect(`${origin}?spotify_error=token_exchange_failed`)
  }
}
