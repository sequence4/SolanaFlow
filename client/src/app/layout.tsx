import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "@/styles/globals.css";
import "@/utils/polyfills";

import Providers from "@/components/Providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
})

export const metadata: Metadata = {
  title: "SolanaFlow - Visual Programming Interface",
  description: "Modern visual programming interface for Solana blockchain development",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Script to apply theme before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (
                    theme === 'dark' ||
                    (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
                  ) {
                    document.documentElement.classList.add('dark');
                  }
                } catch {}
              })();
            `
          }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${dmSans.variable} dark font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
