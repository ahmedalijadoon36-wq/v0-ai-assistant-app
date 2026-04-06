"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useChat } from "ai/react"
import { AnimatedOrb, type OrbState } from "./animated-orb"
import { TranscriptDisplay } from "./transcript-display"
import { StatusIndicator } from "./status-indicator"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useAudioPlayback } from "@/hooks/use-audio-playback"

// Extended PC Action type to include Spotify API
interface PCAction {
  action: "openUrl" | "notification" | "spotifyApi"
  url?: string
  message: string
  apiAction?: string
  query?: string
  volume?: number
  state?: boolean
}

// Keywords that indicate the user wants current information
const SEARCH_KEYWORDS = [
  "current",
  "latest",
  "today",
  "now",
  "recent",
  "news",
  "weather",
  "price",
  "stock",
  "score",
  "update",
  "happening",
  "2024",
  "2025",
  "2026",
]

function shouldSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  return SEARCH_KEYWORDS.some((keyword) => lowerQuery.includes(keyword))
}

// Execute PC actions based on tool results
async function executeAction(
  action: PCAction,
  onSpotifyAuthNeeded: () => void,
  onSpotifyResult?: (result: { success?: boolean; message?: string; error?: string; track?: unknown }) => void
) {
  if (action.action === "openUrl" && action.url) {
    // Open the URL in a new tab
    window.open(action.url, "_blank", "noopener,noreferrer")
    return { success: true, message: action.message }
  }
  
  if (action.action === "spotifyApi") {
    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action.apiAction,
          query: action.query,
          volume: action.volume,
          state: action.state,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        if (result.authenticated === false) {
          // Need to connect Spotify
          onSpotifyAuthNeeded()
          return { success: false, message: "Please connect your Spotify account first" }
        }
        return { success: false, message: result.error || "Spotify action failed" }
      }
      
      if (onSpotifyResult) {
        onSpotifyResult(result)
      }
      
      return result
    } catch (error) {
      console.error("Spotify API error:", error)
      return { success: false, message: "Failed to connect to Spotify" }
    }
  }
  
  return { success: true, message: action.message }
}

