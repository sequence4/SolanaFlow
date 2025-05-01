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
    <div className={`bg-[#0a0b14] rounded-lg p-4 ${className} relative`}>
      {/* Flowing gradient effect */}
      <div 
        className="absolute inset-0 rounded-lg opacity-15" 
        style={{
          background: 'linear-gradient(60deg, rgba(10, 91, 255, 0.5), rgba(28,246,160,0.5), rgba(121, 11, 255, 0.5))',
          backgroundSize: '300% 300%',
          animation: 'gradientFlow 5s ease infinite',
          zIndex: 0
        }}
      />
      
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
      `}</style>

      <div className="relative z-10">
        <div className="flex items-end">
          <div className="flex-1 bg-[#1a1b29] rounded-2xl rounded-br-none p-4 shadow-sm">
            <div className="min-h-[24px] text-gray-400 text-xs">
              {displayedText}
              {showCursor && <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5">&nbsp;</span>}
            </div>
          </div>
          <button
            className="ml-2 p-2 bg-blue-600 cursor-default text-white rounded-full flex items-center justify-center"
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
} 