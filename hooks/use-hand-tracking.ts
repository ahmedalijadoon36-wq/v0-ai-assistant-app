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
  startTracking: () => void
  stopTracking: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandLandmarkerInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VisionModule = any

// Global to track if script is loading/loaded
let mediaPipePromise: Promise<VisionModule> | null = null

// Suppress MediaPipe's harmless WebGL warnings
const originalConsoleError = typeof window !== "undefined" ? console.error : null
if (typeof window !== "undefined") {
  console.error = (...args: unknown[]) => {
    const message = args[0]
    if (typeof message === "string" && message.includes("OpenGL error checking is disabled")) {
      return // Suppress this specific MediaPipe warning
    }
    originalConsoleError?.apply(console, args)
  }
}

// Load MediaPipe via script tag injection to bypass webpack bundling
function loadMediaPipe(): Promise<VisionModule> {
  if (mediaPipePromise) return mediaPipePromise

  mediaPipePromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).__mediaPipeVision) {
      resolve((window as unknown as Record<string, unknown>).__mediaPipeVision as VisionModule)
      return
    }

    const script = document.createElement("script")
    script.type = "module"
    script.innerHTML = `
      import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
      window.__mediaPipeVision = { HandLandmarker, FilesetResolver };
      window.dispatchEvent(new Event('mediapipe-loaded'));
    `

    const handleLoad = () => {
      window.removeEventListener("mediapipe-loaded", handleLoad)
      const vision = (window as unknown as Record<string, unknown>).__mediaPipeVision as VisionModule
      if (vision) {
        resolve(vision)
      } else {
        reject(new Error("Failed to load MediaPipe"))
      }
    }

    window.addEventListener("mediapipe-loaded", handleLoad)

    script.onerror = () => {
      window.removeEventListener("mediapipe-loaded", handleLoad)
      mediaPipePromise = null
      reject(new Error("Failed to load MediaPipe script"))
    }

    document.head.appendChild(script)

    // Timeout fallback
    setTimeout(() => {
      if (!(window as unknown as Record<string, unknown>).__mediaPipeVision) {
        window.removeEventListener("mediapipe-loaded", handleLoad)
        mediaPipePromise = null
        reject(new Error("MediaPipe loading timed out"))
      }
    }, 15000)
  })

  return mediaPipePromise
}

export function useHandTracking({
  smoothing = 0.15,
  enabled = false,
}: UseHandTrackingOptions = {}): UseHandTrackingReturn {
  const [handPosition, setHandPosition] = useState<HandPosition | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handLandmarkerRef = useRef<HandLandmarkerInstance>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const smoothedPositionRef = useRef<HandPosition>({ x: 0.5, y: 0.5 })

  const detectHands = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current || !isTracking) {
      return
    }

    const video = videoRef.current
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectHands)
      return
    }

    try {
      const results = handLandmarkerRef.current.detectForVideo(video, performance.now())

      if (results.landmarks && results.landmarks.length > 0) {
        // Get the palm center (landmark 9 is middle finger base)
        const landmarks = results.landmarks[0]
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
    } catch {
      // Silently continue on detection errors
    }

    animationFrameRef.current = requestAnimationFrame(detectHands)
  }, [isTracking, smoothing])

  const startTracking = useCallback(async () => {
    if (isTracking || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      // Load MediaPipe via script injection
      const vision = await loadMediaPipe()
      const { HandLandmarker, FilesetResolver } = vision

      // Initialize the vision fileset
      const visionFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
      )

      // Create the hand landmarker
      const handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      handLandmarkerRef.current = handLandmarker

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play()
              resolve()
            }
          }
        })

        setIsTracking(true)
        setIsLoading(false)

        // Start detection loop
        animationFrameRef.current = requestAnimationFrame(detectHands)
      }
    } catch (err) {
      console.error("Hand tracking error:", err)
      setError(err instanceof Error ? err.message : "Failed to start hand tracking")
      setIsLoading(false)
    }
  }, [isTracking, isLoading, detectHands])

  const stopTracking = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (handLandmarkerRef.current) {
      handLandmarkerRef.current.close()
      handLandmarkerRef.current = null
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
    startTracking,
    stopTracking,
  }
}
