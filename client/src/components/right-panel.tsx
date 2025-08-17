"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Send,
  Bot,
  User,
} from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
}

export function RightPanel() {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true)
  const [isAIExpanded, setIsAIExpanded] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputValue,
        sender: "user",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, newMessage])
      setInputValue("")
      setIsTyping(true)

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: "I can help you with Solana development and workflow building. What would you like to know?",
          sender: "assistant",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiResponse])
        setIsTyping(false)
      }, 1500)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

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

      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-card to-card/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-heading font-semibold">AI Assistant</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              title="Minimize"
              className="hover:bg-accent transition-all duration-200 hover:scale-105"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <p className="font-medium mb-2">Welcome to AI Assistant</p>
              <p className="text-xs leading-relaxed">
                Ask me anything about Solana development, workflow building, or smart contract programming.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.sender === "assistant" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] p-3 rounded-xl text-sm shadow-sm ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground border border-border"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.sender === "user" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-muted border border-border p-3 rounded-xl">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-gradient-to-r from-card to-card/80">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Message the AI Assistant..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 focus:shadow-sm"
              disabled={isTyping}
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="transition-all duration-200 hover:shadow-md px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-center font-mono">v1.0.0 • SolanaFlow AI</div>
        </div>
      </div>
    </div>
  )
}