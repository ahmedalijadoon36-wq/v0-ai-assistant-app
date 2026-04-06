"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useChat } from "ai/react"
import { AnimatedOrb, type OrbState } from "./animated-orb"
import { TranscriptDisplay } from "./transcript-display"
import { StatusIndicator } from "./status-indicator"
import { SpotifyPlayer } from "./spotify-player"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useAudioPlayback } from "@/hooks/use-audio-playback"
import { useSpotify } from "@/hooks/use-spotify"

// Keywords that indicate the user wants current information or factual data
const SEARCH_KEYWORDS = [
  // Time-sensitive
  "current", "latest", "today", "now", "recent", "news", "happening",
  "2024", "2025", "2026", "this year", "this month", "this week",
  // Information queries
  "weather", "price", "stock", "score", "update", "results",
  "how much", "how many", "what is", "who is", "where is", "when is",
  // Research/facts
  "tell me about", "explain", "define", "meaning of", "history of",
  "facts about", "information about", "details about",
  // Comparisons and reviews
  "best", "top", "review", "compare", "vs", "versus", "difference between",
  // Events and schedules
  "schedule", "event", "game", "match", "concert", "movie", "show",
  // Tech and products
  "release", "launch", "specs", "features", "download",
]

// Music-related keywords for Spotify
const MUSIC_KEYWORDS = [
  "play", "song", "music", "track", "album", "artist", "playlist",
  "pause", "stop", "skip", "next", "previous", "spotify",
]

function shouldSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  // Don't search for music commands
  if (MUSIC_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
    return false
  }
  return SEARCH_KEYWORDS.some((keyword) => lowerQuery.includes(keyword))
}

function extractMusicQuery(query: string): string | null {
  const lowerQuery = query.toLowerCase()
  
  // Check for play commands
  const playPatterns = [
    /play\s+(?:the\s+)?(?:song\s+)?["']?([^"']+)["']?(?:\s+(?:by|from)\s+(.+))?/i,
    /(?:can you |could you |please )?play\s+(.+)/i,
    /put on\s+(.+)/i,
    /i want to (?:hear|listen to)\s+(.+)/i,
  ]
  
  for (const pattern of playPatterns) {
    const match = query.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return null
}

function getMusicCommand(query: string): "pause" | "next" | "previous" | null {
  const lowerQuery = query.toLowerCase()
  
  if (lowerQuery.includes("pause") || lowerQuery.includes("stop the music") || lowerQuery.includes("stop playing")) {
    return "pause"
  }
  if (lowerQuery.includes("skip") || lowerQuery.includes("next song") || lowerQuery.includes("next track")) {
    return "next"
  }
  if (lowerQuery.includes("previous") || lowerQuery.includes("go back") || lowerQuery.includes("last song")) {
    return "previous"
  }
  
  return null
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
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null)
  const pendingQueryRef = useRef<string | null>(null)
  const playAudioRef = useRef<(text: string) => void>(() => {})

  // Spotify integration
  const spotify = useSpotify()

  const { isPlaying, playAudio, stopAudio } = useAudioPlayback({
    onStart: () => setOrbState("speaking"),
    onEnd: () => setOrbState("idle"),
    onAudioLevel: setAudioLevel,
  })

  // Keep ref in sync
  useEffect(() => {
    playAudioRef.current = playAudio
  }, [playAudio])

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
    body: { searchResults },
    onFinish: (message) => {
      // Play the response
      if (message.role === "assistant" && message.content) {
        playAudioRef.current(message.content)
      }
    },
  })

  const handleVoiceResult = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return

      setOrbState("processing")
      setSpotifyMessage(null)

      // Check for music commands first
      const musicCommand = getMusicCommand(transcript)
      if (musicCommand && spotify.connected) {
        let result
        switch (musicCommand) {
          case "pause":
            result = await spotify.pause()
            if (result.success) {
              setSpotifyMessage("Paused")
              playAudioRef.current("Music paused")
            }
            break
          case "next":
            result = await spotify.next()
            if (result.success) {
              setSpotifyMessage("Skipped to next track")
              playAudioRef.current("Playing next track")
            }
            break
          case "previous":
            result = await spotify.previous()
            if (result.success) {
              setSpotifyMessage("Playing previous track")
              playAudioRef.current("Going back to previous track")
            }
            break
        }
        setOrbState("idle")
        return
      }

      // Check for play music request
      const musicQuery = extractMusicQuery(transcript)
      if (musicQuery) {
        if (!spotify.connected) {
          playAudioRef.current("Please connect to Spotify first using the button below")
          setOrbState("idle")
          return
        }
        
        const result = await spotify.searchAndPlay(musicQuery)
        if (result.success && result.track) {
          setSpotifyMessage(`Playing "${result.track.name}" by ${result.track.artist}`)
          playAudioRef.current(`Now playing ${result.track.name} by ${result.track.artist}`)
        } else if (result.error) {
          setSpotifyMessage(result.error)
          playAudioRef.current(result.error)
        }
        setOrbState("idle")
        return
      }

      // Check if we need to search Google
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
    [spotify]
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

        {/* Spotify message */}
        {spotifyMessage && (
          <div className="mt-4 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-sm text-green-400">{spotifyMessage}</p>
          </div>
        )}

        {/* Spotify Player */}
        <div className="mt-8">
          <SpotifyPlayer />
        </div>

        {/* Hint */}
        <p className="mt-4 text-xs text-muted-foreground">
          Click the orb or enable wake word to start. Say &quot;play [song name]&quot; for music.
        </p>
      </div>
    </div>
  )
}
