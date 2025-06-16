"use client";

import React from "react";

interface TokenCreatedSuccessProps {
  signature: string;
  onCreateAnother: () => void;
}

export default function TokenCreatedSuccess({ 
  signature, 
  onCreateAnother 
}: TokenCreatedSuccessProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="rounded-full bg-green-100 p-3">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-10 w-10 text-green-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold">Token Created Successfully!</h2>
      
      <p className="text-gray-600 max-w-md">
        Your token has been minted and sent to the destination address.
      </p>
      
      <div className="bg-gray-100 p-4 rounded-md w-full overflow-hidden">
        <p className="text-sm font-medium mb-1">Transaction Signature:</p>
        <p className="text-xs text-gray-600 break-all">{signature}</p>
      </div>
      
      <div className="flex gap-4 mt-4">
        <a 
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View on Explorer
        </a>
        
        <button
          onClick={onCreateAnother}
          className="text-blue-600 hover:underline"
        >
          Create Another Token
        </button>
      </div>
    </div>
  );
} 