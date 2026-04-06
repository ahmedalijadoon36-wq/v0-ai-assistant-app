import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  return NextResponse.json({
    connected: !!(accessToken || refreshToken),
  })
}

// DELETE - Disconnect Spotify
export async function DELETE() {
  const cookieStore = await cookies()
  
  cookieStore.delete("spotify_access_token")
  cookieStore.delete("spotify_refresh_token")

  return NextResponse.json({ disconnected: true })
}
