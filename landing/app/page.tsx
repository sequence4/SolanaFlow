"use client"

import React, { useEffect, useState, useLayoutEffect } from "react"
import Head from "next/head"
import LandingStyles from "@/components/landing/style"
import dynamic from "next/dynamic"
import HeroSection from "@/components/landing/HeroSection"
import Navbar from "@/components/landing/Navbar"
import FeaturesSection from "@/components/landing/FeaturesSection"
import DemoSection from "@/components/landing/DemoSection"
import CallToAction from "@/components/landing/CallToAction"
import Footer from "@/components/landing/Footer"
import BackgroundEffect from "@/components/landing/BackgroundEffect"
import FeaturesBackground from "@/components/landing/FeaturesBackground"
import { useHeroScale } from "@/hooks/useHeroScale"

const WaitlistModal = dynamic(() => import("@/components/WaitlistModal"), {
  ssr: false,
})

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false)
  
  useHeroScale(920, 64)

  const openWaitlistModal = () => setIsWaitlistModalOpen(true)
  const closeWaitlistModal = () => setIsWaitlistModalOpen(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useLayoutEffect(() => {
    document.body.classList.add('with-fixed-nav');
    return () => document.body.classList.remove('with-fixed-nav');
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0c1c] text-white font-mono overflow-x-hidden">
      {mounted && (
        <WaitlistModal 
          isOpen={isWaitlistModalOpen} 
          onClose={closeWaitlistModal} 
        />
      )}
      
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
          rel="stylesheet" 
        />
      </Head>

      <BackgroundEffect mounted={mounted} />
      
      <Navbar openWaitlistModal={openWaitlistModal} />
      
      <main>
        <HeroSection mounted={mounted} openWaitlistModal={openWaitlistModal} />

        <section id="features" className="relative py-16 lg:py-24 px-4 sm:px-10 bg-[#0f162a] overflow-hidden">
          <FeaturesBackground />
          <div className="container mx-auto max-w-7xl">
            <FeaturesSection />
          </div>
        </section>

        <DemoSection />
        
        <CallToAction openWaitlistModal={openWaitlistModal} />
      </main>

      <Footer />
      <LandingStyles />
    </div>
  )
} 