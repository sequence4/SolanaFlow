"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code, Cpu, Layers } from "lucide-react"
import { BsTelegram } from "react-icons/bs";
import { BsTwitterX } from "react-icons/bs";
import { BsYoutube } from "react-icons/bs";
import InstructionFlow from "@/components/landing/InstructionFlow"
import Head from "next/head"
import TypewriterCode from "@/components/landing/TypeWriterCode"
import LandingStyles from "@/components/landing/style"
import ScrollReveal from "@/components/landing/ScrollReveal"


export default function LandingPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    return () => {
      setMounted(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-mono overflow-x-hidden">
      {/* Google Fonts Integration */}
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet" 
        />
      </Head>

      {/* Matrix-like background effect */}
      {mounted && (
        <div className="fixed inset-0 z-0 opacity-15 overflow-hidden pointer-events-none">
          <div className="absolute inset-0">
            {Array.from({ length: 100 }).map((_, i) => {
              // Define gradient colors
              const gradientColors = ['#5f88dc', '#1cf6a0', '#9945ff'];
              const randomColor = gradientColors[Math.floor(Math.random() * gradientColors.length)];
              
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animation: `fall ${5 + Math.random() * 15}s linear infinite`,
                    animationDelay: `${Math.random() * 5}s`,
                    color: randomColor,
                    textShadow: `0 0 5px ${randomColor}`,
                    fontSize: '1rem',
                  }}
                >
                  {String.fromCharCode(33 + Math.floor(Math.random() * 94))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="relative z-10 border-b border-[#1e2033] bg-[#0a0b14]/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 relative">
              <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
              <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
            </div>
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: '"DM Sans", sans-serif' }}>
              <span className="text-white">Solana</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                style={{
                  backgroundSize: "300% 300%",
                  animation: "gradientFlow 3s ease infinite"
                }}>Flow</span>
          </span>
        </div>

          <div className="hidden md:flex items-center space-x-12">
            <Link href="#about" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
                About
            </Link>
            <Link href="#features" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
                Features
            </Link>
            <Link href="#demo" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
                Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex justify-center px-10 pl-[10%] py-[5%] w-full h-[100vh] overflow-hidden">
        <div className="w-full h-full z-10">
            <div className="flex flex-col w-full h-full md:flex-row items-start">
                {/* Left side content */}
                <div className="flex flex-col justify-evenly gap-2 h-full w-full md:w-2/5 lg:w-2/5 mb-12 md:mb-0 pr-0 md:pr-4 lg:pr-8">
                    <div className="flex flex-col gap-0 justify-start">
                        <div className="w-fit inline-block px-2 sm:px-3 py-1 mb-4 sm:mb-6 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
                        <span className="mr-2">●</span> Visual AI Developer Tool for Solana
                        </div>
                        <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight" style={{ fontFamily: '"DM Sans", sans-serif' }}>
                        <span className="block">Build Solana dApps</span>
                        <span className="text-4xl sm:text-4xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                            style={{
                            backgroundSize: "300% 300%",
                            animation: "gradientFlow 3s ease infinite"
                            }}>
                            Without Code
                        </span>
                        </h1>
                    </div>
                    <div className="text-gray-400 mb-6 sm:mb-8 max-w-lg text-xs sm:text-sm leading-relaxed">
                        <ul className="list-disc list-inside">
                        <li><span className="text-white font-semibold">SolanaFlow</span> transforms English into Solana programs.</li>
                        <li>Design, build, and deploy decentralized applications with our visual workflow builder and
                        specialized Solana IDE.</li>
                        </ul>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-start gap-2">
                        <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white p-2 rounded whitespace-nowrap">
                        <span className="cursor-pointer text-xs sm:text-sm">Join the Waitlist</span>
                        </Button>
                        <div className="flex items-center justify-center gap-2 hover:bg-none mt-2 sm:mt-0">
                            <Button size="icon" variant="ghost"><BsTelegram className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                            <Button size="icon" variant="ghost"><BsTwitterX className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                            <Button size="icon" variant="ghost"><BsYoutube className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                        </div>
                    </div>
                </div>

                {/* Right side - Flow diagram and code snippet */}
                <div className="w-full h-full flex flex-col lg:flex-row mt-8 md:mt-0">
                {/* Flow Diagram */}
                <div className="w-full relative isolate overflow-hidden">
                  <div className="h-full w-full overflow-hidden overscroll-x-none overflow-y-none">
                    {mounted && <InstructionFlow />}
                  </div>
                </div>

              {/* Code Terminal */}
              <div className="w-full h-full rounded-xl">
                <div className="w-full h-full rounded-xl overflow-hidden border border-[#2a2d4a] bg-[#0d0e1a] relative flex flex-col min-h-0">
                  <div className="flex items-center px-4 py-2 bg-[#1e2033] border-b border-[#2a2d4a] rounded-lg ">
                    <div className="flex space-x-2 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-[#ff5f57]"></div>
                      <div className="w-2 h-2 rounded-full bg-[#febc2e]"></div>
                      <div className="w-2 h-2 rounded-full bg-[#28c840]"></div>
                    </div>
                    <div className="ml-4 text-sm text-gray-400">token_minting_program.rs</div>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    {mounted && <TypewriterCode />}
                  </div>
                </div>
              </div>
            </div>
        </div>
    </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 bg-[#050508] overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-full w-full border-r border-white/5" />
            ))}
          </div>
          <div className="absolute inset-0 grid grid-rows-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-full w-full border-b border-white/5" />
            ))}
          </div>
        </div>

        {/* Glow effects */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#5580ff]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-[#a855f7]/20 rounded-full blur-[120px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <ScrollReveal>
              <div className="inline-flex items-center px-3 py-1 mb-4 rounded-full bg-[#1a1b2e]/60 border border-[#2a2d4a]/60 text-xs font-medium backdrop-blur-sm">
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
            
            <ScrollReveal delay={100}>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                    style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                    }}>
                  Build. Deploy. Scale.
                </span>
              </h2>
            </ScrollReveal>
            
            <ScrollReveal delay={200}>
              <p className="text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
                Our platform combines cutting-edge technologies to provide a secure, intelligent, and decentralized
                development experience for Solana.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 - Workflow */}
            <ScrollReveal delay={0}>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#5580ff]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-[#0a0b14]/80 backdrop-blur-sm border border-[#1e2033] rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#5580ff]/50 group-hover:translate-y-[-4px]">
                  <div className="w-14 h-14 rounded-xl bg-[#5580ff]/10 flex items-center justify-center mb-6 group-hover:bg-[#5580ff]/20 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-[#5580ff]"
                    >
                      <rect width="7" height="7" x="3" y="3" rx="1" />
                      <rect width="7" height="7" x="14" y="3" rx="1" />
                      <rect width="7" height="7" x="14" y="14" rx="1" />
                      <rect width="7" height="7" x="3" y="14" rx="1" />
                    </svg>
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
                          <div className="w-5 h-5 rounded-full bg-[#5580ff]/10 flex items-center justify-center mr-3 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#5580ff]" />
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
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#a855f7]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-[#0a0b14]/80 backdrop-blur-sm border border-[#1e2033] rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#a855f7]/50 group-hover:translate-y-[-4px]">
                  <div className="w-14 h-14 rounded-xl bg-[#a855f7]/10 flex items-center justify-center mb-6 group-hover:bg-[#a855f7]/20 transition-colors">
                    <Code className="w-6 h-6 text-[#a855f7]" />
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
                          <div className="w-5 h-5 rounded-full bg-[#a855f7]/10 flex items-center justify-center mr-3 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
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
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00c2ff]/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-[#0a0b14]/80 backdrop-blur-sm border border-[#1e2033] rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-[#00c2ff]/50 group-hover:translate-y-[-4px]">
                  <div className="w-14 h-14 rounded-xl bg-[#00c2ff]/10 flex items-center justify-center mb-6 group-hover:bg-[#00c2ff]/20 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-[#00c2ff]"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <line x1="3" x2="21" y1="9" y2="9" />
                      <line x1="9" x2="9" y1="21" y2="9" />
                    </svg>
                  </div>
                  <div className="flex items-center mb-3">
                    <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                        style={{
                          backgroundSize: "300% 300%",
                          animation: "gradientFlow 3s ease infinite"
                        }}>Interactive UI Builder</h3>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033]/80 text-[#00c2ff] text-xs font-medium">
                      interface
                    </span>
                  </div>
                  <p className="text-gray-400 mb-5 text-sm leading-relaxed">
                    Preview and interact with your generated dApp UI in real-time as you build your Solana application.
                  </p>
                  <ul className="text-gray-400 space-y-3 text-sm">
                    {["Live UI previews", "Wallet integration testing", "Responsive design tools"].map((item, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-[#00c2ff]/10 flex items-center justify-center mr-3 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00c2ff]" />
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
      </section>

      {/* Demo Video Section */}
      <section id="demo" className="py-20 bg-[#0a0b14]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
              <span className="mr-2">▶</span> Demo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
                See FlowCode in Action
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Watch how easy it is to build and deploy a Solana dApp in minutes with our visual development platform.
            </p>
          </div>

          {/* Video */}
          <div className="max-w-6xl mx-auto">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2d4a] shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d0e1a] to-[#0a0b14] flex flex-col items-center justify-center">
              <video 
                src="/assets/flowcode-demo.mp4" 
                autoPlay 
                muted 
                loop 
                playsInline
                className="w-full h-full object-cover" 
              />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#5580ff]/20 flex items-center justify-center mr-3">
                    <span className="text-[#5580ff] font-bold">1</span>
                  </div>
                  <h3 className="font-semibold text-sm">Design Your Workflow</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Drag and drop components to create your dApp architecture visually.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#a855f7]/20 flex items-center justify-center mr-3">
                    <span className="text-[#a855f7] font-bold">2</span>
                  </div>
                  <h3 className="font-semibold text-sm">Customize Your Code</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Fine-tune your smart contracts and frontend code in our specialized IDE.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#00c2ff]/20 flex items-center justify-center mr-3">
                    <span className="text-[#00c2ff] font-bold">3</span>
                  </div>
                  <h3 className="font-semibold text-sm">Deploy & Monitor</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Launch your dApp to testnet or mainnet with one click and track performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-[#0d0e1a] border border-[#2a2d4a] rounded-2xl p-8 md:p-12 relative overflow-hidden">
            {/* Background effect */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#5580ff] rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#a855f7] rounded-full blur-3xl opacity-10 translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="relative z-10 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                    style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                    }}>
                  Ready to Build Effortlessly on Solana?
                </span>
              </h2>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-sm">
                Join hundreds of other people on our waitlist to be informed when we launch.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white px-8 rounded">
                  <span className="flex items-center justify-center">
                    Join The Waitlist <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </Button>
              </div>

              {/* Terminal-like element */}
              <div className="mt-8 max-w-md mx-auto rounded-lg overflow-hidden border border-[#2a2d4a] text-left">
                <div className="bg-[#1e2033] px-4 py-2 flex items-center">
                  <div className="flex space-x-2 mr-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                  </div>
                  <span className="text-xs text-gray-400">terminal</span>
                </div>
                <div className="bg-[#0a0b14] p-4 font-mono text-xs">
                  <p className="text-gray-400">$ solana-cli</p>
                  <p className="text-[#00d16b]">Connecting to Solana...</p>
                  <p className="text-white">✓ Connected to Solana mainnet</p>
                  <p className="text-gray-400">$ solana deploy my-token-app</p>
                  <p className="text-[#5580ff]">
                    Deploying to Solana... <span className="animate-pulse">▋</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0b14] border-t border-[#1e2033] py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-6 md:mb-0">
              <div className="w-8 h-8 relative">
                <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
                <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
              </div>
              <span className="text-lg font-bold tracking-tighter" style={{ fontFamily: '"DM Sans", sans-serif' }}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                    style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                    }}>Solana</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>FlowCode</span>
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mb-6 md:mb-0">
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Terms of Service
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                About
              </Link>
            </div>
            <div className="flex space-x-4">
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsTelegram className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsTwitterX className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsYoutube className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#1e2033] text-center text-gray-500 text-xs">
            © {new Date().getFullYear()} Solana FlowCode. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Add global styles for animations and fonts */}
      <LandingStyles />
    </div>
  )
} 