"use client"

import React from "react"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-[#0f1123] border-t border-[#1e2033]">
      <div className="container mx-auto max-w-7xl px-4 py-10 lg:py-16">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-4 h-4 md:w-5 md:h-5 relative">
                <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
                <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
              </div>
              <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: '"DM Sans", sans-serif' }}>
                <span className="text-white">Solana</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]">Flow</span>
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8">
            <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
              Contact
            </Link>
            <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
              Privacy Policy
            </Link>
          </div>
        </div>
        
        <div className="pt-6 border-t border-[#1e2033] text-center">
          <p className="text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} Sequence4 Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
} 