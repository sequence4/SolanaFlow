// server/src/utils/codeGen/uiTemplates/walletProvider.ts
export const WALLET_CONNECTION_PROVIDER_TSX = `"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

interface Props { children: ReactNode }

const WalletConnectionProvider: FC<Props> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_SOL_RPC_URL ?? clusterApiUrl("devnet");
  const wallets  = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletConnectionProvider;`;
