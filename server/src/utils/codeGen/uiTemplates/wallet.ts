export const WALLET_TSX = `"use client";

import { Button } from "./ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function Wallet() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Format public key for display
  const displayAddress = publicKey 
    ? publicKey.toString().slice(0, 4) + ".." + publicKey.toString().slice(-4) 
    : "";

  const handleConnect = () => {
    setVisible(true);
  };

  return (
    <Button
      variant={connected ? "outline" : "default"}
      onClick={connected ? disconnect : handleConnect}
    >
      {connected ? \`\${displayAddress} ✓\` : "Connect Wallet"}
    </Button>
  );
}`;
