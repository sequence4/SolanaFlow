"use client"

import React from "react"

export default function FeaturesBackground() {
  return (
    <>
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-full w-full border-r border-white/5" />
          ))}
        </div>
        <div className="absolute inset-0 grid grid-rows-12 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-full w-full border-b border-white/5" />
          ))}
        </div>
      </div>

      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#45a3f7]/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-[#8b5cf6]/20 rounded-full blur-[120px]" />
    </>
  )
} 