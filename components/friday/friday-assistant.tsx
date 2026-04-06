"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useChat } from "ai/react"
import { AnimatedOrb, type OrbState } from "./animated-orb"
import { TranscriptDisplay } from "./transcript-display"
import { StatusIndicator } from "./status-indicator"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useAudioPlayback } from "@/hooks/use-audio-playback"

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
  const pendingQueryRef = useRef<string | null>(null)

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
    body: { searchResults },
    onFinish: (message) => {
      // Play the response
      if (message.role === "assistant" && message.content) {
        playAudio(message.content)
      }
    },
  })

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
        <p className="mt-4 text-xs text-muted-foreground">
          Click the orb or enable wake word to start. Move your mouse to rotate the orb.
        </p>
      </div>
    </div>
  )
}
