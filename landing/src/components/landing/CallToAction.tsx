"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import TechBackground, { LightningIcon, SecurityIcon } from "./TechBackground"
import { Sparkles } from "lucide-react"

interface CallToActionProps {
  openWaitlistModal: () => void
}

export default function CallToAction({ openWaitlistModal }: CallToActionProps) {
  return (
    <section className="relative py-20 px-4 md:px-6 lg:px-8 overflow-hidden min-h-[70vh]" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
      <div className="absolute inset-0 z-0">
        <TechBackground />
      </div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <h2 className="text-3xl md:text-3xl lg:text-4xl hd:text-6xl font-bold mb-6 tracking-tight text-balance" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
          <span className="text-white">Ready to</span>{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
              style={{
              backgroundSize: "300% 300%",
              animation: "gradientFlow 3s ease infinite"
              }}>Launch</span>{" "}
          <span className="text-white">on Solana?</span>
        </h2>
        
        <p className="text-gray-400 max-w-xl mx-auto mb-10 text-base md:text-md" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
          Join the SolanaFlow waitlist for early access and start creating powerful blockchain apps — no coding required.
        </p>
        
        <Button 
          onClick={openWaitlistModal}
          className="relative z-0 font-medium rounded whitespace-nowrap gradient-border-button"
          style={{ borderRadius: '4px', backgroundColor: 'rgba(15, 17, 35, 0.7)', padding: '8px 24px' }}
        >
          <span className="relative z-10 text-base font-medium gradient-text" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
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
        
        <div className="mt-14 flex flex-wrap justify-center gap-4 md:gap-14 items-stretch">
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px] w-full h-[180px] md:h-[200px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="mb-3 h-10 flex items-center justify-center">
              <LightningIcon />
            </div>
            <h3 className="text-white font-bold mb-1 text-center" style={{ fontFamily: 'var(--font-chakra-petch)' }}>Lightning-Fast</h3>
            <p className="text-gray-400 text-sm text-center mt-auto">Launch powerful Solana dApps in minutes, not weeks.</p>
          </div>
          
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px] w-full h-[180px] md:h-[200px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="mb-3 h-10 flex items-center justify-center">
              <SecurityIcon />
            </div>
            <h3 className="text-white font-bold mb-1 text-center" style={{ fontFamily: 'var(--font-chakra-petch)' }}>Security First</h3>
            <p className="text-gray-400 text-sm text-center mt-auto">Built exclusively from pre-audited, secure Solana plugins.</p>
          </div>
          
          <div className="flex flex-col gap-2 items-center max-w-[160px] md:max-w-[180px] w-full h-[180px] md:h-[200px] bg-[#0f1123]/40 p-4 rounded-lg backdrop-blur-sm border border-[#2a2d4a]">
            <div className="h-10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-[#1cf6a0]" />
            </div>
            <h3 className="text-white font-bold text-center" style={{ fontFamily: 'var(--font-chakra-petch)' }}>Purely No-Code</h3>
            <p className="text-gray-400 text-sm text-center mt-auto">Turn big ideas into powerful dApps—zero coding required.</p>
          </div>
        </div>
      </div>
    </section>
  )
} 