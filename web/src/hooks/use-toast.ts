"use client"

import * as React from "react"

export function toast({ title, description, variant = "default" }: { 
  title: string, 
  description: string,
  variant?: "default" | "destructive"
}) {
  // In a real implementation, this would use a toast library
  // For now, we'll just use a simple console.log
  console.log(`Toast: ${title} - ${description} (${variant})`)
  
  // Simple browser notification as a fallback
  if (typeof window !== "undefined") {
    const message = document.createElement("div")
    message.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
      variant === "destructive" ? "bg-red-100 border-red-500" : "bg-green-100 border-green-500"
    } border max-w-md z-50 animate-fade-in`
    
    const titleEl = document.createElement("h3")
    titleEl.className = `font-medium ${variant === "destructive" ? "text-red-800" : "text-green-800"}`
    titleEl.textContent = title
    
    const descEl = document.createElement("p")
    descEl.className = `text-sm ${variant === "destructive" ? "text-red-600" : "text-green-600"}`
    descEl.textContent = description
    
    message.appendChild(titleEl)
    message.appendChild(descEl)
    document.body.appendChild(message)
    
    setTimeout(() => {
      message.classList.add("opacity-0", "transition-opacity")
      setTimeout(() => {
        document.body.removeChild(message)
      }, 300)
    }, 3000)
  }
}