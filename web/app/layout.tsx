import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import ThemeProvider from "@/components/theme-provider"
import ClientWalletProvider from "@/components/WalletProvider"
import { Toaster } from "@/components/ui/toaster"

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
          <ClientWalletProvider>
            {children}
            <Toaster />
          </ClientWalletProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 