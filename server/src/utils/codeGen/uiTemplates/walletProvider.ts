"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletConnectionProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Use Devnet cluster for development
  const network = WalletAdapterNetwork.Devnet;

  // RPC endpoint for Devnet
  const endpoint = "https://api.devnet.solana.com";

  // Initialize supported wallets (currently only Phantom)
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export { WalletConnectionProvider }; 