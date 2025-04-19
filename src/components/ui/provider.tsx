'use client'

import { ColorModeProvider } from './color-mode'

export interface ProviderProps {
  children?: React.ReactNode;
}

export function Provider(props: ProviderProps) {
  return (
    <ColorModeProvider {...props} />
  )
}
