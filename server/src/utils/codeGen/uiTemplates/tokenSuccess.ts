export const TOKEN_CREATED_SUCCESS_TSX = `"use client";

import { Button } from "./ui/button";

interface TokenCreatedSuccessProps {
  signature: string;
  onCreateAnother: () => void;
}

export default function TokenCreatedSuccess({
  signature,
  onCreateAnother,
}: TokenCreatedSuccessProps) {
  // Shorten signature for display
  const shortSignature = 
    signature.substring(0, 8) + '...' + signature.substring(signature.length - 8);
  
  // Create Solana Explorer link
  const explorerUrl = \`https://explorer.solana.com/tx/\${signature}?cluster=devnet\`;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-6">
      <div className="flex flex-col space-y-1.5">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">
          Token Created Successfully!
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Your SPL token has been created on Devnet.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Transaction Signature:</p>
          <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
            {shortSignature}
          </code>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button
            className="flex-1"
            onClick={() => window.open(explorerUrl, '_blank')}
          >
            View on Explorer
          </Button>
          
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCreateAnother}
          >
            Create Another Token
          </Button>
        </div>
      </div>
    </div>
  );
}`;
