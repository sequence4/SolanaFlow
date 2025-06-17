"use client";

import React, { useState } from "react";
import MintForm from "../src/components/mint-form";
import TokenCreatedSuccess from "../src/components/token-created-success";
import ThemeToggle from "../src/components/theme-toggle";
import Wallet from "../src/components/wallet";

export default function Home() {
  const [txSig, setTxSig] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 gap-8">
      <header className="z-10 w-full max-w-5xl flex justify-between font-mono text-sm">
        <h1 className="text-xl font-bold">SolMint</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Wallet />
        </div>
      </header>

      <section className="w-full max-w-2xl">
        {txSig ? (
          <TokenCreatedSuccess
            signature={txSig}
            onCreateAnother={() => setTxSig(null)}
          />
        ) : (
          <MintForm onSuccess={setTxSig} />
        )}
      </section>
    </main>
  );
} 