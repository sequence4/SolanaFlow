export const MINT_FORM_TSX = `"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useWallet } from "@solana/wallet-adapter-react";

interface MintFormProps {
  onSuccess: (signature: string) => void;
}

export default function MintForm({ onSuccess }: MintFormProps) {
  const { connected, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tokenName: "",
    tokenSymbol: "",
    decimals: "9",
    mintAuthority: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      alert("Please connect your wallet first");
      return;
    }
    
    setLoading(true);
    
    try {
      // In a real implementation, this would call the backend API or
      // use the IDL to create a transaction that calls the on-chain program
      console.log("Creating token with:", formData);
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate a successful transaction
      const mockSignature = "5FG9UDfZ69UEUzpzMgZy2XMtEAFRrv41U7cTwGsGYHFED7YPbXHdwfDDSj2kotdV3NQPYzXsjD7mRBRuhFaorw6B";
      onSuccess(mockSignature);
    } catch (error) {
      console.error("Error creating token:", error);
      alert("Failed to create token. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex flex-col space-y-1.5 pb-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Create a Token</h3>
        <p className="text-sm text-muted-foreground">
          Fill out this form to mint a new SPL token on Solana
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tokenName">Token Name</Label>
          <Input
            id="tokenName"
            name="tokenName"
            placeholder="My Token"
            required
            value={formData.tokenName}
            onChange={handleInputChange}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tokenSymbol">Token Symbol</Label>
          <Input
            id="tokenSymbol"
            name="tokenSymbol"
            placeholder="MTK"
            required
            maxLength={10}
            value={formData.tokenSymbol}
            onChange={handleInputChange}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="decimals">Decimals</Label>
          <Input
            id="decimals"
            name="decimals"
            type="number"
            min="0"
            max="9"
            placeholder="9"
            value={formData.decimals}
            onChange={handleInputChange}
          />
          <p className="text-xs text-muted-foreground">
            Number of decimal places (0-9, default is 9)
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="mintAuthority">Mint Authority (optional)</Label>
          <Input
            id="mintAuthority"
            name="mintAuthority"
            placeholder="Leave blank to use connected wallet"
            value={formData.mintAuthority}
            onChange={handleInputChange}
          />
          <p className="text-xs text-muted-foreground">
            Public key with permission to mint new tokens
          </p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full mt-6" 
          disabled={!connected || loading}
        >
          {loading ? "Creating..." : "Create Token"}
        </Button>
      </form>
    </div>
  );
}`;
