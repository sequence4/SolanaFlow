"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Chat from "@/components/main/chat/Chat"
import {
  Edit,
  Folder,
  Save,
  Plus,
  Play,
  Upload,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  X,
} from "lucide-react"

export function RightPanel() {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true)
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
      <div className="border-b border-sidebar-border">
        <button
          onClick={() => setIsProjectExpanded(!isProjectExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-sidebar-accent transition-all duration-200 group"
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">PROJECT</span>
          <div className="transform transition-transform duration-200 group-hover:scale-110">
            {isProjectExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${isProjectExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-heading font-bold text-lg">My Token Project</h2>
              <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200 hover:scale-110" />
            </div>

            <div className="flex gap-1 mb-4">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                Token
              </Badge>
              <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                Mint
              </Badge>
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                Transfer
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent hover:bg-sidebar-accent transition-all duration-200 hover:shadow-sm"
              >
                <Folder className="w-4 h-4 mr-1" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent hover:bg-sidebar-accent transition-all duration-200 hover:shadow-sm"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent hover:bg-sidebar-accent transition-all duration-200 hover:shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            <div className="space-y-2">
              <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg">
                <Play className="w-4 h-4 mr-2" />
                Build Program
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent hover:bg-sidebar-accent transition-all duration-200 hover:shadow-sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                Deploy Program
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </div>
  )
}