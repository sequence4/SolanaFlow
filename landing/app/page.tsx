"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code } from "lucide-react"
import { BsTelegram } from "react-icons/bs";
import { BsTwitterX } from "react-icons/bs";
import { BsYoutube } from "react-icons/bs";
import InstructionFlow from "@/components/landing/InstructionFlow"
import Head from "next/head"
import TypewriterCode from "@/components/landing/TypeWriterCode"
import LandingStyles from "@/components/landing/style"
import ScrollReveal from "@/components/landing/ScrollReveal"
import dynamic from "next/dynamic"
import UserMessageBox from "@/components/landing/UserMessageBox"
import FeaturesSection from "@/components/landing/FeaturesSection"

const WaitlistModal = dynamic(() => import("@/components/WaitlistModal"), {
  ssr: false,
})

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false)

  const openWaitlistModal = () => setIsWaitlistModalOpen(true)
  const closeWaitlistModal = () => setIsWaitlistModalOpen(false)

  useEffect(() => {
    setMounted(true)

    return () => {
      setMounted(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-mono overflow-x-hidden">
      {/* Waitlist Modal */}
      {mounted && (
        <WaitlistModal 
          isOpen={isWaitlistModalOpen} 
          onClose={closeWaitlistModal} 
        />
      )}
      
      {/* Google Fonts Integration */}
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
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
        <div className="container mx-auto px-0 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 relative">
              <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
              <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
            </div>
            <span className="text-2xl font-bold tracking-tighter" style={{ fontFamily: '"DM Sans", sans-serif' }}>
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
      <section className="flex justify-center px-[8%] pt-[5%] pb-[8%] w-full h-[100vh] overflow-hidden">
        <div className="w-full h-full z-10">
            <div className="flex flex-col w-full h-full md:flex-row items-start">
                {/* Left side content */}
                <div className="flex flex-col justify-center gap-2 sm:gap-0 lg:gap-0 max-lg:gap-4 h-full w-full sm:w-2/5 md:w-3/5 lg:w-2/5 mb-12 md:mb-0 pr-0 md:pr-4 lg:pr-8">
                    <div className="flex flex-col gap-0 justify-start">
                        <div className="w-fit inline-block px-2 sm:px-3 py-1 mb-4 sm:mb-6 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
                        <span className="mr-2">●</span> Visual AI Developer Tool for Solana
                        </div>
                        <h1 className="text-lg sm:text-lg md:text-xl lg:text-2xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight" style={{ fontFamily: '"DM Sans", sans-serif' }}>
                        <span className="block">Deploy Solana dApps</span>
                        <span className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl max-lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                            style={{
                            backgroundSize: "300% 300%",
                            animation: "gradientFlow 3s ease infinite"
                            }}>
                            Without Code
                        </span>
                        </h1>
                    </div>
                    <div className="text-gray-400 mb-6 sm:mb-8 w-full text-sm sm:text-xs md:text-xs lg:text-[13px] max-lg:text-sm leading-relaxed py-2 px-4">
                    <ul className="list-disc list-outside ml-6 space-y-4">
                      <li className="pl-2">
                        <span className="text-white font-semibold">AI&nbsp;Powered&nbsp;Development</span> – Turn ideas into secure Solana dApps with natural-language instructions.
                      </li>
                      <li className="pl-2">
                        <span className="text-white font-semibold">Visual&nbsp;Workflow&nbsp;Builder</span> – Drag-and-drop pre-audited Solana modules for fast, reliable builds.
                      </li>
                      <li className="pl-2">
                        <span className="text-white font-semibold">Instant&nbsp;Deployment</span> – Ship to devnet or mainnet in a single click.
                      </li>
                      <li className="pl-2">
                        <span className="text-white font-semibold">Live&nbsp;Iterations</span> – Update logic and push upgrades in real time.
                      </li>
                      <li className="pl-2">
                        <span className="text-white font-semibold">Collaborative&nbsp;Workspace</span> – Real-time co-editing with built-in version control.
                      </li>
                    </ul>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-start gap-8">
                        <Button 
                          size="default" 
                          className="relative z-0 text-white font-medium rounded whitespace-nowrap gradient-border-button" 
                          style={{ borderRadius: '4px', backgroundColor: '#0d0e1a' }}
                          onClick={openWaitlistModal}
                        >
                          <span className="relative z-10 cursor-pointer text-xs font-bold sm:text-sm gradient-text">Join the Waitlist</span>
                        </Button>

                        <style jsx global>{`
                          .gradient-border-button {
                            position: relative;
                            z-index: 0;
                            padding: 8px 16px;
                            border: none;
                            overflow: hidden;
                          }
                          
                          .gradient-border-button::before {
                            content: '';
                            position: absolute;
                            z-index: -2;
                            inset: 0;
                            padding: 2px;
                            border-radius: inherit;
                            background: linear-gradient(60deg, #5f88dc, #1cf6a0, #9945ff);
                            background-size: 300% 300%;
                            animation: gradientBorderFlow 3s ease infinite;
                            -webkit-mask: 
                              linear-gradient(#fff 0 0) content-box, 
                              linear-gradient(#fff 0 0);
                            -webkit-mask-composite: xor;
                            mask-composite: exclude;
                          }
                          
                          .gradient-text {
                            background: linear-gradient(60deg, #5f88dc, #1cf6a0, #9945ff);
                            background-size: 300% 300%;
                            animation: gradientBorderFlow 3s ease infinite;
                            -webkit-background-clip: text;
                            background-clip: text;
                            color: transparent;
                          }
                          
                          @keyframes gradientBorderFlow {
                            0% {
                              background-position: 0% 50%;
                            }
                            50% {
                              background-position: 100% 50%;
                            }
                            100% {
                              background-position: 0% 50%;
                            }
                          }
                        `}</style>

                        <div className="flex items-center justify-between gap-2 hover:bg-none mt-2 sm:mt-0">
                            <Button size="icon" variant="ghost"><BsTwitterX className="h-4 w-4 sm:h-5 sm:w-5 text-[#cfd2d3] cursor-pointer hover:bg-none" /></Button>
                            <Button size="icon" variant="ghost"><BsTelegram className="h-4 w-4 sm:h-5 sm:w-5 text-[#cfd2d3] cursor-pointer hover:bg-none" /></Button>
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
              <div className="w-full h-full flex flex-col min-w-[320px] max-w-[500px] flex-shrink-0">
                <div className="w-full h-full rounded-xl">
                  <div className="w-full h-full rounded-xl overflow-hidden border border-[#2a2d4a] bg-[#0d0e1a] relative flex flex-col min-h-0">
                    <div className="flex items-center px-4 py-2 bg-[#1e2033] border-b border-[#2a2d4a] rounded-lg ">
                      <div className="flex space-x-2 rounded-lg">
                        <div className="w-2 h-2 sm:w-1 sm:h-1 rounded-full bg-[#ff5f57]"></div>
                        <div className="w-2 h-2 sm:w-1 sm:h-1 rounded-full bg-[#febc2e]"></div>
                        <div className="w-2 h-2 sm:w-1 sm:h-1 rounded-full bg-[#28c840]"></div>
                      </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 overflow-x-auto">
                      {mounted && <TypewriterCode />}
                    </div>
                  </div>
                </div>
                
                {/* User Message Box */}
                <div className="w-full mt-4 rounded-xl">
                  <div className="w-full rounded-xl overflow-hidden border border-[#2a2d4a] relative">
                    {mounted && <UserMessageBox 
                      messages={[
                        "Generate a Solana wallet dApp that connects Phantom, shows balances, and lets users send SOL",
                        "Deploy a fixed-supply SPL token and create a simple web mint/burn interface",
                        "Create an NFT mint site using Candy Machine v3 for a 1,000-item collection",
                        "Build a token-swap dApp with Jupiter to trade SOL ↔ USDC",
                        "Set up a staking dashboard and contract for my SPL token with reward claims",
                        "Launch a DAO dApp with on-chain proposal creation and token-weighted voting",
                        "Spin up a crowdfunding platform that releases funds only if the goal is reached",
                        "Create a monthly USDC subscription billing dApp with automatic charges",
                        "Generate a weekly raffle contract that picks random winners and pays out SOL",
                        "Build a simple arcade game smart contract that rewards top scores in SOL"
                      ]}
                      typingSpeed={50}
                      delayBetweenMessages={3000}
                      className="w-full"
                    />}
                  </div>
                </div>
              </div>
            </div>
        </div>
    </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 px-10 bg-[#050508] overflow-hidden">
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

        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#5580ff]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-[#a855f7]/20 rounded-full blur-[120px]" />

        <FeaturesSection />
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
                See SolanFlow beta in Action
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
                  <h3 className="font-semibold text-sm">Intuitive Workflow Designer</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Visually assemble your dApp architecture effortlessly using drag-and-drop components.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#a855f7]/20 flex items-center justify-center mr-3">
                    <span className="text-[#a855f7] font-bold">2</span>
                  </div>
                  <h3 className="font-semibold text-sm">Advanced Code Customization</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Easily fine-tune smart contracts and frontend logic within our powerful integrated IDE.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#00c2ff]/20 flex items-center justify-center mr-3">
                    <span className="text-[#00c2ff] font-bold">3</span>
                  </div>
                  <h3 className="font-semibold text-sm">Streamlined Deployment & Monitoring</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Deploy instantly to Solana testnet or mainnet, then monitor and optimize your dApp's performance in real-time.
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
                <Button 
                  size="lg" 
                  className="relative z-0 font-bold px-8 rounded-lg gradient-border-button" 
                  style={{ borderRadius: '4px', backgroundColor: '#0d0e1a' }}
                  onClick={openWaitlistModal}
                >
                  <span className="relative z-10 flex items-center justify-center gradient-text">
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