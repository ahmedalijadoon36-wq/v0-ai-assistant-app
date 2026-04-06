"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useEffect, useRef } from "react"

export type OrbState = "idle" | "listening" | "processing" | "speaking"

interface AnimatedOrbProps {
  state: OrbState
  audioLevel?: number
  mouseX?: number // 0 to 1
  mouseY?: number // 0 to 1
}

export function AnimatedOrb({ state, audioLevel = 0, mouseX = 0.5, mouseY = 0.5 }: AnimatedOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Smooth spring animations for rotation
  const springConfig = { stiffness: 150, damping: 20 }
  const rotateX = useSpring(useMotionValue(0), springConfig)
  const rotateY = useSpring(useMotionValue(0), springConfig)
  
  // Update rotation based on mouse position
  useEffect(() => {
    const targetRotateX = (mouseY - 0.5) * -30 // -15 to 15 degrees
    const targetRotateY = (mouseX - 0.5) * 30 // -15 to 15 degrees
    rotateX.set(targetRotateX)
    rotateY.set(targetRotateY)
  }, [mouseX, mouseY, rotateX, rotateY])

  // Transform for lighting effect based on rotation
  const highlightX = useTransform(rotateY, [-15, 15], ["25%", "45%"])
  const highlightY = useTransform(rotateX, [-15, 15], ["45%", "25%"])

  const getOrbConfig = () => {
    switch (state) {
      case "listening":
        return {
          scale: 1.2,
          boxShadow: "0 0 60px 20px rgba(255, 26, 26, 0.5), 0 0 120px 40px rgba(255, 26, 26, 0.3), inset 0 0 60px rgba(255, 100, 100, 0.2)",
          background: "radial-gradient(circle at 30% 30%, #ff4444 0%, #ff1a1a 40%, #8b0000 100%)",
        }
      case "processing":
        return {
          scale: 1,
          boxShadow: "0 0 40px 15px rgba(255, 100, 50, 0.4), 0 0 80px 30px rgba(255, 50, 0, 0.2), inset 0 0 40px rgba(255, 150, 100, 0.2)",
          background: "radial-gradient(circle at 30% 30%, #ff6633 0%, #ff3300 40%, #8b0000 100%)",
        }
      case "speaking":
        return {
          scale: 1 + audioLevel * 0.2,
          boxShadow: `0 0 ${50 + audioLevel * 30}px ${15 + audioLevel * 10}px rgba(255, 26, 26, ${0.5 + audioLevel * 0.2}), 0 0 ${100 + audioLevel * 40}px ${30 + audioLevel * 15}px rgba(255, 26, 26, 0.3), inset 0 0 ${40 + audioLevel * 20}px rgba(255, 100, 100, 0.3)`,
          background: "radial-gradient(circle at 30% 30%, #ff3333 0%, #ff1a1a 40%, #990000 100%)",
        }
      default: // idle
        return {
          scale: 1,
          boxShadow: "0 0 30px 10px rgba(255, 26, 26, 0.3), 0 0 60px 20px rgba(139, 0, 0, 0.2), inset 0 0 30px rgba(100, 0, 0, 0.3)",
          background: "radial-gradient(circle at 30% 30%, #ff2222 0%, #cc0000 40%, #660000 100%)",
        }
    }
  }

  const orbConfig = getOrbConfig()

  return (
    <motion.div
      ref={containerRef}
      className="relative flex items-center justify-center"
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
    >
      {/* 3D Container with rotation */}
      <motion.div
        className="relative"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Outer glow rings */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 280,
            height: 280,
            left: -40,
            top: -40,
            background: "radial-gradient(circle, rgba(255, 26, 26, 0.1) 0%, transparent 70%)",
            filter: "blur(2px)",
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
            left: -20,
            top: -20,
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
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: "linear-gradient(135deg, #ff6644 0%, #ff3311 100%)",
                  boxShadow: "0 0 10px 2px rgba(255, 26, 26, 0.6)",
                  left: 100 + Math.cos((i * Math.PI * 2) / 12) * 120,
                  top: 100 + Math.sin((i * Math.PI * 2) / 12) * 120,
                  transform: `translateZ(${Math.sin((i * Math.PI) / 6) * 20}px)`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </motion.div>
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
                  left: 0,
                  top: 0,
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

        {/* Main orb with 3D effect */}
        <motion.div
          className="relative rounded-full overflow-hidden"
          style={{
            width: 200,
            height: 200,
            transformStyle: "preserve-3d",
          }}
          animate={{
            scale: orbConfig.scale,
            boxShadow: orbConfig.boxShadow,
          }}
          transition={{
            duration: state === "speaking" ? 0.1 : 0.5,
            ease: "easeOut",
          }}
        >
          {/* Base gradient */}
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ background: orbConfig.background }}
            transition={{ duration: 0.5 }}
          />

          {/* Dynamic highlight that follows rotation */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: useTransform(
                [highlightX, highlightY],
                ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255, 255, 255, 0.3) 0%, transparent 50%)`
              ),
            }}
          />

          {/* Inner glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
            }}
          />

          {/* Surface texture - subtle noise */}
          <div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Specular highlight - top */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80,
              height: 40,
              top: 20,
              left: 40,
              background: "radial-gradient(ellipse, rgba(255, 255, 255, 0.15) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>

        {/* Ambient reflection below */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 150,
            height: 30,
            left: 25,
            top: 220,
            background: "radial-gradient(ellipse, rgba(255, 26, 26, 0.2) 0%, transparent 70%)",
            filter: "blur(15px)",
            transform: "rotateX(60deg)",
          }}
          animate={{
            opacity: state === "speaking" ? [0.3, 0.5, 0.3] : 0.2,
            scaleX: state === "speaking" ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.3,
            repeat: state === "speaking" ? Infinity : 0,
          }}
        />

        {/* Pulse animation for idle */}
        {state === "idle" && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 200,
              height: 200,
              left: 0,
              top: 0,
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

        {/* Energy arcs for speaking state */}
        {state === "speaking" && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: 250,
                  height: 250,
                  left: -25,
                  top: -25,
                  border: "2px solid transparent",
                  borderTopColor: `rgba(255, ${50 + i * 30}, ${i * 20}, ${0.3 + audioLevel * 0.3})`,
                  borderRadius: "50%",
                  transform: `rotate(${i * 90}deg)`,
                }}
                animate={{
                  rotate: [i * 90, i * 90 + 360],
                }}
                transition={{
                  duration: 2 - audioLevel,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
