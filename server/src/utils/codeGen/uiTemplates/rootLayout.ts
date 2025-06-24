export const rootLayout = `import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css"; // wallet-adapter preset
import ThemeProvider from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/hooks/use-toast";
import { WalletContextProvider } from "@/components/wallet-context-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SolMint - Solana Token Minting dApp",
  description: "A beautiful Solana dApp for minting SPL tokens",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <WalletContextProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
            <Toaster />
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
`;
