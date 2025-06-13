export const HOME_PAGE_TSX = `"use client";

import { useState } from "react";
import MintForm from "../src/components/mint-form";
import TokenCreatedSuccess from "../src/components/token-created-success";
import ThemeToggle from "../src/components/theme-toggle";
import Wallet from "../src/components/wallet";

export default function Home() {
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleMintSuccess = (signature: string) => {
    setTxSignature(signature);
  };

  const handleCreateAnother = () => {
    setTxSignature(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 gap-8">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-xl font-bold">SolMint</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Wallet />
        </div>
      </div>

      <div className="w-full max-w-2xl">
        {txSignature ? (
          <TokenCreatedSuccess 
            signature={txSignature}
            onCreateAnother={handleCreateAnother} 
          />
        ) : (
          <MintForm onSuccess={handleMintSuccess} />
        )}
      </div>
    </main>
  );
}`;