export function FridayAssistant() {
  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [audioLevel, setAudioLevel] = useState(0)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })
  const [searchResults, setSearchResults] = useState<Array<{
    title: string
    snippet: string
    link: string
  }> | null>(null)
  const [actionMessages, setActionMessages] = useState<string[]>([])
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null)
  const [showSpotifyPrompt, setShowSpotifyPrompt] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<{
    name: string
    artist: string
    albumArt?: string
  } | null>(null)
  const pendingQueryRef = useRef<string | null>(null)
  const processedToolCallsRef = useRef<Set<string>>(new Set())

  // Check Spotify connection status on mount
  useEffect(() => {
    const checkSpotify = async () => {
      try {
        const response = await fetch("/api/spotify/player")
        const data = await response.json()
        setSpotifyConnected(data.authenticated === true)
        if (data.playback?.item) {
          setCurrentTrack({
            name: data.playback.item.name,
            artist: data.playback.item.artists[0]?.name || "Unknown",
            albumArt: data.playback.item.album?.images[0]?.url,
          })
        }
      } catch {
        setSpotifyConnected(false)
      }
    }
    
    // Check URL params for Spotify auth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get("spotify_connected") === "true") {
      setSpotifyConnected(true)
      setShowSpotifyPrompt(false)
      setActionMessages((prev) => [...prev, "Spotify connected successfully!"])
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname)
    } else if (params.get("spotify_error")) {
      setActionMessages((prev) => [...prev, "Failed to connect Spotify"])
      window.history.replaceState({}, "", window.location.pathname)
    }
    
    checkSpotify()
  }, [])

  const handleSpotifyAuthNeeded = useCallback(() => {
    setShowSpotifyPrompt(true)
  }, [])

  const connectSpotify = useCallback(() => {
    window.location.href = "/api/spotify/auth"
  }, [])

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
    body: { searchResults },
    onFinish: (message) => {
      // Play the response
      if (message.role === "assistant" && message.content) {
        playAudio(message.content)
      }
    },
    onToolCall: ({ toolCall }) => {
      // Check if we've already processed this tool call
      const toolCallId = `${toolCall.toolName}-${JSON.stringify(toolCall.args)}`
      if (processedToolCallsRef.current.has(toolCallId)) {
        return
      }
      processedToolCallsRef.current.add(toolCallId)
      
      // Clear old tool calls after 5 seconds
      setTimeout(() => {
        processedToolCallsRef.current.delete(toolCallId)
      }, 5000)
    },
  })

  // Process tool invocations from messages
  useEffect(() => {
    messages.forEach((message) => {
      if (message.role === "assistant" && message.toolInvocations) {
        message.toolInvocations.forEach((invocation) => {
          if (invocation.state === "result" && invocation.result) {
            const result = invocation.result as PCAction
            if (result.action) {
              // Create a unique key for this invocation
              const invocationKey = `${message.id}-${invocation.toolCallId}`
              if (!processedToolCallsRef.current.has(invocationKey)) {
                processedToolCallsRef.current.add(invocationKey)
                
                // Execute the action (async)
                executeAction(
                  result,
                  handleSpotifyAuthNeeded,
                  (spotifyResult) => {
                    // Update current track if available
                    if (spotifyResult.track) {
                      const track = spotifyResult.track as { 
                        name: string
                        artists: { name: string }[]
                        album?: { images: { url: string }[] }
                      }
                      setCurrentTrack({
                        name: track.name,
                        artist: track.artists[0]?.name || "Unknown",
                        albumArt: track.album?.images[0]?.url,
                      })
                    }
                  }
                ).then((actionResult) => {
                  // Show action message
                  const msg = actionResult?.message || result.message
                  setActionMessages((prev) => [...prev, msg])
                  setTimeout(() => {
                    setActionMessages((prev) => prev.filter((m) => m !== msg))
                  }, 3000)
                })
              }
            }
          }
        })
      }
    })
  }, [messages, handleSpotifyAuthNeeded])

  const handleVoiceResult = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return

      setOrbState("processing")

      // Check if we need to search
      if (shouldSearch(transcript)) {
        try {
          const response = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: transcript }),
          })
          const data = await response.json()
          if (data.results) {
            setSearchResults(data.results)
          }
        } catch (error) {
          console.error("Search failed:", error)
        }
      } else {
        setSearchResults(null)
      }

      // Store the query and let useEffect handle the append
      pendingQueryRef.current = transcript
    },
    []
  )

  // Handle appending message after searchResults is updated
  useEffect(() => {
    if (pendingQueryRef.current) {
      const query = pendingQueryRef.current
      pendingQueryRef.current = null
      append({
        role: "user",
        content: query,
      })
    }
  }, [searchResults, append])

  const handleWakeWord = useCallback(() => {
    setOrbState("listening")
  }, [])

  const { isListening, transcript, isSupported, startListening, stopListening } =
    useSpeechRecognition({
      onResult: handleVoiceResult,
      onWakeWord: handleWakeWord,
      wakeWord: "friday",
      continuous: wakeWordEnabled,
    })

  const { isPlaying, playAudio, stopAudio } = useAudioPlayback({
    onStart: () => setOrbState("speaking"),
    onEnd: () => setOrbState(wakeWordEnabled ? "idle" : "idle"),
    onAudioLevel: setAudioLevel,
  })

  // Mouse tracking for orb control
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth
      const y = e.clientY / window.innerHeight
      setMousePosition({ x, y })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Update orb state based on loading
  useEffect(() => {
    if (isLoading) {
      setOrbState("processing")
    } else if (!isPlaying && !isListening) {
      setOrbState("idle")
    }
  }, [isLoading, isPlaying, isListening])

  // Update orb state based on listening
  useEffect(() => {
    if (isListening && !isPlaying && !isLoading) {
      setOrbState("listening")
    }
  }, [isListening, isPlaying, isLoading])

  const handleOrbClick = useCallback(() => {
    if (!isSupported) {
      alert("Speech recognition is not supported in your browser. Please use Chrome.")
      return
    }

    if (isPlaying) {
      stopAudio()
      return
    }

    if (isListening && !wakeWordEnabled) {
      stopListening()
      return
    }

    if (!wakeWordEnabled) {
      startListening()
    }
  }, [
    isSupported,
    isPlaying,
    isListening,
    wakeWordEnabled,
    startListening,
    stopListening,
    stopAudio,
  ])

  const toggleWakeWord = useCallback(() => {
    if (wakeWordEnabled) {
      stopListening()
      setWakeWordEnabled(false)
    } else {
      setWakeWordEnabled(true)
      startListening()
    }
  }, [wakeWordEnabled, startListening, stopListening])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 26, 26, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 26, 26, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.8) 100%)",
        }}
      />

      {/* Action notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {actionMessages.map((message, index) => (
          <div
            key={index}
            className="px-4 py-2 rounded-lg bg-primary/90 text-primary-foreground text-sm animate-in slide-in-from-right fade-in duration-300"
          >
            {message}
          </div>
        ))}
      </div>

      {/* Spotify connection status */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        {spotifyConnected === true ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span>Spotify Connected</span>
            {currentTrack && (
              <span className="text-xs opacity-70 ml-2 max-w-[150px] truncate">
                {currentTrack.name} - {currentTrack.artist}
              </span>
            )}
          </div>
        ) : spotifyConnected === false ? (
          <button
            onClick={connectSpotify}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/30 text-[#1DB954] text-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span>Connect Spotify</span>
          </button>
        ) : null}
      </div>

      {/* Spotify auth prompt modal */}
      {showSpotifyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#1DB954]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Connect Spotify</h3>
                <p className="text-sm text-muted-foreground">Required for music control</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              To play music and control Spotify, Friday needs access to your Spotify account. This allows voice commands like &quot;play some jazz&quot; or &quot;skip this song&quot;.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSpotifyPrompt(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Not Now
              </button>
              <button
                onClick={connectSpotify}
                className="flex-1 px-4 py-2 rounded-lg bg-[#1DB954] text-white hover:bg-[#1ed760] transition-colors"
              >
                Connect Spotify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        {/* Title */}
        <h1 className="text-4xl font-bold text-foreground mb-2 tracking-wider">
          F.R.I.D.A.Y.
        </h1>
        <p className="text-muted-foreground text-sm mb-12">
          Female Replacement Intelligent Digital Assistant Youth
        </p>

        {/* Transcript display - above orb */}
        <div className="w-full max-w-2xl mb-8 min-h-[120px]">
          <TranscriptDisplay
            messages={messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))}
            isTyping={isLoading}
          />
        </div>

        {/* Animated Orb */}
        <button
          onClick={handleOrbClick}
          className="relative cursor-pointer focus:outline-none transition-transform hover:scale-105 active:scale-95"
          aria-label={
            isListening
              ? "Stop listening"
              : isPlaying
                ? "Stop speaking"
                : "Start listening"
          }
        >
          <AnimatedOrb 
            state={orbState} 
            audioLevel={audioLevel} 
            mouseX={mousePosition.x}
            mouseY={mousePosition.y}
          />
        </button>

        {/* Live transcript while listening */}
        {transcript && (
          <div className="mt-6 px-4 py-2 rounded-lg bg-secondary/30 border border-border max-w-md">
            <p className="text-sm text-muted-foreground">{transcript}</p>
          </div>
        )}

        {/* Status indicator */}
        <div className="mt-8">
          <StatusIndicator
            state={orbState}
            wakeWordEnabled={wakeWordEnabled}
            onToggleWakeWord={toggleWakeWord}
          />
        </div>

        {/* Hint */}
        <p className="mt-4 text-xs text-muted-foreground text-center max-w-md">
          {spotifyConnected 
            ? 'Try saying "Play some jazz music", "Skip this song", "Search Google for...", or "Open YouTube"'
            : 'Click the orb to start. Connect Spotify for music control, or try "Search Google for..."'}
        </p>

        {/* Capabilities hint */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
          {["Spotify", "YouTube", "Google", "Gmail", "Maps", "Netflix", "Twitter", "GitHub"].map((app) => (
            <span
              key={app}
              className="px-2 py-1 text-xs rounded-full bg-secondary/50 text-muted-foreground"
            >
              {app}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
