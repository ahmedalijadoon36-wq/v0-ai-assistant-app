"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface SoundCloudTrack {
  id: number
  title: string
  artist: string
  artworkUrl?: string
  duration: number
  streamUrl?: string
  permalinkUrl: string
}

interface SoundCloudState {
  playing: boolean
  track: SoundCloudTrack | null
  progress: number
  duration: number
  volume: number
}

declare global {
  interface Window {
    SC?: {
      Widget: {
        (iframe: HTMLIFrameElement): SoundCloudWidget
        Events: {
          READY: string
          PLAY: string
          PAUSE: string
          FINISH: string
          PLAY_PROGRESS: string
          ERROR: string
        }
      }
    }
  }
}

interface SoundCloudWidget {
  bind: (event: string, callback: (data?: unknown) => void) => void
  unbind: (event: string) => void
  load: (url: string, options?: { auto_play?: boolean; callback?: () => void }) => void
  play: () => void
  pause: () => void
  toggle: () => void
  seekTo: (ms: number) => void
  setVolume: (volume: number) => void
  getVolume: (callback: (volume: number) => void) => void
  getDuration: (callback: (duration: number) => void) => void
  getPosition: (callback: (position: number) => void) => void
  getCurrentSound: (callback: (sound: { title: string; user: { username: string }; artwork_url?: string; duration: number; permalink_url: string }) => void) => void
  isPaused: (callback: (paused: boolean) => void) => void
}

export function useSoundCloud() {
  const [state, setState] = useState<SoundCloudState>({
    playing: false,
    track: null,
    progress: 0,
    duration: 0,
    volume: 80,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [widgetReady, setWidgetReady] = useState(false)
  
  const widgetRef = useRef<SoundCloudWidget | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Initialize widget when iframe is set
  const initWidget = useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe) return
    
    iframeRef.current = iframe
    
    // Load SoundCloud Widget API if not loaded
    if (!window.SC) {
      const script = document.createElement("script")
      script.src = "https://w.soundcloud.com/player/api.js"
      script.async = true
      script.onload = () => {
        if (window.SC && iframeRef.current) {
          setupWidget(iframeRef.current)
        }
      }
      document.body.appendChild(script)
    } else {
      setupWidget(iframe)
    }
  }, [])

  const setupWidget = useCallback((iframe: HTMLIFrameElement) => {
    if (!window.SC) return
    
    const widget = window.SC.Widget(iframe)
    widgetRef.current = widget

    widget.bind(window.SC.Widget.Events.READY, () => {
      setWidgetReady(true)
      widget.setVolume(state.volume)
    })

    widget.bind(window.SC.Widget.Events.PLAY, () => {
      setState(prev => ({ ...prev, playing: true }))
      widget.getCurrentSound((sound) => {
        if (sound) {
          setState(prev => ({
            ...prev,
            track: {
              id: 0,
              title: sound.title,
              artist: sound.user?.username || "Unknown Artist",
              artworkUrl: sound.artwork_url?.replace("-large", "-t300x300"),
              duration: sound.duration,
              permalinkUrl: sound.permalink_url,
            },
          }))
        }
      })
    })

    widget.bind(window.SC.Widget.Events.PAUSE, () => {
      setState(prev => ({ ...prev, playing: false }))
    })

    widget.bind(window.SC.Widget.Events.FINISH, () => {
      setState(prev => ({ ...prev, playing: false, progress: 0 }))
    })

    widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data: unknown) => {
      const progressData = data as { currentPosition: number; relativePosition: number }
      setState(prev => ({ ...prev, progress: progressData.currentPosition }))
    })

    widget.bind(window.SC.Widget.Events.ERROR, () => {
      setError("Failed to load track")
      setState(prev => ({ ...prev, playing: false }))
    })
  }, [state.volume])

  const searchAndPlay = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // Search via our API
      const response = await fetch("/api/soundcloud/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return { success: false, error: data.error }
      }
      
      if (!data.tracks || data.tracks.length === 0) {
        setError("No tracks found")
        setLoading(false)
        return { success: false, error: "No tracks found for: " + query }
      }
      
      const track = data.tracks[0]
      
      // Load track in widget
      if (widgetRef.current && track.permalinkUrl) {
        widgetRef.current.load(track.permalinkUrl, {
          auto_play: true,
          callback: () => {
            setLoading(false)
            setState(prev => ({
              ...prev,
              track: {
                id: track.id,
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl,
                duration: track.duration,
                permalinkUrl: track.permalinkUrl,
              },
              playing: true,
            }))
          },
        })
        
        return { 
          success: true, 
          track: {
            name: track.title,
            artist: track.artist,
          }
        }
      } else {
        setError("Player not ready")
        setLoading(false)
        return { success: false, error: "Player not ready" }
      }
    } catch (err) {
      console.error("Search failed:", err)
      setError("Search failed")
      setLoading(false)
      return { success: false, error: "Search failed" }
    }
  }, [])

  const play = useCallback(() => {
    if (widgetRef.current) {
      widgetRef.current.play()
      return { success: true }
    }
    return { success: false, error: "Player not ready" }
  }, [])

  const pause = useCallback(() => {
    if (widgetRef.current) {
      widgetRef.current.pause()
      return { success: true }
    }
    return { success: false, error: "Player not ready" }
  }, [])

  const toggle = useCallback(() => {
    if (widgetRef.current) {
      widgetRef.current.toggle()
      return { success: true }
    }
    return { success: false, error: "Player not ready" }
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (widgetRef.current) {
      widgetRef.current.setVolume(volume)
      setState(prev => ({ ...prev, volume }))
    }
  }, [])

  const seekTo = useCallback((position: number) => {
    if (widgetRef.current) {
      widgetRef.current.seekTo(position)
    }
  }, [])

  // These are stubs since SoundCloud widget doesn't have playlist controls by default
  const next = useCallback(async () => {
    return { success: false, error: "SoundCloud widget does not support next track" }
  }, [])

  const previous = useCallback(async () => {
    return { success: false, error: "SoundCloud widget does not support previous track" }
  }, [])

  return {
    ...state,
    loading,
    error,
    widgetReady,
    connected: widgetReady,
    initWidget,
    searchAndPlay,
    play,
    pause,
    toggle,
    next,
    previous,
    setVolume,
    seekTo,
  }
}
