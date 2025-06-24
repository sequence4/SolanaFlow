"use client"

import { toast as sonnerToast } from "sonner"

export type ToastArgs = {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

/** Return the actual toast function so call-sites can do:
 *   const toast = useToast();
 *   toast({ title: "…" })
 */
export function useToast() {
  return ({ title, description, variant }: ToastArgs) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description })
    } else {
      sonnerToast.success(title, { description })
    }
  }
}