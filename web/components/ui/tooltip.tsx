"use client"

import * as React from "react"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function TooltipTrigger({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props}>{children}</button>
}

export function TooltipContent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2" {...props}>
      {children}
    </div>
  )
} 