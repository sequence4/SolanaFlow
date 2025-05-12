"use client"

import React from "react"
import type { FC } from "react"

const DemoSection: FC = () => {
  return (
    <section id="demo" className="py-20 bg-[#090a12] ">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
              <span className="mr-2">▶</span> Demo
            </span>
          </div>
          <h2 className="text-3xl md:text-3xl font-bold mb-4 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                style={{
                  backgroundSize: "300% 300%",
                  animation: "gradientFlow 3s ease infinite"
                }}>
              Preview SolanaFlow MVP in Action
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm">
            See how easily you can build and deploy Solana dApps.  </p>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm">
            Beta launching imminently — join the waitlist now!
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2d4a] shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d0e1a] to-[#0a0b14] flex flex-col items-center justify-center">
            <video 
              src="/assets/solanaflow-demo.mp4" 
              autoPlay 
              muted 
              loop 
              playsInline
              className="w-full h-full object-cover" 
            />
            </div>
          </div>

          {/*
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 ">
            <div className="relative group bg-[#0a0b14]/80 backdrop-blur-sm border border-[#2a2d4a] rounded-[5px] p-4 overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:border-[#5580ff]">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#5580ff] to-transparent opacity-50"></div>
              <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-[#5580ff] via-transparent to-transparent opacity-50"></div>
              <div className="flex flex-col pt-2">
                <h3 className="font-semibold text-sm mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
                    Intuitive Workflow Designer
                  </span> 
                </h3>
                <p className="text-gray-400 text-xs">
                  Visually assemble your dApp architecture effortlessly using drag-and-drop components.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient
                      id="paint0_radial_1"
                      cx="0"
                      cy="0"
                      r="1"
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="translate(32 32) rotate(90) scale(32)"
                    >
                      <stop stopColor="white" />
                      <stop offset="1" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="relative group bg-[#0a0b14]/80 backdrop-blur-sm border border-[#2a2d4a] rounded-[5px] p-4 overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:border-[#a855f7]">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#a855f7] to-transparent opacity-50"></div>
              <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-[#a855f7] via-transparent to-transparent opacity-50"></div>
              <div className="flex flex-col pt-2">
                <h3 className="font-semibold text-sm mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
                  Advanced Code Customization
                </span>
                </h3>
                <p className="text-gray-400 text-xs">
                  Easily fine-tune smart contracts and frontend logic within our powerful integrated IDE.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient
                      id="paint0_radial_2"
                      cx="0"
                      cy="0"
                      r="1"
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="translate(32 32) rotate(90) scale(32)"
                    >
                      <stop stopColor="white" />
                      <stop offset="1" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="relative group bg-[#0a0b14]/80 backdrop-blur-sm border border-[#2a2d4a] rounded-[5px] p-5 overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:border-[#00c2ff]">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00c2ff] to-transparent opacity-50"></div>
              <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-[#00c2ff] via-transparent to-transparent opacity-50"></div>
              <div className="flex flex-col">
                <h3 className="font-semibold text-sm mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
                  Streamlined Deployment & Monitoring
                </span>
                </h3>
                <p className="text-gray-400 text-xs">
                  Deploy instantly to Solana testnet or mainnet, then monitor and optimize your dApp&#39;s performance in real-time.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient
                      id="paint0_radial_3"
                      cx="0"
                      cy="0"
                      r="1"
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="translate(32 32) rotate(90) scale(32)"
                    >
                      <stop stopColor="white" />
                      <stop offset="1" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
          */}
        </div>
      </div>
    </section>
  )
}

export default DemoSection 