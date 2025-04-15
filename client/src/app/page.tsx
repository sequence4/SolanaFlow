"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code, Cpu, Layers } from "lucide-react"
import { useEffect, useState } from "react"

export default function LandingPage() {
  // State for animated elements
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Clean up animation frames on unmount
    return () => {
      setMounted(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-mono">
      {/* Matrix-like background effect */}
      <div className="fixed inset-0 z-0 opacity-5 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-[#00ff41] text-xs"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `fall ${5 + Math.random() * 15}s linear infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            >
              {String.fromCharCode(33 + Math.floor(Math.random() * 94))}
            </div>
          ))}
        </div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 border-b border-[#1e2033] bg-[#0a0b14]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 relative">
              <svg viewBox="0 0 24 24" className="w-full h-full text-white">
                <path
                  fill="currentColor"
                  d="M12,0L3,7l1.5,1.5L12,3l7.5,5.5L21,7L12,0z M3,15l9,7l9-7l-1.5-1.5L12,19l-7.5-5.5L3,15z"
                />
                <path fill="#5580ff" d="M3,7v8l1.5-1.5V8.5L12,14l7.5-5.5v5L21,15V7l-9,7L3,7z" />
              </svg>
              <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
            </div>
            <span className="text-xl font-bold tracking-tighter">
              <span className="text-white">Solana</span>
              <span className="text-[#5580ff]">FlowCode</span>
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Link href="#features" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
              Features
            </Link>
            <Link href="#demo" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
              Demo
            </Link>
            <Link href="#docs" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
              Docs
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="border-[#1e2033] text-gray-300 hover:bg-[#1e2033] hover:text-white"
            >
              Login
            </Button>
            <Button size="sm" className="bg-[#5580ff] hover:bg-[#4466cc] text-white">
              Sign Up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center">
            {/* Left side content */}
            <div className="w-full md:w-1/2 mb-12 md:mb-0 pr-0 md:pr-8">
              <div className="inline-block px-3 py-1 mb-6 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
                <span className="mr-2">●</span> Visual AI Developer Tool for Solana
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight">
                <span className="block">Build Solana dApps</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5580ff] to-[#a855f7]">
                  Without Code
                </span>
              </h1>
              <p className="text-gray-400 mb-8 max-w-lg text-sm leading-relaxed">
                <span className="text-white font-semibold">FlowCode</span> transforms English into production-ready
                Solana programs. Design, build, and deploy blockchain applications with our visual workflow builder and
                specialized IDE.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white px-8 rounded">
                  Start Building <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#2a2d4a] text-gray-300 hover:bg-[#1e2033] px-8 rounded"
                >
                  View Documentation
                </Button>
              </div>

              {/* Code snippet */}
              <div className="mt-8 rounded-lg overflow-hidden border border-[#2a2d4a] bg-[#0d0e1a] max-w-lg">
                <div className="flex items-center px-4 py-2 bg-[#1e2033] border-b border-[#2a2d4a]">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                  </div>
                  <div className="ml-4 text-xs text-gray-400">token_minting_program.rs</div>
                </div>
                <pre className="p-4 text-xs overflow-x-auto text-gray-300">
                  <code>
                    {`use anchor_lang::prelude::*;

#[program]
pub mod token_minting_program {
    use super::*;
    
    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        params: InitializeMintParams
    ) -> Result<()> {
        instructions::initialize_mint(ctx, params)
    }
    
    pub fn mint_to(
        ctx: Context<MintTo>,
        params: MintToParams
    ) -> Result<()> {
        instructions::mint_to(ctx, params)
    }
}`}
                  </code>
                </pre>
              </div>
            </div>

            {/* Right side floating elements */}
            <div className="w-full md:w-1/2 relative h-[500px]">
              {/* Floating component 1 - Workflow Node */}
              <div
                className={`absolute rounded-lg border border-[#2a2d4a] bg-[#1e2033]/80 backdrop-blur-sm p-4 w-64 shadow-lg transition-all duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
                style={{
                  top: "10%",
                  right: "5%",
                  animation: mounted ? "float 8s ease-in-out infinite" : "none",
                  zIndex: 3,
                }}
              >
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded bg-[#5580ff]/20 flex items-center justify-center mr-3">
                    <Cpu className="w-4 h-4 text-[#5580ff]" />
                  </div>
                  <h3 className="text-sm font-semibold">Initialize Mint</h3>
                </div>
                <div className="text-xs text-gray-400 mb-3">
                  Creates and initializes a new token mint account with the given decimals and authorities.
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ID: 12345</span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-400 mr-1"></span>
                    Active
                  </span>
                </div>
              </div>

              {/* Floating component 2 - Code Editor */}
              <div
                className={`absolute rounded-lg border border-[#2a2d4a] bg-[#0d0e1a]/90 backdrop-blur-sm p-4 w-72 shadow-lg transition-all duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
                style={{
                  top: "35%",
                  right: "15%",
                  animation: mounted ? "float 6s ease-in-out infinite 1s" : "none",
                  zIndex: 2,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Code className="w-4 h-4 text-[#a855f7] mr-2" />
                    <h3 className="text-xs font-semibold">Solana IDE</h3>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-[#ff5f57]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#febc2e]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#28c840]"></div>
                  </div>
                </div>
                <pre className="text-[10px] text-gray-300 bg-[#0a0b14] p-2 rounded border border-[#2a2d4a] overflow-x-auto">
                  <code>
                    {`pub fn mint_to(
  ctx: Context<MintTo>,
  amount: u64
) -> Result<()> {
  // Transfer tokens
  let cpi_accounts = MintTo {
    mint: ctx.accounts.mint.to_account_info(),
    to: ctx.accounts.destination.to_account_info(),
    authority: ctx.accounts.authority.to_account_info(),
  };
  
  token::mint_to(
    CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      cpi_accounts
    ),
    amount
  )?;
  
  Ok(())
}`}
                  </code>
                </pre>
              </div>

              {/* Floating component 3 - UI Preview */}
              <div
                className={`absolute rounded-lg border border-[#2a2d4a] bg-[#1e2033]/80 backdrop-blur-sm p-3 w-56 shadow-lg transition-all duration-1000 ${mounted ? "opacity-100" : "opacity-0"}`}
                style={{
                  top: "65%",
                  right: "25%",
                  animation: mounted ? "float 7s ease-in-out infinite 0.5s" : "none",
                  zIndex: 1,
                }}
              >
                <div className="flex items-center mb-3">
                  <div className="w-6 h-6 rounded bg-[#a855f7]/20 flex items-center justify-center mr-2">
                    <Layers className="w-3 h-3 text-[#a855f7]" />
                  </div>
                  <h3 className="text-xs font-semibold">UI Preview</h3>
                </div>
                <div className="bg-[#0a0b14] rounded border border-[#2a2d4a] p-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] text-gray-400">Connect Wallet</div>
                    <div className="px-2 py-1 rounded-full bg-[#5580ff]/20 text-[8px] text-[#5580ff]">Phantom</div>
                  </div>
                  <div className="mb-2">
                    <div className="text-[8px] text-gray-500 mb-1">Token Amount</div>
                    <div className="h-4 rounded bg-[#2a2d4a] w-full"></div>
                  </div>
                  <div className="flex justify-center">
                    <div className="px-3 py-1 rounded text-[8px] bg-[#5580ff] text-white">Mint Token</div>
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute inset-0 z-0">
                {/* Grid lines */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFmMjA0MCIgb3BhY2l0eT0iMC4yIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]"></div>

                {/* Glowing orbs */}
                <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full bg-[#5580ff]/5 blur-3xl"></div>
                <div className="absolute bottom-1/3 right-1/3 w-60 h-60 rounded-full bg-[#a855f7]/5 blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 bg-[#0d0e1a]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
              <span className="mr-2">⚡</span> Powerful Development Tools
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5580ff] to-[#a855f7]">
                Build. Deploy. Scale.
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Our platform combines cutting-edge technologies to provide a secure, intelligent, and decentralized
              development experience for Solana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Feature 1 - Workflow */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#5580ff]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#5580ff]/10 flex items-center justify-center mb-4 group-hover:bg-[#5580ff]/20 transition-colors">
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
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Visual Workflow Builder</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#5580ff] text-xs">workflow</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Drag and drop Solana plugins to visually design your dApp architecture without writing a single line of
                code.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Pre-built Solana components
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Smart contract templates
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Visual flow connections
                </li>
              </ul>
            </div>

            {/* Feature 2 - Code */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#a855f7]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#a855f7]/10 flex items-center justify-center mb-4 group-hover:bg-[#a855f7]/20 transition-colors">
                <Code className="w-6 h-6 text-[#a855f7]" />
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Solana-Specific IDE</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#a855f7] text-xs">code</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                A powerful code editor tailored specifically for Solana development with intelligent autocompletion and
                debugging.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Rust and TypeScript support
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Real-time error checking
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Integrated testing tools
                </li>
              </ul>
            </div>

            {/* Feature 3 - Interface */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#00c2ff]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#00c2ff]/10 flex items-center justify-center mb-4 group-hover:bg-[#00c2ff]/20 transition-colors">
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
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Interactive UI Builder</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#00c2ff] text-xs">interface</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Preview and interact with your generated dApp UI in real-time as you build your Solana application.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Live UI previews
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Wallet integration testing
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Responsive design tools
                </li>
              </ul>
            </div>
          </div>

          {/* Additional Features Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 4 - AI Assistant */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#00d16b]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#00d16b]/10 flex items-center justify-center mb-4 group-hover:bg-[#00d16b]/20 transition-colors">
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
                  className="w-6 h-6 text-[#00d16b]"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">AI Development Assistant</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#00d16b] text-xs">ai</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Get intelligent code suggestions, bug fixes, and optimization recommendations powered by our specialized
                Solana AI model.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00d16b] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Natural language to Solana code
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00d16b] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Smart contract security analysis
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00d16b] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Code optimization suggestions
                </li>
              </ul>
            </div>

            {/* Feature 5 - One-Click Deployment */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#ff9500]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#ff9500]/10 flex items-center justify-center mb-4 group-hover:bg-[#ff9500]/20 transition-colors">
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
                  className="w-6 h-6 text-[#ff9500]"
                >
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">One-Click Deployment</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#ff9500] text-xs">deploy</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Deploy your Solana dApps to testnet or mainnet with a single click, complete with automatic verification
                and monitoring.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#ff9500] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Testnet and mainnet support
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#ff9500] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Automated contract verification
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#ff9500] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Performance monitoring
                </li>
              </ul>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Ready to Build on Solana?</h2>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-sm">
                Join thousands of developers who are already leveraging our platform to build the next generation of
                decentralized applications on Solana.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white px-8 rounded" asChild>
                  <Link href="/main">
                    Start Building <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#2a2d4a] text-gray-300 hover:bg-[#1e2033] px-8 rounded"
                  asChild
                >
                  <Link href="/register">Create Account</Link>
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
      <footer className="bg-[#0a0b14] border-t border-[#1e2033] py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-6 md:mb-0">
              <div className="w-8 h-8 relative">
                <svg viewBox="0 0 24 24" className="w-full h-full text-white">
                  <path
                    fill="currentColor"
                    d="M12,0L3,7l1.5,1.5L12,3l7.5,5.5L21,7L12,0z M3,15l9,7l9-7l-1.5-1.5L12,19l-7.5-5.5L3,15z"
                  />
                  <path fill="#5580ff" d="M3,7v8l1.5-1.5V8.5L12,14l7.5-5.5v5L21,15V7l-9,7L3,7z" />
                </svg>
                <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
              </div>
              <span className="text-lg font-bold tracking-tighter">
                <span className="text-white">Solana</span>
                <span className="text-[#5580ff]">FlowCode</span>
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
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#1e2033] text-center text-gray-500 text-xs">
            © {new Date().getFullYear()} Solana FlowCode. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes fall {
          0% { transform: translateY(-100%); opacity: 1; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
      `}</style>

      {/* Demo Video Section */}
      <section id="demo" className="py-20 bg-[#0a0b14]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
              <span className="mr-2">▶</span> Demo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5580ff] to-[#a855f7]">
                See FlowCode in Action
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Watch how easy it is to build and deploy a Solana dApp in minutes with our visual development platform.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2d4a] shadow-2xl">
              {/* Video placeholder - replace with actual video embed */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d0e1a] to-[#0a0b14] flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#5580ff]/20 backdrop-blur-md flex items-center justify-center mb-4 cursor-pointer hover:bg-[#5580ff]/30 transition-colors">
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
                    className="w-8 h-8 text-white"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-gray-300 text-sm">Click to watch demo</p>

                {/* Terminal-like code snippets */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#00d16b] border border-[#2a2d4a]">
                    {"$ solana program deploy ./target/deploy/token_program.so"}
                  </div>
                  <div className="absolute top-2/3 right-1/4 transform translate-x-1/2 -translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#a855f7] border border-[#2a2d4a]">
                    {"pub fn mint_to(ctx: Context<MintTo>, amount: u64) -> Result<()> {"}
                  </div>
                  <div className="absolute bottom-1/4 left-1/3 transform -translate-x-1/2 translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#5580ff] border border-[#2a2d4a]">
                    {"Program deployed to: 4LQr...FvkQ"}
                  </div>
                </div>
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
    </div>
  )
}
