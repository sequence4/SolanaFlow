"use client"

import React, { useRef } from "react"
import { Button } from "@/components/ui/button"
import { BsTelegram, BsTwitterX } from "react-icons/bs"
import InstructionFlow from "./InstructionFlow"
import TypewriterCode from "./TypeWriterCode"
import UserMessageBox from "./UserMessageBox"
import HeroFeatureList from "./HeroFeatureList"
import BackgroundEffect from "./BackgroundEffect"
import { useAutoScale } from "@/utils/useAutoScale"
import Link from "next/link"

interface HeroSectionProps {
  mounted: boolean
  openWaitlistModal: () => void
}

export default function HeroSection({ mounted, openWaitlistModal }: HeroSectionProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  useAutoScale(innerRef)

  return (
    <section
      className="
        min-h-[calc(100vh-10rem)]
        flex flex-col justify-between
        px-6 md:px-12 xl:px-[5vw]
        py-[1vh]
      "
    >
      <div
        ref={innerRef}
        className="
          hero-wrapper
          w-full mx-auto max-w-full
          grid gap-4 lg:gap-8

          /* —— 2-column layout from 1024 px up —— */
          lg:grid-cols-[34rem_minmax(28rem,1fr)]
          lg:[grid-template-areas:'copy_flow']

          /* —— full 3-column layout only from 1536 px up —— */
          2xl:grid-cols-[34rem_minmax(28rem,1fr)_24rem]
          2xl:[grid-template-areas:'copy_flow_code']
        "
      >
        <div className="grid-in-copy flex flex-col gap-6 max-w-[32rem] min-h-0 pr-4">
          <div>
            <div className="w-fit inline-block py-1 px-2 mb-4 sm:mb-4 rounded-full bg-[#1e2033] 
                border border-[#2a2d4a] text-[10px] text-xs md:text-[10px] text-[#5580ff] mx-auto lg:mx-0">
                <span className="mr-2">●</span> Visual AI Developer Tool for Solana
            </div>
            
            <div className="flex flex-col gap-1 justify-start mb-4">
              <div className="flex flex-row">
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none text-white" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      Code
                  </span>
                </h1>
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none
                    bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]
                    text-transparent bg-clip-text" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      Smarter
                  </span>
                </h1>
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none text-white" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      .
                  </span>
                </h1>
              </div>
              <div className="flex flex-row">
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none text-white" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      Ship
                  </span>
                </h1>
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none
                    bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]
                    text-transparent bg-clip-text" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      Faster
                  </span>
                </h1>
                <h1 className="font-bold leading-tight tracking-tight text-left" 
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  <span className="block text-[clamp(2rem,3.5vw,3.5rem)] leading-none text-white" 
                      style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                      }}>
                      .
                  </span>
                </h1>
              </div>
            </div>

            <h1 className="text-[17px] sm:text-[17px] md:text-[17px] lg:text-[19px] xl:text-[21px] 3xl:text-[23px]
              font-bold leading-tight tracking-tight text-balance text-left text-gray-400" 
              style={{ fontFamily: 'var(--font-oxygen-mono)' }}>
              <span className="block">Zero to dApp in minutes — without code.</span>
            </h1>

          </div>
          <div className="space-y-2 text-[clamp(.4rem,.6vw+0.5rem,1.125rem)] text-gray-400 mb-6 md:mb-8 lg:mb-10">
            <HeroFeatureList />
          </div>
        </div>

        {/* Waitlist button and socials - repositioned to float above flow graph on desktop */}
        <div className="hero-actions flex justify-center gap-6 mt-8 lg:mt-0 lg:absolute lg:self-start lg:justify-start lg:left-[37rem] lg:top-4 lg:z-20 2xl:left-[38rem]">
          <Button 
            data-testid="open-waitlist-form"
            size="default" 
            className="relative z-0 text-white font-medium rounded whitespace-nowrap gradient-border-button" 
            style={{ borderRadius: '4px', backgroundColor: '#0d0e1a' }}
            onClick={openWaitlistModal}
          >
            <span className="relative z-10 cursor-pointer text-bold text-[11px] md:text-[12px] gradient-text">Join the Waitlist</span>
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
        <div className="flex items-center gap-2">
            <Button asChild size="icon" variant="ghost" aria-label="SolanaFlow on X">
              <Link
                href="https://x.com/Solana_FlowCode"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BsTwitterX className="h-4 w-4 sm:h-5 sm:w-5 text-[#cfd2d3]" />
              </Link>
            </Button>

            <Button asChild size="icon" variant="ghost" aria-label="SolanaFlow on Telegram">
              <Link
                href="https://t.me/+WVRI_EcdZrkyZDhk"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BsTelegram className="h-4 w-4 sm:h-5 sm:w-5 text-[#cfd2d3]" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid-in-flow hidden lg:flex items-center justify-center min-w-0">
          <div className="w-full h-full max-h-full min-w-0 lg:-translate-y-4">
            {mounted && <InstructionFlow />}
          </div>
        </div>
        <div className="grid-in-code hidden 2xl:flex basis-0 grow flex-col gap-0">
          <div className="flex-none h-[4.5rem] mb-4
             rounded-xl overflow-hidden border border-[#2a2d4a]">
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
              className="w-full h-full"
            />}
          </div>
          
          <div className="flex-1 min-h-[18rem] max-h-[calc(100%-6rem)] rounded-xl overflow-hidden border border-[#2a2d4a] bg-[#0d0e1a]">
            <div className="h-full flex flex-col rounded-xl overflow-hidden min-h-0">
              <div className="flex items-center px-4 py-2 bg-[#1e2033] border-b border-[#2a2d4a] rounded-lg">
                <div className="flex space-x-2 rounded-lg">
                  <div className="w-2 h-2 xs:w-2 xs:h-2 sm:w-2 sm:h-2 rounded-full bg-[#ff5f57]"></div>
                  <div className="w-2 h-2 xs:w-2 xs:h-2 sm:w-2 sm:h-2 rounded-full bg-[#febc2e]"></div>
                  <div className="w-2 h-2 xs:w-2 xs:h-2 sm:w-2 sm:h-2 rounded-full bg-[#28c840]"></div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {mounted && <TypewriterCode />}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div suppressHydrationWarning>
        <BackgroundEffect mounted={mounted} />
      </div>
    </section>
  )
} 