"use client"

import { useEffect, useState } from "react"
import WaitlistForm from "./WaitlistForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { POPUP_ACCENT_RGB } from "./WaitlistForm"

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        style={{ "--popup-accent": POPUP_ACCENT_RGB } as React.CSSProperties }
        className="sm:max-w-[600px] p-0 bg-transparent border-none rounded-lg shadow-none"
      >
        <WaitlistForm onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
} 