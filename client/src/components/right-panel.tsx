"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Chat from "@/components/main/chat/Chat"
import {
  MessageSquare,
} from "lucide-react"

export function RightPanel() {
  const [isMinimized, setIsMinimized] = useState(false)

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full w-14 h-14 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-sidebar border-l border-sidebar-border flex flex-col shadow-sm">
      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </div>
  )
}