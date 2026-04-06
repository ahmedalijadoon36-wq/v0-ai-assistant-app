"use client"

import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface TranscriptDisplayProps {
  messages: Message[]
  isTyping?: boolean
}

export function TranscriptDisplay({ messages, isTyping }: TranscriptDisplayProps) {
  const recentMessages = messages.slice(-4)

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <AnimatePresence mode="popLayout">
        {recentMessages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 ${message.role === "user" ? "text-right" : "text-left"}`}
          >
            <div
              className={`inline-block max-w-[85%] px-4 py-3 rounded-2xl ${
                message.role === "user"
                  ? "bg-primary/20 text-foreground border border-primary/30"
                  : "bg-secondary/50 text-foreground border border-border"
              }`}
            >
              <p className="text-sm font-medium mb-1 text-muted-foreground">
                {message.role === "user" ? "You" : "F.R.I.D.A.Y."}
              </p>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-left mb-4"
          >
            <div className="inline-block px-4 py-3 rounded-2xl bg-secondary/50 border border-border">
              <p className="text-sm font-medium mb-1 text-muted-foreground">F.R.I.D.A.Y.</p>
              <div className="flex items-center gap-1.5">
                <motion.span
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.span
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.span
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
