"use client"

import { useEffect, useState } from "react"
import { Send } from "lucide-react"

interface UserMessageBoxProps {
  messages: string[]
  typingSpeed?: number
  delayBetweenMessages?: number
  className?: string
}

export default function UserMessageBox({
  messages = [
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
  ],
  typingSpeed = 50,
  delayBetweenMessages = 3000,
  className = "",
}: UserMessageBoxProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (isTyping) {
      if (displayedText.length < messages[currentMessageIndex].length) {
        timeout = setTimeout(() => {
          setDisplayedText(messages[currentMessageIndex].substring(0, displayedText.length + 1))
        }, typingSpeed)
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true)
          setIsTyping(false)
        }, delayBetweenMessages)
      }
    } else if (isDeleting) {
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(displayedText.substring(0, displayedText.length - 1))
        }, typingSpeed / 2) 
      } else {
        setIsDeleting(false)
        setIsTyping(true)
        setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length)
      }
    }

    return () => clearTimeout(timeout)
  }, [displayedText, currentMessageIndex, isTyping, isDeleting, messages, typingSpeed, delayBetweenMessages])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)

    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <div className={`bg-[#0a0b14] rounded-lg p-4 ${className} relative overflow-hidden`}>
      {/* Animated background orbs */}
      <div className="absolute inset-0 z-0" style={{ overflow: 'hidden' }}>
        {/* Blue orb */}
        <div 
          className="absolute w-32 h-32 rounded-full opacity-5 hidden sm:block"
          style={{
            background: 'radial-gradient(circle, #5f88dc 0%, rgba(95,136,220,0) 70%)',
            filter: 'blur(8px)',
            top: '10%',
            left: '10%',
            animation: 'floatOrb1 15s ease-in-out infinite, pulseOrb 8s ease-in-out infinite'
          }}
        />
        
        {/* Green orb */}
        <div 
          className="absolute w-40 h-40 rounded-full opacity-5 hidden sm:block"
          style={{
            background: 'radial-gradient(circle, #1cf6a0 0%, rgba(28,246,160,0) 70%)',
            filter: 'blur(8px)',
            bottom: '10%',
            right: '15%',
            animation: 'floatOrb2 18s ease-in-out infinite, pulseOrb 6s ease-in-out infinite'
          }}
        />
        
        {/* Purple orb */}
        <div 
          className="absolute w-36 h-36 rounded-full opacity-5 hidden sm:block"
          style={{
            background: 'radial-gradient(circle, #9945ff 0%, rgba(153,69,255,0) 70%)',
            filter: 'blur(8px)',
            bottom: '20%',
            left: '40%',
            animation: 'floatOrb3 12s ease-in-out infinite, pulseOrb 10s ease-in-out infinite'
          }}
        />
        
        {/* Flowing gradient background for additional effect */}
        <div 
          className="absolute inset-0 opacity-10 hidden sm:block" 
          style={{
            background: 'linear-gradient(60deg, #5f88dc, #1cf6a0, #9945ff)',
            backgroundSize: '300% 300%',
            animation: 'gradientFlow 5s ease infinite',
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes gradientFlow {
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
        
        @keyframes floatOrb1 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(100%, 50%); }
          50% { transform: translate(80%, 100%); }
          75% { transform: translate(-50%, 50%); }
          100% { transform: translate(0, 0); }
        }
        
        @keyframes floatOrb2 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-70%, -30%); }
          50% { transform: translate(-20%, -80%); }
          75% { transform: translate(50%, -40%); }
          100% { transform: translate(0, 0); }
        }
        
        @keyframes floatOrb3 {
          0% { transform: translate(0, 0); }
          33% { transform: translate(50%, -30%); }
          66% { transform: translate(-30%, -50%); }
          100% { transform: translate(0, 0); }
        }
        
        @keyframes pulseOrb {
          0% { opacity: 0.1; }
          50% { opacity: 0.3; }
          100% { opacity: 0.1; }
        }
      `}</style>

      <div className="relative z-10">
        <div className="flex justify-between items-center">
          <div className="h-[3rem] sm:h-[5rem] flex-1 bg-[#0d0e1a] border border-[#2a2d4a] rounded-xl p-2 sm:p-4 shadow-sm">
            <div className="min-h-[24px] text-gray-400 text-sm sm:text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {displayedText}
              {showCursor && <span className="inline-block w-2 h-4 bg-[#5580ff] ml-0.5">&nbsp;</span>}
            </div>
          </div>
          <button
            className="ml-2 p-2 bg-[#161726] border border-[#2a2d4a] cursor-default text-white rounded-full flex items-center justify-center"
            aria-label="Send message"
          >
            <Send size={14} className="text-[#5580ff]"/>
          </button>
        </div>
      </div>
    </div>
  )
} 