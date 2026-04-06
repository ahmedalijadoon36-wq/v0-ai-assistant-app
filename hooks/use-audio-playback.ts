"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UseAudioPlaybackOptions {
  onStart?: () => void
  onEnd?: () => void
  onAudioLevel?: (level: number) => void
  useElevenLabs?: boolean
}

export function useAudioPlayback({
  onStart,
  onEnd,
  onAudioLevel,
  useElevenLabs = true,
}: UseAudioPlaybackOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const simulatedLevelRef = useRef<number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.stop()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isPlaying) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average level (0-1)
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1)

    onAudioLevel?.(normalizedLevel)

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [isPlaying, onAudioLevel])

  // Simulated audio level animation for Web Speech API
  const simulateAudioLevel = useCallback(() => {
    if (simulatedLevelRef.current === null) return

    // Create a natural-looking audio level oscillation
    const time = Date.now() / 100
    const level = 0.3 + 0.4 * Math.sin(time) * Math.sin(time * 0.7) + 0.2 * Math.random()
    onAudioLevel?.(Math.min(Math.max(level, 0.1), 0.8))

    animationFrameRef.current = requestAnimationFrame(simulateAudioLevel)
  }, [onAudioLevel])

  // Play using browser's Web Speech Synthesis API (fallback)
  const playWithWebSpeech = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        console.error("Web Speech API not supported")
        onEnd?.()
        return
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utteranceRef.current = utterance

      // Configure voice settings for a more natural sound
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0

      // Try to find a good female voice
      const voices = window.speechSynthesis.getVoices()
      const preferredVoice = voices.find(
        (voice) =>
          voice.name.includes("Samantha") ||
          voice.name.includes("Karen") ||
          voice.name.includes("Victoria") ||
          voice.name.includes("Google UK English Female") ||
          voice.name.includes("Microsoft Zira")
      ) || voices.find((voice) => voice.lang.startsWith("en"))

      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      utterance.onstart = () => {
        setIsPlaying(true)
        setIsLoading(false)
        onStart?.()
        // Start simulated audio level animation
        simulatedLevelRef.current = 1
        simulateAudioLevel()
      }

      utterance.onend = () => {
        setIsPlaying(false)
        simulatedLevelRef.current = null
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        onAudioLevel?.(0)
        onEnd?.()
      }

      utterance.onerror = () => {
        setIsPlaying(false)
        setIsLoading(false)
        simulatedLevelRef.current = null
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        onAudioLevel?.(0)
        onEnd?.()
      }

      setIsLoading(true)
      window.speechSynthesis.speak(utterance)
    },
    [onStart, onEnd, onAudioLevel, simulateAudioLevel]
  )

  // Play using ElevenLabs API
  const playWithElevenLabs = useCallback(
    async (text: string) => {
      setIsLoading(true)

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })

        if (!response.ok) {
          throw new Error("TTS request failed")
        }

        const arrayBuffer = await response.arrayBuffer()

        // Create audio context
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256

        // Decode audio
        const audioBuffer =
          await audioContextRef.current.decodeAudioData(arrayBuffer)

        // Create source
        sourceRef.current = audioContextRef.current.createBufferSource()
        sourceRef.current.buffer = audioBuffer

        // Connect nodes
        sourceRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioContextRef.current.destination)

        // Handle playback end
        sourceRef.current.onended = () => {
          setIsPlaying(false)
          onEnd?.()
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
          }
          onAudioLevel?.(0)
        }

        // Start playback
        setIsLoading(false)
        setIsPlaying(true)
        onStart?.()
        sourceRef.current.start()

        // Start analyzing
        analyzeAudio()
      } catch (error) {
        console.error("ElevenLabs playback error, falling back to Web Speech:", error)
        // Fallback to Web Speech API
        playWithWebSpeech(text)
      }
    },
    [onStart, onEnd, onAudioLevel, analyzeAudio, playWithWebSpeech]
  )

  const playAudio = useCallback(
    async (text: string) => {
      if (isPlaying || isLoading) return

      if (useElevenLabs) {
        await playWithElevenLabs(text)
      } else {
        playWithWebSpeech(text)
      }
    },
    [isPlaying, isLoading, useElevenLabs, playWithElevenLabs, playWithWebSpeech]
  )

  const stopAudio = useCallback(() => {
    // Stop ElevenLabs audio
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        // Ignore errors if already stopped
      }
    }

    // Stop Web Speech
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    setIsPlaying(false)
    simulatedLevelRef.current = null
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    onAudioLevel?.(0)
  }, [onAudioLevel])

  return {
    isPlaying,
    isLoading,
    playAudio,
    stopAudio,
  }
}
