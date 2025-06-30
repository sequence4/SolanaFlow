/* eslint-disable react-hooks/exhaustive-deps */
'use client';

/* ShadCN-compatible toast hook — stripped-down version */
import * as React from 'react'

type ToastEntry = {
  id: string
  title: string
  description?: string
  /** optional JSX shown at RHS of each toast */
  action?: React.ReactNode
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([])
  const push = React.useCallback(
    (t: Omit<ToastEntry, 'id'>) =>
      setToasts(list => [...list, { id: crypto.randomUUID(), ...t }]),
    [],
  )
  const dismiss = React.useCallback(
    (id: string) => setToasts(list => list.filter(t => t.id !== id)),
    [],
  )
  return { toasts, push, dismiss }
}

/* Re-export ShadCN provider/view if you need it elsewhere */
export { ToastProvider, ToastViewport } from '@radix-ui/react-toast' 