"use client"

import React, { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import ScrollReveal from "./ScrollReveal"
import { Blocks, Code, Waypoints, Eye, Codesandbox, Ungroup } from "lucide-react"

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
    <div className="relative flex flex-col items-center justify-evenly gap-5 h-full w-full overflow-hidden font-lekton">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <ScrollReveal>
        <div className="inline-flex items-center px-3 py-1 items-center justify-center rounded-full bg-[#1a1b2e]/60 border border-[#2a2d4a]/60 
                          text-[10px] xs:text-[13px] sm:text-[13px] font-medium backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-[#5580ff] mr-2 animate-pulse" />
          <span className="bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff] bg-clip-text text-transparent"
              style={{backgroundSize: "300% 300%",animation: "gradientFlow 3s ease infinite"}}>POWERFUL DEVELOPMENT TOOLS</span>
        </div>
      </ScrollReveal>
      <div className="relative flex flex-col justify-between items-center gap-4" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
        <h1 className="text-[28px] sm:text-[40px] md:text-4xl font-bold tracking-tight mb-2 mt-2 flex flex-row gap-8">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-block"
          >
            <span className="text-white">Describe</span>
            <span>.</span>{" "}
            <span className="text-white">Deploy</span>
            <span>.</span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" style={{ backgroundSize: "300% 300%", animation: "gradientFlow 3s ease infinite" }}>Scale</span><span>.</span>
          </motion.span>{" "}
        </h1>
        <div className="h-[2px] w-[50%] xs:w-[60%] md:w-64 bg-gradient-to-r from-transparent via-[#64d2ff] to-transparent mx-auto mt-4 xs:mt-6 sm:mt-8 mb-4 xs:mb-6 sm:mb-8 opacity-70"></div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="max-w-xl mx-auto md:text-md text-gray-400 px-4 sm:px-0 text-center sm:mb-6 md:mb-10"
          style={{ fontFamily: 'var(--font-oxygen-mono)' }}
        >
          The platform leverages cutting-edge technology to deliver a secure, intelligent, and streamlined development experience—purpose-built for the Solana ecosystem.
        </motion.p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-6 md:gap-12 px-2 xs:px-4 sm:px-6 w-full max-w-6xl mx-auto">
          <ScrollReveal delay={0}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#5580ff]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#5580ff]/5 to-[#5580ff]/5 backdrop-blur-sm border border-[#5580ff]/20 rounded-2xl p-3 xs:p-4 sm:p-5 md:p-8 h-full transition-all duration-300 group-hover:border-[#5580ff]/50 group-hover:translate-y-[-3px] shadow-[0_0_10px_rgba(85,128,255,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-5">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-[#5580ff]/10 flex items-center justify-center group-hover:bg-[#5580ff]/20 transition-colors">
                    <Waypoints className="w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#5580ff]"/>
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center
                sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3
                ">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#9cb3ff]"
                      style={{ textShadow: "0 0 18px rgba(85,128,255,0.8), 0 0 8px rgba(85,128,255,0.6)" }}>Visual Workflow Builder</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#5580ff] text-xs">
                    workflow
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed 
                text-center xs:text-center sm:text-center md:text-left">
                Effortlessly assemble your Solana dApp visually—no coding required.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Pre-Audited, Secure Components", "Security-Tested Contract Templates", "Intuitive flow connections"].map(
                    (item, index) => (
                      <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px]
                      text-xs md:text-sm">
                        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 
                        rounded-full bg-[#9cb3ff]/10 border border-[#5580ff]/20 mr-2 xs:mr-3 sm:mr-3">
                          <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#5580ff] animate-pulse" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0ea5e9]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#0ea5e9]/5 to-[#0ea5e9]/5 backdrop-blur-sm border border-[#0ea5e9]/20 rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 h-full transition-all duration-300 group-hover:border-[#0ea5e9]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(14,165,233,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center group-hover:bg-[#0ea5e9]/20 transition-colors">
                    <Blocks className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-[#0ea5e9]" />
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#8bdbf8]"
                      style={{ textShadow: "0 0 18px rgba(14,165,233,0.8), 0 0 8px rgba(14,165,233,0.6)" }}>Interactive UI Builder</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#0ea5e9] text-xs">
                    interface
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed text-center xs:text-center sm:text-center md:text-left">
                Instantly preview and refine your Solana dApp interface in real-time.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Live, Interactive Previews", "Built-in Wallet Integration", "Fully Responsive Designs"].map((item, index) => (
                    <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px] text-xs md:text-sm">
                      <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 rounded-full bg-[#8bdbf8]/10 border border-[#0ea5e9]/20 mr-2 xs:mr-3 sm:mr-3">
                        <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#0ea5e9] animate-pulse" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d9488]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#0d9488]/5 to-[#0d9488]/5 backdrop-blur-sm border border-[#0d9488]/20 rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 h-full transition-all duration-300 group-hover:border-[#0d9488]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(13,148,136,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl bg-[#0d9488]/10 flex items-center justify-center group-hover:bg-[#0d9488]/20 transition-colors">
                    <Code className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-[#0d9488]" />
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#7cded9]"
                      style={{ textShadow: "0 0 18px rgba(13,148,136,0.8), 0 0 8px rgba(13,148,136,0.6)" }}>Solana-Optimized IDE</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#0d9488] text-xs">
                    code
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed text-center xs:text-center sm:text-center md:text-left">
                A powerful code editor purpose-built for efficient Solana development.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Native Rust & TypeScript Support", "Instant Error Detection", "Built-in Testing & Debugging"].map(
                    (item, index) => (
                      <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px] text-xs md:text-sm">
                        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 rounded-full bg-[#7cded9]/10 border border-[#0d9488]/20 mr-2 xs:mr-3 sm:mr-3">
                          <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#0d9488] animate-pulse" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={600}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d9488]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#0d9488]/5 to-[#0d9488]/5 backdrop-blur-sm border border-[#0d9488]/20 rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 h-full transition-all duration-300 group-hover:border-[#0d9488]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(13,148,136,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl bg-[#0d9488]/10 flex items-center justify-center group-hover:bg-[#0d9488]/20 transition-colors">
                    <Codesandbox className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-[#0d9488]" />
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#7cded9]"
                      style={{ textShadow: "0 0 18px rgba(13,148,136,0.8), 0 0 8px rgba(13,148,136,0.6)" }}>Extensive Plugin Library</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#0d9488] text-xs">
                    plugins
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed text-center xs:text-center sm:text-center md:text-left">
                Access a comprehensive library of pre-audited Solana modules to accelerate your dApp development.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Pre-Audited Modules", "Continuous Integration", "Seamless Integration"].map(
                    (item, index) => (
                      <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px] text-xs md:text-sm">
                        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 rounded-full bg-[#7cded9]/10 border border-[#0d9488]/20 mr-2 xs:mr-3 sm:mr-3">
                          <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#0d9488] animate-pulse" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={800}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0ea5e9]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#0ea5e9]/5 to-[#0ea5e9]/5 backdrop-blur-sm border border-[#0ea5e9]/20 rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 h-full transition-all duration-300 group-hover:border-[#0ea5e9]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(14,165,233,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center group-hover:bg-[#0ea5e9]/20 transition-colors">
                    <Ungroup className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-[#0ea5e9]" />
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#8bdbf8]"
                      style={{ textShadow: "0 0 18px rgba(14,165,233,0.8), 0 0 8px rgba(14,165,233,0.6)" }}>Collaborative Development</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#0ea5e9] text-xs">
                    collaboration
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed text-center xs:text-center sm:text-center md:text-left">
                Work together in real-time with your team to build and refine your Solana applications.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Real-Time Co-Editing", "Integrated Version Control", "Team Communication Tools"].map(
                    (item, index) => (
                      <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px] text-xs md:text-sm">
                        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 rounded-full bg-[#8bdbf8]/10 border border-[#0ea5e9]/20 mr-2 xs:mr-3 sm:mr-3">
                          <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#0ea5e9] animate-pulse" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={1000}>
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-[#5580ff]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col gap-2 relative bg-gradient-to-b from-[#5580ff]/5 to-[#5580ff]/5 backdrop-blur-sm border border-[#5580ff]/20 rounded-2xl p-3 xs:p-4 sm:p-6 md:p-8 h-full transition-all duration-300 group-hover:border-[#5580ff]/50 group-hover:translate-y-[-4px] shadow-[0_0_10px_rgba(85,128,255,0.2)]">
                <div className="flex items-center justify-center w-full mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-xl bg-[#5580ff]/10 flex items-center justify-center group-hover:bg-[#5580ff]/20 transition-colors">
                    <Eye className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-[#5580ff]" />
                  </div>
                </div>
                <div className="flex flex-col xs:flex-col sm:flex-col md:flex-row items-center xs:items-center sm:items-center md:items-center mb-2 sm:mb-2 md:mb-3">
                  <h3 className="text-base text-lg sm:text-xl md:text-2xl font-semibold text-[#9cb3ff]"
                      style={{ textShadow: "0 0 18px rgba(85,128,255,0.8), 0 0 8px rgba(85,128,255,0.6)" }}>AI-Powered Assistant</h3>
                  <span className="mt-1 xs:mt-1 sm:mt-1 md:mt-0 md:ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#5580ff] text-xs">
                    assistant
                  </span>
                </div>
                <p className="text-gray-300 mb-3 xs:mb-4 sm:mb-4 md:mb-5 text-sm md:text-md leading-relaxed text-center xs:text-center sm:text-center md:text-left">
                Leverage an intelligent AI agent to streamline your Solana dApp development process.
                </p>
                <ul className="text-gray-300 space-y-2 sm:space-y-3 text-[10px] xs:text-xs sm:text-sm w-full flex flex-col items-center">
                  {["Natural Language Prompts", "On-Chain Task Automation", "Extensive Function Library"].map((item, index) => (
                    <li key={index} className="flex items-center w-full max-w-[240px] xs:max-w-[260px] sm:max-w-[280px] text-xs md:text-sm">
                      <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 rounded-full bg-[#9cb3ff]/10 border border-[#5580ff]/20 mr-2 xs:mr-3 sm:mr-3">
                        <div className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#5580ff] animate-pulse" />
                      </div>
                      <span>{item}</span>
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