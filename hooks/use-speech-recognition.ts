"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void
  onWakeWord?: () => void
  wakeWord?: string
  continuous?: boolean
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useSpeechRecognition({
  onResult,
  onWakeWord,
  wakeWord = "friday",
  continuous = false,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningForCommandRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      const currentTranscript = (finalTranscript || interimTranscript).toLowerCase()

      // Check for wake word when in continuous mode
      if (continuous && !isListeningForCommandRef.current) {
        if (currentTranscript.includes(wakeWord.toLowerCase())) {
          isListeningForCommandRef.current = true
          setTranscript("")
          onWakeWord?.()
          return
        }
      }

      // If we're listening for a command after wake word
      if (isListeningForCommandRef.current || !continuous) {
        const cleanTranscript = currentTranscript
          .replace(new RegExp(wakeWord, "gi"), "")
          .trim()

        if (cleanTranscript) {
          setTranscript(cleanTranscript)

          if (finalTranscript && onResult) {
            onResult(cleanTranscript)
            isListeningForCommandRef.current = false
            setTranscript("")
          }
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error)
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Restart if continuous mode is enabled
      if (continuous && recognitionRef.current) {
        try {
          recognition.start()
        } catch {
          // Ignore errors on restart
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
  }, [continuous, onResult, onWakeWord, wakeWord])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        isListeningForCommandRef.current = !continuous
        recognitionRef.current.start()
      } catch (error) {
        console.error("Failed to start speech recognition:", error)
      }
    }
  }, [isListening, continuous])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
        isListeningForCommandRef.current = false
      } catch (error) {
        console.error("Failed to stop speech recognition:", error)
      }
    }
  }, [])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  }
}
