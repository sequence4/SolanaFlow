"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import MobileMenu from "./MobileMenu"
import { Menu } from "lucide-react"

interface NavbarProps {
  openWaitlistModal: () => void
}

export default function Navbar({ openWaitlistModal }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Set the initial navbar height on mount
  useEffect(() => {
    const navElement = document.getElementById('site-nav');
    if (navElement) {
      const height = navElement.offsetHeight;
      document.documentElement.style.setProperty('--navH', `${height}px`);
    }
  }, []);

  return (
    <>
      <nav id="site-nav" className="fixed top-0 left-0 right-0 z-10 border-b border-[#1e2033] bg-[#0a0b14]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 md:w-6 md:h-6 relative">
              <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
              <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
            </div>
            <span className="text-[18px] xs:text-[20px] sm:text-[26px] md:text-xl lg:text-2xl xl:text-2xl font-bold tracking-tighter" style={{ fontFamily: '"DM Sans", sans-serif' }}>
              <span className="text-white">Solana</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                style={{
                  backgroundSize: "300% 300%",
                  animation: "gradientFlow 3s ease infinite"
                }}>Flow</span>
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-12">
            <Link href="#features" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
                Features
            </Link>
            <Link href="#demo" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
                Demo
            </Link>
            <Button 
              data-testid="open-waitlist-form"
              size="sm" 
              className="relative z-0 text-white font-medium rounded whitespace-nowrap" 
              style={{ border: 'none', backgroundColor: 'transparent' }}
              onClick={openWaitlistModal}
            >
              <span className="relative z-10 cursor-pointer text-sm font-bold sm:text-sm gradient-text">Join the Waitlist</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <MobileMenu 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
        openWaitlistModal={openWaitlistModal} 
      />
    </>
  )
} 