"use client"

import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"

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
    <div className={`w-full max-w-[650px] mx-auto relative ${className}`}>
      {/* Subtle label */}
      <div className="absolute -top-6 left-2 text-xs text-[#6c7793] font-light tracking-wider">
        <span className="text-[#00e2c3]">AI</span> <span className="opacity-70">ASSISTANT</span>
      </div>

      <div className="relative group">
        {/* Input container */}
        <div className="relative flex items-start bg-[#121420] border border-[#2a2e3f] rounded-lg overflow-hidden group-hover:border-[#3a3f52] transition-colors duration-300 shadow-lg">
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#00c2ff] to-[#00e2c3]"></div>

          <div className="w-full bg-transparent outline-none py-4 pl-6 pr-12 text-gray-200 text-sm min-h-[80px] h-auto max-h-[120px]">
            <div className="overflow-hidden line-clamp-3 break-words">
              {displayedText}
              {showCursor && <span className="inline-block w-1.5 h-4 bg-[#5580ff] ml-0.5">&nbsp;</span>}
            </div>
          </div>

          <button
            className={cn(
              "absolute right-3 top-3 p-2 rounded-full",
              "bg-gradient-to-r from-[#00c2ff] to-[#00e2c3]",
              "text-black hover:opacity-90 transition-all",
              "flex items-center justify-center",
              "transform hover:scale-105",
              "shadow-[0_0_15px_rgba(0,194,255,0.3)]",
            )}
            aria-label="Send message"
          >
            <Send size={16} className="text-[#0d1117]" />
          </button>
        </div>

        {/* Glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00c2ff] to-[#00e2c3] opacity-0 group-hover:opacity-15 rounded-lg blur-md transition-opacity duration-300"></div>

        {/* Subtle tech pattern */}
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyek0yNCAzNGgydi00aC0ydjR6bTAtNnYtNGgtMnY0aDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        </div>
      </div>
    </div>
  )
} 