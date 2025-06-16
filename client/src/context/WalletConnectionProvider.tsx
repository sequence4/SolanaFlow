"use client";

import React, { FC, ReactNode, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  WalletProvider, 
  ConnectionProvider 
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter
} from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

require('@solana/wallet-adapter-react-ui/styles.css');

interface WalletConnectionProviderProps {
  children: ReactNode;
}

const WalletConnectionProvider: FC<WalletConnectionProviderProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;

  const endpoint =
    process.env.NEXT_PUBLIC_SOL_RPC ??
    'https://tiniest-smart-putty.solana-devnet.quiknode.pro/31fdf5493679b4c1c854289d95c822094900efc2/';

  const wallets = useMemo(
    () => [new PhantomWalletAdapter({ network })],
    [network]
  );

  return (
    /* Only pass endpoint to ConnectionProvider, network is handled by the wallet adapter */
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletConnectionProvider;
