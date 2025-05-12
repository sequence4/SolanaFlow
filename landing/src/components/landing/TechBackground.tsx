"use client"

import { Sparkles } from "lucide-react"
import { useEffect, useRef } from "react"

export default function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const setCanvasDimensions = () => {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight * 1.5
    }

    setCanvasDimensions()
    window.addEventListener("resize", setCanvasDimensions)

    const particlesArray: Particle[] = []
    const particleCount = 60

    class Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      color: string

      constructor() {
        this.x = Math.random() * (canvas?.width || 1000)
        this.y = Math.random() * (canvas?.height || 800)
        this.size = Math.random() * 2 + 0.5
        this.speedX = (Math.random() - 0.5) * 0.5
        this.speedY = (Math.random() - 0.5) * 0.5

        const colors = ["rgba(45, 212, 191, 0.9)", "rgba(168, 85, 247, 0.9)", "rgba(59, 130, 246, 0.9)"]
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (canvas) {
          if (this.x > canvas.width) this.x = 0
          else if (this.x < 0) this.x = canvas.width

          if (this.y > canvas.height) this.y = 0
          else if (this.y < 0) this.y = canvas.height
        }
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particlesArray.push(new Particle())
    }

    function drawGrid() {
      if (!ctx || !canvas) return
      ctx.strokeStyle = "rgba(66, 66, 90, 0.1)"
      ctx.lineWidth = 0.5

      const gridSize = 40

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    function connectParticles() {
      if (!ctx) return
      const maxDistance = 150

      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
          const dx = particlesArray[a].x - particlesArray[b].x
          const dy = particlesArray[a].y - particlesArray[b].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < maxDistance) {
            const opacity = 1 - distance / maxDistance
            ctx.strokeStyle = `rgba(45, 212, 191, ${opacity * 0.3})`
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y)
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y)
            ctx.stroke()
          }
        }
      }
    }

    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#0f172a")
      gradient.addColorStop(1, "#0f1123")

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drawGrid()

      particlesArray.forEach((particle) => {
        particle.update()
        particle.draw()
      })

      connectParticles()

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full -z-10" 
      style={{ background: "#0f1123", opacity: 1 }}
    />
  )
}

export function LightningIcon() {
  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Circuit board background */}
        <path
          d="M5 20C5 11.7157 11.7157 5 20 5C28.2843 5 35 11.7157 35 20C35 28.2843 28.2843 35 20 35C11.7157 35 5 28.2843 5 20Z"
          stroke="rgba(45, 212, 191, 0.2)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <path d="M10 20H30" stroke="rgba(45, 212, 191, 0.2)" strokeWidth="1" />
        <path d="M20 10V30" stroke="rgba(45, 212, 191, 0.2)" strokeWidth="1" />

        {/* Lightning bolt */}
        <path
          d="M22 8L12 20H20L18 32L28 18H20L22 8Z"
          fill="rgba(45, 212, 191, 0.1)"
          stroke="rgb(45, 212, 191)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Tech dots */}
        <circle cx="12" cy="20" r="1.5" fill="rgb(45, 212, 191)" />
        <circle cx="20" cy="10" r="1.5" fill="rgb(45, 212, 191)" />
        <circle cx="28" cy="18" r="1.5" fill="rgb(45, 212, 191)" />
        <circle cx="20" cy="32" r="1.5" fill="rgb(45, 212, 191)" />
      </svg>
    </div>
  )
}

export function SecurityIcon() {
  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Hexagonal shield */}
        <path
          d="M20 5L32 11V21C32 26.5228 26.6274 31 20 31C13.3726 31 8 26.5228 8 21V11L20 5Z"
          fill="rgba(45, 212, 191, 0.1)"
          stroke="rgb(45, 212, 191)"
          strokeWidth="1.5"
        />

        {/* Digital circuit pattern */}
        <path d="M14 15H26" stroke="rgba(45, 212, 191, 0.4)" strokeWidth="1" strokeDasharray="1 1" />
        <path d="M14 19H26" stroke="rgba(45, 212, 191, 0.4)" strokeWidth="1" strokeDasharray="1 1" />
        <path d="M14 23H26" stroke="rgba(45, 212, 191, 0.4)" strokeWidth="1" strokeDasharray="1 1" />

        {/* Lock */}
        <rect x="16" y="17" width="8" height="7" rx="1" fill="rgb(45, 212, 191)" />
        <path
          d="M17 17V15C17 13.8954 18.3431 13 20 13C21.6569 13 23 13.8954 23 15V17"
          stroke="rgb(45, 212, 191)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="1" fill="rgba(15, 23, 42, 1)" />
      </svg>
    </div>
  )
}