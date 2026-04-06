"use client"

import { useState, useEffect, useCallback } from "react"

interface SpotifyTrack {
  name: string
  artist: string
  album: string
  albumArt?: string
  duration?: number
  progress?: number
}

interface SpotifyState {
  connected: boolean
  playing: boolean
  track: SpotifyTrack | null
  device: string | null
  noDevice: boolean
}

interface SearchResult {
  tracks: Array<{
    name: string
    uri: string
    artist: string
    album: string
    albumArt?: string
  }>
  artists: Array<{
    name: string
    uri: string
    image?: string
  }>
}

export function useSpotify() {
  const [state, setState] = useState<SpotifyState>({
    connected: false,
    playing: false,
    track: null,
    device: null,
    noDevice: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/status")
      const data = await response.json()
      setState(prev => ({ ...prev, connected: data.connected }))
      return data.connected
    } catch {
      return false
    }
  }, [])

  const getPlaybackState = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/player")
      const data = await response.json()
      setState({
        connected: data.connected ?? false,
        playing: data.playing ?? false,
        track: data.track ?? null,
        device: data.device ?? null,
        noDevice: data.noDevice ?? false,
      })
      setError(null)
    } catch (err) {
      setError("Failed to get playback state")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const play = useCallback(async (uri?: string) => {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", uri }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return { success: false, error: data.error }
      }
      await getPlaybackState()
      return { success: true }
    } catch (err) {
      setError("Failed to play")
      return { success: false, error: "Failed to play" }
    }
  }, [getPlaybackState])

  const pause = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return { success: false, error: data.error }
      }
      await getPlaybackState()
      return { success: true }
    } catch (err) {
      setError("Failed to pause")
      return { success: false, error: "Failed to pause" }
    }
  }, [getPlaybackState])

  const next = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next" }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return { success: false, error: data.error }
      }
      setTimeout(getPlaybackState, 500) // Small delay to let Spotify update
      return { success: true }
    } catch (err) {
      setError("Failed to skip")
      return { success: false, error: "Failed to skip" }
    }
  }, [getPlaybackState])

  const previous = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "previous" }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return { success: false, error: data.error }
      }
      setTimeout(getPlaybackState, 500)
      return { success: true }
    } catch (err) {
      setError("Failed to go back")
      return { success: false, error: "Failed to go back" }
    }
  }, [getPlaybackState])

  const search = useCallback(async (query: string): Promise<SearchResult | null> => {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
        return null
      }
      return data as SearchResult
    } catch (err) {
      setError("Search failed")
      return null
    }
  }, [])

  const searchAndPlay = useCallback(async (query: string) => {
    try {
      setError(null)
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "searchAndPlay", query }),
      })
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return { success: false, error: data.error, track: data.track }
      }
      
      setTimeout(getPlaybackState, 500)
      return { success: true, track: data.track }
    } catch (err) {
      setError("Failed to search and play")
      return { success: false, error: "Failed to search and play" }
    }
  }, [getPlaybackState])

  const connect = useCallback(() => {
    window.location.href = "/api/spotify/auth"
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/spotify/status", { method: "DELETE" })
      setState({
        connected: false,
        playing: false,
        track: null,
        device: null,
        noDevice: false,
      })
    } catch (err) {
      console.error("Failed to disconnect:", err)
    }
  }, [])

  // Initial check
  useEffect(() => {
    const init = async () => {
      const connected = await checkStatus()
      if (connected) {
        await getPlaybackState()
      } else {
        setLoading(false)
      }
    }
    init()
  }, [checkStatus, getPlaybackState])

  // Poll for updates when connected and playing
  useEffect(() => {
    if (!state.connected || !state.playing) return

    const interval = setInterval(getPlaybackState, 5000)
    return () => clearInterval(interval)
  }, [state.connected, state.playing, getPlaybackState])

  return {
    ...state,
    loading,
    error,
    play,
    pause,
    next,
    previous,
    search,
    searchAndPlay,
    connect,
    disconnect,
    refresh: getPlaybackState,
  }
}
