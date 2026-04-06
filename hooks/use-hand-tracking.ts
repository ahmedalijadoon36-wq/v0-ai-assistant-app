"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface HandPosition {
  x: number // 0-1, left to right
  y: number // 0-1, top to bottom
}

interface UseHandTrackingOptions {
  smoothing?: number // 0-1, higher = smoother but slower response
  enabled?: boolean
}

interface UseHandTrackingReturn {
  handPosition: HandPosition | null
  isTracking: boolean
  isLoading: boolean
  error: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  startTracking: () => void
  stopTracking: () => void
}

export function useHandTracking({
  smoothing = 0.1,
  enabled = false,
}: UseHandTrackingOptions = {}): UseHandTrackingReturn {
  const [handPosition, setHandPosition] = useState<HandPosition | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const handsRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const smoothedPositionRef = useRef<HandPosition>({ x: 0.5, y: 0.5 })
  const animationFrameRef = useRef<number | null>(null)

  const startTracking = useCallback(async () => {
    if (isTracking || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      // Dynamically import MediaPipe
      const { Hands } = await import("@mediapipe/hands")
      const { Camera } = await import("@mediapipe/camera_utils")

      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        },
      })

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // 0 = lite, faster
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // Get the palm center (landmark 9 is middle finger base)
          const landmarks = results.multiHandLandmarks[0]
          const palmX = landmarks[9].x
          const palmY = landmarks[9].y

          // Apply smoothing
          smoothedPositionRef.current = {
            x: smoothedPositionRef.current.x + (palmX - smoothedPositionRef.current.x) * smoothing,
            y: smoothedPositionRef.current.y + (palmY - smoothedPositionRef.current.y) * smoothing,
          }

          setHandPosition({ ...smoothedPositionRef.current })
        } else {
          setHandPosition(null)
        }
      })

      handsRef.current = hands

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current })
            }
          },
          width: 640,
          height: 480,
        })

        cameraRef.current = camera
        await camera.start()

        setIsTracking(true)
        setIsLoading(false)
      }
    } catch (err) {
      console.error("Hand tracking error:", err)
      setError(err instanceof Error ? err.message : "Failed to start hand tracking")
      setIsLoading(false)
    }
  }, [isTracking, isLoading, smoothing])

  const stopTracking = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop()
      cameraRef.current = null
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    if (handsRef.current) {
      handsRef.current.close()
      handsRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setIsTracking(false)
    setHandPosition(null)
    smoothedPositionRef.current = { x: 0.5, y: 0.5 }
  }, [])

  // Auto start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !isTracking && !isLoading) {
      startTracking()
    } else if (!enabled && isTracking) {
      stopTracking()
    }
  }, [enabled, isTracking, isLoading, startTracking, stopTracking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  return {
    handPosition,
    isTracking,
    isLoading,
    error,
    videoRef,
    canvasRef,
    startTracking,
    stopTracking,
  }
}
