"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import TechBackground, { LightningIcon, SecurityIcon, NoCodeIcon } from "./TechBackground"

interface CallToActionProps {
  openWaitlistModal: () => void
}

export default function CallToAction({ openWaitlistModal }: CallToActionProps) {
  return (
    <section className="relative pt-10 px-4 md:px-6 lg:px-8 overflow-hidden min-h-[70vh]">
      <div className="absolute inset-0 z-0">
        <TechBackground />
      </div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10 mt-[var(--navH,64px)]">
        <h2 className="text-3xl md:text-3xl lg:text-4xl hd:text-6xl font-bold mb-6 tracking-tight text-balance" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
          <span className="text-white">Ready to</span>{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
              style={{
              backgroundSize: "300% 300%",
              animation: "gradientFlow 3s ease infinite"
              }}>Build</span>{" "}
          <span className="text-white">on Solana?</span>
        </h2>
        
        <p className="text-gray-500 max-w-xl mx-auto mb-10 text-base md:text-md" style={{ fontFamily: 'var(--font-oxygen-mono)' }}>
          Join our waitlist to get early access to SolanaFlow and start building your blockchain applications without writing a single line of code.
        </p>
        
        <Button 
          onClick={openWaitlistModal}
          className="relative z-0 font-medium rounded whitespace-nowrap gradient-border-button"
          style={{ borderRadius: '4px', backgroundColor: 'rgba(15, 17, 35, 0.7)', padding: '8px 24px' }}
        >
          <span className="relative z-10 text-base font-medium gradient-text">
            Join the Waitlist
          </span>
        </Button>
        
        <style jsx global>{`
          .gradient-border-button {
            position: relative;
            z-index: 0;
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
        
        <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-10 items-center">
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="mb-3">
              <LightningIcon />
            </div>
            <h3 className="text-white font-bold mb-1">Lightning Fast</h3>
            <p className="text-gray-400 text-sm text-center">Build dApps in minutes instead of weeks</p>
          </div>
          
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="mb-3">
              <SecurityIcon />
            </div>
            <h3 className="text-white font-bold mb-1">Secure Code</h3>
            <p className="text-gray-400 text-sm text-center">AI-generated code follows best security practices</p>
          </div>
          
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="mb-3">
              <NoCodeIcon />
            </div>
            <h3 className="text-white font-bold mb-1">No Code Needed</h3>
            <p className="text-gray-400 text-sm text-center">Build complex dApps with just your ideas</p>
          </div>
        </div>
      </div>
    </section>
  )
} 