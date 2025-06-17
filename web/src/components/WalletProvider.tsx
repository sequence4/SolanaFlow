"use client";

import React, { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Import dynamically with ssr:false
const WalletConnectionProvider = dynamic(
  () => import("../context/WalletConnectionProvider").then(m => m.default),
  { ssr: false }
);

export default function ClientWalletProvider({ children }: { children: ReactNode }) {
  return <WalletConnectionProvider>{children}</WalletConnectionProvider>;
} 