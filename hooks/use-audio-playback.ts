"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UseAudioPlaybackOptions {
  onStart?: () => void
  onEnd?: () => void
  onAudioLevel?: (level: number) => void
}

export function useAudioPlayback({
  onStart,
  onEnd,
  onAudioLevel,
}: UseAudioPlaybackOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

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

  const playAudio = useCallback(
    async (text: string) => {
      if (isPlaying || isLoading) return

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
        console.error("Audio playback error:", error)
        setIsLoading(false)
        setIsPlaying(false)
        onEnd?.()
      }
    },
    [isPlaying, isLoading, onStart, onEnd, onAudioLevel, analyzeAudio]
  )

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        // Ignore errors if already stopped
      }
    }
    setIsPlaying(false)
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
