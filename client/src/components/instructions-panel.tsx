"use client"

import type React from "react"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

const instructions = [
  "amount_to_ui_amount",
  "approve",
  "approve_checked",
  "burn",
  "burn_checked",
  "close_account",
  "freeze_account",
  "initialize_account",
  "initialize_mint",
  "mint_to",
  "revoke",
  "set_authority",
  "sync_native",
  "thaw_account",
  "transfer",
  "transfer_checked",
]

const tabs = ["Instructions", "Programs", "Accounts", "Inputs"]

export function InstructionsPanel() {
  const [activeTab, setActiveTab] = useState("Instructions")
  const [searchQuery, setSearchQuery] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)

  const filteredInstructions = instructions.filter((instruction) =>
    instruction.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleDragStart = (e: React.DragEvent, instruction: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ name: instruction, type: "instruction" }))
    e.dataTransfer.effectAllowed = "copy"
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-card border-l border-border flex flex-col shadow-sm">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 hover:bg-accent transition-all duration-200 group flex items-center justify-center"
          title="Expand Panel"
        >
          <ChevronLeft className="w-5 h-5 group-hover:text-primary transition-colors" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-card border-l border-border shadow-sm">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 font-medium ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 hover:bg-accent rounded-md transition-all duration-200 group"
            title="Collapse Panel"
          >
            <ChevronRight className="w-4 h-4 group-hover:text-primary transition-colors" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white font-heading">S</span>
          </div>
          <div className="flex-1">
            <span className="font-heading font-semibold text-base">SPL Token Instructions</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                {filteredInstructions.length} items
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search instructions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 focus:shadow-sm"
          />
        </div>
      </div>

      <div className="p-4 space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {filteredInstructions.map((instruction) => (
          <Card
            key={instruction}
            className="p-3 hover:bg-accent cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:scale-[1.02] group border-border/50"
            draggable
            onDragStart={(e) => handleDragStart(e, instruction)}
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-sm" />
              <span className="text-sm font-mono font-medium group-hover:text-primary transition-colors">
                {instruction}
              </span>
            </div>
          </Card>
        ))}

        {filteredInstructions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No instructions found</p>
            <p className="text-xs mt-1">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  )
}