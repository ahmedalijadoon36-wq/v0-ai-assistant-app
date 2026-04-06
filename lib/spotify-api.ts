// Spotify Web API integration for Friday
// Uses OAuth 2.0 Authorization Code Flow with PKCE for user authentication

const SPOTIFY_API_BASE = "https://api.spotify.com/v1"
const SPOTIFY_AUTH_BASE = "https://accounts.spotify.com"

export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  uri: string
  duration_ms: number
  external_urls: { spotify: string }
}

export interface SpotifyPlaybackState {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
  device: {
    id: string
    name: string
    type: string
    volume_percent: number
  } | null
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number
}

// Generate authorization URL for Spotify OAuth
export function getSpotifyAuthUrl(redirectUri: string, state: string): string {
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "streaming",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read",
    "user-top-read",
    "user-read-recently-played",
  ]

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
  })

  return `${SPOTIFY_AUTH_BASE}/authorize?${params.toString()}`
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to exchange code for token")
  }

  return response.json()
}

// Refresh access token
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string
  expires_in: number
}> {
  const response = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to refresh token")
  }

  return response.json()
}

// Spotify API client class
export class SpotifyClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (response.status === 204) {
      return null
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Spotify API error: ${response.status}`)
    }

    return response.json()
  }

  // Get current playback state
  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    try {
      return await this.fetch("/me/player")
    } catch {
      return null
    }
  }

  // Get available devices
  async getDevices(): Promise<SpotifyDevice[]> {
    const response = await this.fetch("/me/player/devices")
    return response?.devices || []
  }

  // Play a track, album, playlist, or resume playback
  async play(options?: {
    uris?: string[]
    context_uri?: string
    device_id?: string
    position_ms?: number
  }): Promise<void> {
    await this.fetch("/me/player/play", {
      method: "PUT",
      body: options ? JSON.stringify(options) : undefined,
    })
  }

  // Pause playback
  async pause(): Promise<void> {
    await this.fetch("/me/player/pause", { method: "PUT" })
  }

  // Skip to next track
  async skipToNext(): Promise<void> {
    await this.fetch("/me/player/next", { method: "POST" })
  }

  // Skip to previous track
  async skipToPrevious(): Promise<void> {
    await this.fetch("/me/player/previous", { method: "POST" })
  }

  // Set volume (0-100)
  async setVolume(volumePercent: number): Promise<void> {
    await this.fetch(`/me/player/volume?volume_percent=${volumePercent}`, {
      method: "PUT",
    })
  }

  // Seek to position in track
  async seek(positionMs: number): Promise<void> {
    await this.fetch(`/me/player/seek?position_ms=${positionMs}`, {
      method: "PUT",
    })
  }

  // Toggle shuffle
  async setShuffle(state: boolean): Promise<void> {
    await this.fetch(`/me/player/shuffle?state=${state}`, {
      method: "PUT",
    })
  }

  // Set repeat mode
  async setRepeat(state: "track" | "context" | "off"): Promise<void> {
    await this.fetch(`/me/player/repeat?state=${state}`, {
      method: "PUT",
    })
  }

  // Search for tracks, artists, albums, or playlists
  async search(
    query: string,
    types: ("track" | "artist" | "album" | "playlist")[] = ["track"],
    limit = 10
  ): Promise<{
    tracks?: { items: SpotifyTrack[] }
    artists?: { items: any[] }
    albums?: { items: any[] }
    playlists?: { items: any[] }
  }> {
    const params = new URLSearchParams({
      q: query,
      type: types.join(","),
      limit: limit.toString(),
    })
    return this.fetch(`/search?${params.toString()}`)
  }

  // Get user's top tracks
  async getTopTracks(limit = 20): Promise<{ items: SpotifyTrack[] }> {
    return this.fetch(`/me/top/tracks?limit=${limit}`)
  }

  // Get recently played tracks
  async getRecentlyPlayed(limit = 20): Promise<{ items: { track: SpotifyTrack }[] }> {
    return this.fetch(`/me/player/recently-played?limit=${limit}`)
  }

  // Get user's playlists
  async getPlaylists(limit = 20): Promise<{ items: any[] }> {
    return this.fetch(`/me/playlists?limit=${limit}`)
  }

  // Transfer playback to a device
  async transferPlayback(deviceId: string, play = true): Promise<void> {
    await this.fetch("/me/player", {
      method: "PUT",
      body: JSON.stringify({
        device_ids: [deviceId],
        play,
      }),
    })
  }

  // Get track info
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    return this.fetch(`/tracks/${trackId}`)
  }

  // Get current user profile
  async getCurrentUser(): Promise<{
    id: string
    display_name: string
    email: string
    images: { url: string }[]
  }> {
    return this.fetch("/me")
  }
}
