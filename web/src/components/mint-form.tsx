"use client";

import React, { useState } from "react";

interface MintFormProps {
  onSuccess: (signature: string) => void;
}

export default function MintForm({ onSuccess }: MintFormProps) {
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Simulate a successful mint transaction
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSuccess("SimulatedTransactionSignature123");
    } catch (error) {
      console.error("Mint failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 w-full"
    >
      <h2 className="text-2xl font-bold mb-4">Mint New Token</h2>
      
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Destination Address</span>
        <input 
          value={dest} 
          onChange={e => setDest(e.target.value)} 
          placeholder="Destination wallet address"
          className="border rounded p-2 text-sm" 
          required
        />
      </label>
      
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Amount</span>
        <input 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          placeholder="Token amount"
          type="number"
          className="border rounded p-2 text-sm" 
          required
        />
      </label>
      
      <button 
        type="submit"
        disabled={isLoading}
        className={`mt-4 rounded bg-black text-white py-2 ${isLoading ? 'opacity-70' : 'hover:bg-gray-800'}`}
      >
        {isLoading ? 'Minting...' : 'Mint Token'}
      </button>
    </form>
  );
} 