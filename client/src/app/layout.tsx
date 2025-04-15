import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Oxygen_Mono } from 'next/font/google';
import "@/styles/globals.css";

import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oxygenMono = Oxygen_Mono({
  variable: "--font-oxygen-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Solana FlowCode - Build Solana dApps Without Code",
  description: "Visual AI developer tool for building and deploying Solana blockchain applications without writing code",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${oxygenMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
