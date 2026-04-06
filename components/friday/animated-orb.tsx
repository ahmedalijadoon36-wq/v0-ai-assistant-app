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
    const targetRotateX = (mouseY - 0.5) * -20
    const targetRotateY = (mouseX - 0.5) * 20
    rotateX.set(targetRotateX)
    rotateY.set(targetRotateY)
  }, [mouseX, mouseY, rotateX, rotateY])

  const getGlowIntensity = () => {
    switch (state) {
      case "listening":
        return { glow: 0.8, pulse: true }
      case "processing":
        return { glow: 0.6, pulse: false }
      case "speaking":
        return { glow: 0.5 + audioLevel * 0.5, pulse: false }
      default:
        return { glow: 0.4, pulse: true }
    }
  }

  const { glow, pulse } = getGlowIntensity()

  // Arc reactor ring segments
  const outerSegments = 10
  const innerSegments = 8

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
          width: 280,
          height: 280,
        }}
      >
        {/* Outer ambient glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 350,
            height: 350,
            left: -35,
            top: -35,
            background: `radial-gradient(circle, rgba(255, 50, 50, ${glow * 0.3}) 0%, transparent 70%)`,
            filter: "blur(20px)",
          }}
          animate={pulse ? {
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Main arc reactor body - outer ring */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 280,
            height: 280,
            left: 0,
            top: 0,
            background: "linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 50%, #1a1a1a 100%)",
            boxShadow: `
              inset 0 2px 10px rgba(255, 255, 255, 0.1),
              inset 0 -2px 10px rgba(0, 0, 0, 0.8),
              0 0 ${30 + glow * 40}px ${10 + glow * 20}px rgba(255, 50, 50, ${glow * 0.5})
            `,
            border: "3px solid #2a2a2a",
          }}
        />

        {/* Outer ring segments */}
        <motion.div
          className="absolute"
          style={{
            width: 260,
            height: 260,
            left: 10,
            top: 10,
          }}
          animate={state === "processing" ? { rotate: 360 } : { rotate: 0 }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {[...Array(outerSegments)].map((_, i) => {
            const angle = (i * 360) / outerSegments
            const isActive = state === "speaking" ? Math.random() > 0.3 : true
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: 20,
                  height: 6,
                  left: "50%",
                  top: "50%",
                  marginLeft: -10,
                  marginTop: -3,
                  transformOrigin: "50% 50%",
                  transform: `rotate(${angle}deg) translateX(115px)`,
                  background: isActive 
                    ? `linear-gradient(90deg, transparent, rgba(255, 80, 80, ${glow}), transparent)`
                    : "rgba(100, 30, 30, 0.3)",
                  borderRadius: 3,
                  boxShadow: isActive ? `0 0 10px rgba(255, 50, 50, ${glow})` : "none",
                }}
                animate={state === "listening" ? {
                  opacity: [0.5, 1, 0.5],
                } : {}}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            )
          })}
        </motion.div>

        {/* Middle ring - metallic */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 220,
            height: 220,
            left: 30,
            top: 30,
            background: "linear-gradient(145deg, #2a2a2a 0%, #151515 50%, #2a2a2a 100%)",
            boxShadow: `
              inset 0 2px 8px rgba(255, 255, 255, 0.1),
              inset 0 -2px 8px rgba(0, 0, 0, 0.5)
            `,
            border: "2px solid #333",
          }}
        />

        {/* Inner rotating ring */}
        <motion.div
          className="absolute"
          style={{
            width: 200,
            height: 200,
            left: 40,
            top: 40,
          }}
          animate={state === "processing" ? { rotate: -360 } : state === "speaking" ? { rotate: audioLevel * 30 } : {}}
          transition={{
            duration: state === "processing" ? 4 : 0.1,
            repeat: state === "processing" ? Infinity : 0,
            ease: state === "processing" ? "linear" : "easeOut",
          }}
        >
          {[...Array(innerSegments)].map((_, i) => {
            const angle = (i * 360) / innerSegments
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: 30,
                  height: 8,
                  left: "50%",
                  top: "50%",
                  marginLeft: -15,
                  marginTop: -4,
                  transformOrigin: "50% 50%",
                  transform: `rotate(${angle}deg) translateX(85px)`,
                  background: `linear-gradient(90deg, transparent, rgba(255, 100, 100, ${glow * 1.2}), transparent)`,
                  borderRadius: 4,
                  boxShadow: `0 0 15px rgba(255, 50, 50, ${glow})`,
                }}
                animate={state === "listening" ? {
                  opacity: [0.6, 1, 0.6],
                  boxShadow: [
                    `0 0 10px rgba(255, 50, 50, ${glow * 0.5})`,
                    `0 0 20px rgba(255, 50, 50, ${glow})`,
                    `0 0 10px rgba(255, 50, 50, ${glow * 0.5})`,
                  ],
                } : {}}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            )
          })}
        </motion.div>

        {/* Inner metallic ring */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 160,
            left: 60,
            top: 60,
            background: "linear-gradient(145deg, #1f1f1f 0%, #0f0f0f 50%, #1f1f1f 100%)",
            boxShadow: `
              inset 0 1px 6px rgba(255, 255, 255, 0.08),
              inset 0 -1px 6px rgba(0, 0, 0, 0.5)
            `,
            border: "2px solid #2a2a2a",
          }}
        />

        {/* Core glow chamber */}
        <motion.div
          className="absolute rounded-full overflow-hidden"
          style={{
            width: 130,
            height: 130,
            left: 75,
            top: 75,
            background: `radial-gradient(circle at 50% 50%, 
              rgba(255, 120, 120, ${glow}) 0%, 
              rgba(255, 50, 50, ${glow * 0.8}) 30%, 
              rgba(180, 30, 30, ${glow * 0.5}) 60%, 
              rgba(80, 10, 10, 0.8) 100%
            )`,
            boxShadow: `
              0 0 ${20 + glow * 30}px ${5 + glow * 15}px rgba(255, 50, 50, ${glow * 0.6}),
              inset 0 0 30px rgba(255, 100, 100, ${glow * 0.5})
            `,
          }}
          animate={state === "speaking" ? {
            boxShadow: [
              `0 0 ${20 + audioLevel * 40}px ${5 + audioLevel * 20}px rgba(255, 50, 50, ${0.4 + audioLevel * 0.4}), inset 0 0 30px rgba(255, 100, 100, ${0.3 + audioLevel * 0.3})`,
              `0 0 ${30 + audioLevel * 50}px ${10 + audioLevel * 25}px rgba(255, 50, 50, ${0.6 + audioLevel * 0.3}), inset 0 0 40px rgba(255, 100, 100, ${0.4 + audioLevel * 0.4})`,
              `0 0 ${20 + audioLevel * 40}px ${5 + audioLevel * 20}px rgba(255, 50, 50, ${0.4 + audioLevel * 0.4}), inset 0 0 30px rgba(255, 100, 100, ${0.3 + audioLevel * 0.3})`,
            ],
          } : pulse ? {
            boxShadow: [
              `0 0 20px 5px rgba(255, 50, 50, 0.3), inset 0 0 20px rgba(255, 100, 100, 0.2)`,
              `0 0 40px 15px rgba(255, 50, 50, 0.5), inset 0 0 35px rgba(255, 100, 100, 0.4)`,
              `0 0 20px 5px rgba(255, 50, 50, 0.3), inset 0 0 20px rgba(255, 100, 100, 0.2)`,
            ],
          } : {}}
          transition={{
            duration: state === "speaking" ? 0.15 : 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Core texture lines */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  width: "100%",
                  height: 1,
                  top: `${20 + i * 12}%`,
                  background: `linear-gradient(90deg, transparent, rgba(255, 150, 150, ${glow * 0.3}), transparent)`,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Center core - innermost */}
        <motion.div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            width: 90,
            height: 90,
            left: 95,
            top: 95,
            background: `radial-gradient(circle at 40% 40%, 
              rgba(255, 180, 180, ${glow * 1.2}) 0%, 
              rgba(255, 80, 80, ${glow}) 40%, 
              rgba(200, 50, 50, ${glow * 0.7}) 100%
            )`,
            boxShadow: `
              0 0 ${15 + glow * 20}px rgba(255, 100, 100, ${glow * 0.8}),
              inset 0 0 15px rgba(255, 200, 200, ${glow * 0.5})
            `,
          }}
          animate={state === "speaking" ? {
            scale: [1, 1 + audioLevel * 0.1, 1],
          } : {}}
          transition={{
            duration: 0.1,
          }}
        >
          {/* FRIDAY text */}
          <motion.span
            className="font-bold tracking-wider text-center select-none"
            style={{
              fontSize: 14,
              fontFamily: "monospace",
              color: "#fff",
              textShadow: `
                0 0 10px rgba(255, 200, 200, ${glow}),
                0 0 20px rgba(255, 100, 100, ${glow * 0.8}),
                0 0 30px rgba(255, 50, 50, ${glow * 0.5})
              `,
              letterSpacing: "0.15em",
            }}
            animate={state === "listening" ? {
              textShadow: [
                `0 0 10px rgba(255, 200, 200, 0.5), 0 0 20px rgba(255, 100, 100, 0.4), 0 0 30px rgba(255, 50, 50, 0.3)`,
                `0 0 15px rgba(255, 200, 200, 1), 0 0 30px rgba(255, 100, 100, 0.8), 0 0 45px rgba(255, 50, 50, 0.6)`,
                `0 0 10px rgba(255, 200, 200, 0.5), 0 0 20px rgba(255, 100, 100, 0.4), 0 0 30px rgba(255, 50, 50, 0.3)`,
              ],
            } : {}}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            FRIDAY
          </motion.span>
        </motion.div>

        {/* Ripple effects for listening */}
        {state === "listening" && (
          <>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 130,
                  height: 130,
                  left: 75,
                  top: 75,
                  border: "2px solid rgba(255, 100, 100, 0.4)",
                  boxShadow: "0 0 10px rgba(255, 50, 50, 0.3)",
                }}
                animate={{
                  scale: [1, 2.5],
                  opacity: [0.8, 0],
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

        {/* Processing spinner overlay */}
        {state === "processing" && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 130,
              height: 130,
              left: 75,
              top: 75,
              border: "3px solid transparent",
              borderTopColor: "rgba(255, 150, 150, 0.8)",
              borderRightColor: "rgba(255, 100, 100, 0.4)",
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Ambient floor reflection */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 40,
            left: 50,
            top: 290,
            background: `radial-gradient(ellipse, rgba(255, 50, 50, ${glow * 0.25}) 0%, transparent 70%)`,
            filter: "blur(15px)",
            transform: "rotateX(60deg)",
          }}
          animate={state === "speaking" ? {
            opacity: [0.3, 0.5 + audioLevel * 0.3, 0.3],
            scaleX: [1, 1.1 + audioLevel * 0.2, 1],
          } : {}}
          transition={{
            duration: 0.2,
            repeat: state === "speaking" ? Infinity : 0,
          }}
        />
      </motion.div>
    </motion.div>
  )
}
