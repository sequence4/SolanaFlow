import React from "react";
import Head from "next/head";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Oxygen_Mono } from "next/font/google";
import "@/styles/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

const oxygenMono = Oxygen_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-oxygen-mono"
});

export const metadata: Metadata = {
  title: "Solana Flow",
  description: "Visual AI Developer Tool for Solana",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Head>
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
      </Head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${oxygenMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
} 