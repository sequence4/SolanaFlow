"use client";
import React, { FC, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { PublicKey, Transaction } from '@solana/web3.js';
import { phantomConnect, phantomDisconnect, signTransaction as phantomSignTransaction } from 'phantom-iframe-connector';

// Import the CSS for the wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletConnectionProviderProps {
  children: ReactNode;
}

const WalletConnectionProvider: FC<WalletConnectionProviderProps> = ({ children }) => {
  // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;
  
  // You can also provide a custom RPC endpoint
  const endpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(network);
  
  // If running inside an iframe, inject Phantom provider to enable wallet connection via parent
  if (typeof window !== 'undefined' && window.parent !== window) {
    try {
      const parentOrigin = new URL(document.referrer).origin;
      const phantomProvider: any = {
        isPhantom: true,
        publicKey: null,
        connect: async () => {
          const { data: pubKey } = await phantomConnect(parentOrigin);
          const pk = new PublicKey(pubKey);
          phantomProvider.publicKey = pk;
          return { publicKey: pk };
        },
        disconnect: async () => {
          await phantomDisconnect(parentOrigin);
          phantomProvider.publicKey = null;
        },
        signTransaction: async (tx: Transaction) => {
          const signedTx = await phantomSignTransaction(tx, parentOrigin);
          return signedTx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          const signedTxs: Transaction[] = [];
          for (const tx of txs) {
            signedTxs.push(await phantomSignTransaction(tx, parentOrigin));
          }
          return signedTxs;
        },
        on: () => {} // no-op for event listeners
      };
      (window as any).phantom = { solana: phantomProvider };
      (window as any).solana = phantomProvider;
      console.log('[WalletConnectionProvider] Phantom provider injected for iframe');
    } catch (error) {
      console.error('Failed to inject Phantom provider:', error);
    }
  }
  
  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading
  // Only the wallets you configure here will be compiled into your application
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network })
  ];
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletConnectionProvider; 