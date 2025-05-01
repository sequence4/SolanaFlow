"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import WaitlistForm from "./WaitlistForm"

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [isMounted, setIsMounted] = useState(false)

  // Handle ESC key press
  useEffect(() => {
    setIsMounted(true)
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    
    if (isOpen) {
      document.addEventListener("keydown", handleEsc)
      // Prevent scrolling when modal is open
      document.body.style.overflow = "hidden"
    }
    
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = "auto"
    }
  }, [isOpen, onClose])

  if (!isMounted) return null

  if (!isOpen) return null

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative w-full max-w-4xl mx-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <WaitlistForm onClose={onClose} />
      </div>
    </div>
  )
} 