import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import ThemeProvider from "@/components/theme-provider"
import { WalletContextProvider } from "@/components/wallet-context-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SolMint - Solana Token Minting dApp",
  description: "A beautiful Solana dApp for minting SPL tokens",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <WalletContextProvider>
            {children}
            <div id="toast-container" className="fixed top-0 right-0 p-4 z-50" />
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 