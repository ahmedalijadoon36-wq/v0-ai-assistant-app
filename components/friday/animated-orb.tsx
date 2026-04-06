"use client"

import { motion } from "framer-motion"

export type OrbState = "idle" | "listening" | "processing" | "speaking"

interface AnimatedOrbProps {
  state: OrbState
  audioLevel?: number
  rotationX?: number // -1 to 1
  rotationY?: number // -1 to 1
}

export function AnimatedOrb({ state, audioLevel = 0, rotationX = 0, rotationY = 0 }: AnimatedOrbProps) {
  const getOrbConfig = () => {
    switch (state) {
      case "listening":
        return {
          scale: 1.2,
          boxShadow: "0 0 60px 20px rgba(255, 26, 26, 0.5), 0 0 120px 40px rgba(255, 26, 26, 0.3)",
          background: "radial-gradient(circle at 30% 30%, #ff4444 0%, #ff1a1a 40%, #8b0000 100%)",
        }
      case "processing":
        return {
          scale: 1,
          boxShadow: "0 0 40px 15px rgba(255, 100, 50, 0.4), 0 0 80px 30px rgba(255, 50, 0, 0.2)",
          background: "radial-gradient(circle at 30% 30%, #ff6633 0%, #ff3300 40%, #8b0000 100%)",
        }
      case "speaking":
        return {
          scale: 1 + audioLevel * 0.2,
          boxShadow: `0 0 ${50 + audioLevel * 30}px ${15 + audioLevel * 10}px rgba(255, 26, 26, ${0.5 + audioLevel * 0.2}), 0 0 ${100 + audioLevel * 40}px ${30 + audioLevel * 15}px rgba(255, 26, 26, 0.3)`,
          background: "radial-gradient(circle at 30% 30%, #ff3333 0%, #ff1a1a 40%, #990000 100%)",
        }
      default: // idle
        return {
          scale: 1,
          boxShadow: "0 0 30px 10px rgba(255, 26, 26, 0.3), 0 0 60px 20px rgba(139, 0, 0, 0.2)",
          background: "radial-gradient(circle at 30% 30%, #ff2222 0%, #cc0000 40%, #660000 100%)",
        }
    }
  }

  const orbConfig = getOrbConfig()

  // Calculate 3D transform based on hand position
  const transform = `perspective(1000px) rotateX(${rotationX * 30}deg) rotateY(${rotationY * 30}deg)`

  return (
    <motion.div 
      className="relative flex items-center justify-center"
      style={{ transform, transformStyle: "preserve-3d" }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      {/* Outer glow rings */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          background: "radial-gradient(circle, rgba(255, 26, 26, 0.1) 0%, transparent 70%)",
        }}
        animate={{
          scale: state === "listening" ? [1, 1.3, 1] : [1, 1.1, 1],
          opacity: state === "idle" ? [0.3, 0.5, 0.3] : [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: state === "listening" ? 1.5 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 240,
          height: 240,
          background: "radial-gradient(circle, rgba(255, 26, 26, 0.15) 0%, transparent 60%)",
        }}
        animate={{
          scale: state === "listening" ? [1, 1.2, 1] : [1, 1.05, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: state === "listening" ? 1.2 : 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.2,
        }}
      />

      {/* Rotating particles for processing state */}
      {state === "processing" && (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-red-500"
              style={{
                boxShadow: "0 0 10px 2px rgba(255, 26, 26, 0.6)",
              }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.25,
              }}
              initial={{
                x: Math.cos((i * Math.PI * 2) / 8) * 120,
                y: Math.sin((i * Math.PI * 2) / 8) * 120,
              }}
            />
          ))}
        </>
      )}

      {/* Ripple effect for listening state */}
      {state === "listening" && (
        <>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2 border-red-500/30"
              style={{
                width: 200,
                height: 200,
              }}
              animate={{
                scale: [1, 2],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 0.6,
              }}
            />
          ))}
        </>
      )}

      {/* Main orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: 200,
          height: 200,
        }}
        animate={{
          scale: orbConfig.scale,
          boxShadow: orbConfig.boxShadow,
          background: orbConfig.background,
        }}
        transition={{
          duration: state === "speaking" ? 0.1 : 0.5,
          ease: "easeOut",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)",
          }}
        />

        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle at 70% 70%, transparent 30%, rgba(0, 0, 0, 0.3) 100%)",
          }}
        />
      </motion.div>

      {/* Pulse animation for idle */}
      {state === "idle" && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            border: "1px solid rgba(255, 26, 26, 0.3)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.div>
  )
}
