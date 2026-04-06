"use client"

import { motion } from "framer-motion"
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react"
import type { OrbState } from "./animated-orb"

interface StatusIndicatorProps {
  state: OrbState
  wakeWordEnabled: boolean
  onToggleWakeWord: () => void
}

export function StatusIndicator({
  state,
  wakeWordEnabled,
  onToggleWakeWord,
}: StatusIndicatorProps) {
  const getStatusText = () => {
    switch (state) {
      case "listening":
        return "Listening..."
      case "processing":
        return "Processing..."
      case "speaking":
        return "Speaking..."
      default:
        return wakeWordEnabled ? 'Say "Friday" to activate' : "Click to activate"
    }
  }

  const getStatusIcon = () => {
    switch (state) {
      case "listening":
        return <Mic className="w-4 h-4 text-primary" />
      case "processing":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      case "speaking":
        return <Volume2 className="w-4 h-4 text-primary" />
      default:
        return wakeWordEnabled ? (
          <Mic className="w-4 h-4 text-muted-foreground" />
        ) : (
          <MicOff className="w-4 h-4 text-muted-foreground" />
        )
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border"
      >
        {getStatusIcon()}
        <span className="text-sm text-foreground">{getStatusText()}</span>
      </motion.div>

      <button
        onClick={onToggleWakeWord}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors ${
          wakeWordEnabled
            ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
            : "bg-secondary/30 text-muted-foreground border border-border hover:bg-secondary/50"
        }`}
      >
        {wakeWordEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
        Wake Word: {wakeWordEnabled ? "ON" : "OFF"}
      </button>
    </div>
  )
}
