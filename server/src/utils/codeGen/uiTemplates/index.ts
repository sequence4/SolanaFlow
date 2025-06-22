export * from "./homePage";
export * from "./rootLayout";
export * from "./mintForm";
export * from "./tokenSuccess";
export * from "./wallet";
export * from "./themeToggle";
export * from "./uiButton";
export * from "./uiInput";
export * from "./uiLabel";
export * from "./utils";
export * from "./globalsCss";
export * from "./tailwindConfig";
export * from "./postcssConfig";
export * from "./walletProvider";
export * from "./solMintApp";
export * from "./card";
export * from "./badge";
export * from "./alert";
export * from "./tooltip";

/** --- Theme provider ———————————————————————————— */
export const THEME_PROVIDER_TSX = /* tsx */ `
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemeProvider } from 'next-themes'

interface Props {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

/**
 * Wraps next-themes so every page and dialog gets dark-/light-mode support.
 */
export function ThemeProvider({
  children,
  ...props
}: Props) {
  return <NextThemeProvider {...props}>{children}</NextThemeProvider>
}
`

/** --- use-toast hook + Toaster component ———————————————— */
export const USE_TOAST_TS = /* tsx */ `
'use client'

import * as React from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createContext, useContext, useState } from 'react'

export type Toast = {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (t: Omit<Toast, 'id'>) =>
    setToasts(arr => [...arr, { ...t, id: crypto.randomUUID() }])

  const remove = (id: string) =>
    setToasts(arr => arr.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 flex flex-col-reverse items-end gap-2 p-4">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex w-80 items-start justify-between rounded-md border p-4 shadow-lg',
            t.variant === 'destructive' ? 'border-red-500 bg-red-50' : 'bg-background'
          )}
        >
          <div className="flex flex-col">
            {t.title && <p className="font-medium">{t.title}</p>}
            {t.description && <p className="text-sm opacity-80">{t.description}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)}>
            {t.variant === 'destructive' ? <X size={16} /> : <Check size={16} />}
          </button>
        </div>
      ))}
    </div>
  )
}
`
