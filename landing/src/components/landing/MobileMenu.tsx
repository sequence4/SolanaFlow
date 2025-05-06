"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  openWaitlistModal: () => void
}

export default function MobileMenu({ isOpen, onClose, openWaitlistModal }: MobileMenuProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm md:hidden">
      <div className="container h-full px-4 flex flex-col">
        <div className="flex justify-end pt-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center space-y-8 flex-grow">
          <Link 
            href="#features" 
            className="text-white text-xl hover:text-[#5580ff] transition-colors"
            onClick={onClose}
          >
            Features
          </Link>
          <Link 
            href="#demo" 
            className="text-white text-xl hover:text-[#5580ff] transition-colors"
            onClick={onClose}
          >
            Demo
          </Link>
          
          <Button 
            onClick={() => {
              onClose()
              openWaitlistModal()
            }}
            className="mt-6 relative z-0 text-white font-medium rounded-md whitespace-nowrap py-3 px-6 gradient-border-button"
            style={{ backgroundColor: '#0d0e1a' }}
          >
            <span className="relative z-10 cursor-pointer text-lg font-bold gradient-text">
              Join the Waitlist
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
} 