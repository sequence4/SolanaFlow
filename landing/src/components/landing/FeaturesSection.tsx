"use client"

import React, { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import ScrollReveal from "./ScrollReveal"
import { Blocks, Code, Component, FileText, Waypoints } from "lucide-react"

export default function FeaturesSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const setCanvasDimensions = () => {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    setCanvasDimensions()
    window.addEventListener("resize", setCanvasDimensions)

    const particles: Particle[] = []
    const particleCount = 50
    const connectionDistance = 100

    class Particle {
      x: number = 0;
      y: number = 0;
      size: number = 1;
      speedX: number = 0;
      speedY: number = 0;

      constructor() {
        if (!canvas) return
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 1 + 0.5
        this.speedX = (Math.random() - 0.5) * 0.5
        this.speedY = (Math.random() - 0.5) * 0.5
      }

      update() {
        if (!canvas) return
        this.x += this.speedX
        this.y += this.speedY

        if (this.x > canvas.width) this.x = 0
        else if (this.x < 0) this.x = canvas.width

        if (this.y > canvas.height) this.y = 0
        else if (this.y < 0) this.y = canvas.height
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = "rgba(100, 210, 255, 0.5)"
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    const animate = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        particles[i].update()
        particles[i].draw()

        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(100, 210, 255, ${0.2 * (1 - distance / connectionDistance)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
    }
  }, [])

  return (
    <div className="relative flex flex-col items-center justify-evenly gap-4 h-[100vh] w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <ScrollReveal>
        <div className="inline-flex items-center px-3 py-1 mt-4 rounded-full bg-[#1a1b2e]/60 border border-[#2a2d4a]/60 text-xs font-medium backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-[#5580ff] mr-2 animate-pulse" />
          <span className="bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff] bg-clip-text text-transparent"
              style={{
                backgroundSize: "300% 300%",
                animation: "gradientFlow 3s ease infinite"
              }}>
            POWERFUL DEVELOPMENT TOOLS
          </span>
        </div>
      </ScrollReveal>
      <div className="relative flex flex-col justify-between items-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80"
          >
            Design.
          </motion.span>{" "}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80"
          >
            Deploy.
          </motion.span>{" "}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80"
          >
            Scale.
          </motion.span>
        </h1>
        <div className="h-[2px] w-[50%] md:w-64 bg-gradient-to-r from-transparent via-[#64d2ff] to-transparent mx-auto mt-8 mb-8 opacity-70"></div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="max-w-2xl mx-auto text-md text-gray-400"
        >
          The platform combines cutting-edge technologies to provide a secure, intelligent, and decentralized
          development experience for Solana.
        </motion.p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 - Workflow */}
          <ScrollReveal delay={0}>
            <div className="relative group h-[100%]">
              <div className="absolute inset-0 bg-gradient-to-r from-[#5580ff]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-b from-[#5580ff]/10 to-[#5580ff]/5 backdrop-blur-sm border border-[#5580ff]/20 rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#5580ff]/50 group-hover:translate-y-[-3px] shadow-[0_0_10px_rgba(85,128,255,0.2)]">
                <div className="flex items-center justify-center w-full mb-6">
                  <div className="w-14 h-14 rounded-xl bg-[#5580ff]/10 flex items-center justify-center group-hover:bg-[#5580ff]/20 transition-colors">
                    <Waypoints className="w-6 h-6 text-[#5580ff]"/>
                  </div>
                </div>
                <div className="flex items-center mb-3">
                  <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                      style={{
                        backgroundSize: "300% 300%",
                        animation: "gradientFlow 3s ease infinite"
                      }}>Visual Workflow Builder</h3>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#5580ff] text-xs font-medium">
                    workflow
                  </span>
                </div>
                <p className="text-gray-400 mb-5 text-sm leading-relaxed">
                  Drag and drop Solana plugins to visually design your dApp architecture without writing a single line of
                  code.
                </p>
                <ul className="text-gray-400 space-y-3 text-sm">
                  {["Pre-configured & verified components", "Smart contract templates", "Intuitive flow connections"].map(
                    (item, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-[#0a0b14] border border-[#5580ff]/20 flex items-center justify-center mr-3 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5580ff] animate-pulse" />
                        </div>
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature 2 - Code */}
          <ScrollReveal delay={200}>
            <div className="relative group h-[100%]">
              <div className="absolute inset-0 bg-gradient-to-r from-[#a855f7]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-b from-[#a855f7]/10 to-[#a855f7]/5 backdrop-blur-sm border border-[#a855f7]/20 rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#a855f7]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                <div className="flex items-center justify-center w-full mb-6">
                  <div className="w-14 h-14 rounded-xl bg-[#a855f7]/10 flex items-center justify-center group-hover:bg-[#a855f7]/20 transition-colors">
                    <Code className="w-6 h-6 text-[#a855f7]" />
                  </div>
                </div>
                <div className="flex items-center mb-3">
                  <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                      style={{
                        backgroundSize: "300% 300%",
                        animation: "gradientFlow 3s ease infinite"
                      }}>Solana-Specific IDE</h3>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#a855f7] text-xs font-medium">
                    code
                  </span>
                </div>
                <p className="text-gray-400 mb-5 text-sm leading-relaxed">
                  A powerful code editor tailored specifically for Solana development with intelligent autocompletion and
                  debugging.
                </p>
                <ul className="text-gray-400 space-y-3 text-sm">
                  {["Rust and TypeScript support", "Real-time error checking", "Integrated testing tools"].map(
                    (item, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-[#0a0b14] border border-[#a855f7]/20 flex items-center justify-center mr-3 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
                        </div>
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature 3 - Interface */}
          <ScrollReveal delay={400}>
            <div className="relative group h-[100%]">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0ea5e9]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-b from-[#0ea5e9]/10 to-[#0ea5e9]/5 backdrop-blur-sm border border-[#0ea5e9]/20 rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#0ea5e9]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(14,165,233,0.2)]">
                <div className="flex items-center justify-center w-full mb-6">
                  <div className="w-14 h-14 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center group-hover:bg-[#0ea5e9]/20 transition-colors">
                    <Blocks className="w-6 h-6 text-[#0ea5e9]" />
                  </div>
                </div>
                <div className="flex items-center mb-3">
                  <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                      style={{
                        backgroundSize: "300% 300%",
                        animation: "gradientFlow 3s ease infinite"
                      }}>Interactive UI Builder</h3>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#0ea5e9] text-xs font-medium">
                    interface
                  </span>
                </div>
                <p className="text-gray-400 mb-5 text-sm leading-relaxed">
                  Preview and interact with your generated dApp UI in real-time as you build your Solana application.
                </p>
                <ul className="text-gray-400 space-y-3 text-sm">
                  {["Live UI previews", "Wallet integration testing", "Responsive design tools"].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <div className="w-5 h-5 rounded-full bg-[#0a0b14] border border-[#0ea5e9]/20 flex items-center justify-center mr-3 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] animate-pulse" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
      </div>
      </div>
  )
} 