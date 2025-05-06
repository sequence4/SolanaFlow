"use client"

import React from "react"
import { Button } from "@/components/ui/button"

interface CallToActionProps {
  openWaitlistModal: () => void
}

export default function CallToAction({ openWaitlistModal }: CallToActionProps) {
  return (
    <section className="relative pb-20 pt-16 lg:pt-24 lg:pb-32 px-4 md:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e2033]/50 via-[#0a0b14] to-[#0a0b14] z-[-1]"></div>
      
      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden z-[-1]">
        <div className="absolute w-full h-full">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#5580ff]/10"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 10 + 2}px`,
                height: `${Math.random() * 10 + 2}px`,
                opacity: Math.random() * 0.5 + 0.2,
                animation: `float ${Math.random() * 10 + 15}s linear infinite`,
                animationDelay: `-${Math.random() * 20}s`,
              }}
            ></div>
          ))}
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl hd:text-6xl font-bold mb-6 tracking-tight text-balance" style={{ fontFamily: '"DM Sans", sans-serif' }}>
          <span className="text-white">Ready to</span>{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
              style={{
              backgroundSize: "300% 300%",
              animation: "gradientFlow 3s ease infinite"
              }}>Build</span>{" "}
          <span className="text-white">on Solana?</span>
        </h2>
        
        <p className="text-gray-400 max-w-2xl mx-auto mb-10 text-base md:text-lg">
          Join our waitlist to get early access to SolanaFlow and start building your blockchain applications without writing a single line of code.
        </p>
        
        <Button 
          onClick={openWaitlistModal}
          className="relative z-0 font-medium rounded whitespace-nowrap gradient-border-button"
          style={{ borderRadius: '4px', backgroundColor: '#0d0e1a', padding: '8px 24px' }}
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
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px]">
            <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-[#1e2033] rounded-full mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 md:h-8 md:w-8 text-[#5580ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-1">Lightning Fast</h3>
            <p className="text-gray-400 text-sm text-center">Build dApps in minutes instead of weeks</p>
          </div>
          
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px]">
            <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-[#1e2033] rounded-full mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 md:h-8 md:w-8 text-[#1cf6a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-1">Secure Code</h3>
            <p className="text-gray-400 text-sm text-center">AI-generated code follows best security practices</p>
          </div>
          
          <div className="flex flex-col items-center max-w-[160px] md:max-w-[180px]">
            <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-[#1e2033] rounded-full mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 md:h-8 md:w-8 text-[#9945ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-1">No Code Needed</h3>
            <p className="text-gray-400 text-sm text-center">Build complex dApps with just your ideas</p>
          </div>
        </div>
        
        <style jsx global>{`
          @keyframes float {
            0% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(100px);
            }
            100% {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </section>
  )
} 