"use client";
import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { 
  BaseMessageSignerWalletAdapter, 
  WalletName, 
  WalletReadyState,
  scopePollingDetectionStrategy,
  WalletNotConnectedError
} from '@solana/wallet-adapter-base';

// Import the CSS for the wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletConnectionProviderProps {
  children: ReactNode;
}

// Create a proper wallet name
const IframeWalletName = 'Iframe' as WalletName<'Iframe'>;

class IframeWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = IframeWalletName;
  url = 'https://phantom.app';
  icon = 'https://www.phantom.app/img/logo.png';
  supportedTransactionVersions = null;

  private _connecting: boolean = false;
  private _connected: boolean = false;
  private _publicKey: PublicKey | null = null;
  // Callbacks for signTransaction responses
  _onSignTransactionResolve?: (tx: Transaction | VersionedTransaction) => void;
  _onSignTransactionReject?: (error: any) => void;

  constructor() {
    super();
    if (typeof window !== 'undefined') {
      // Listen for wallet state updates from parent
      window.addEventListener('message', this._handleMessage);
      // Request initial wallet state
      setTimeout(() => {
        window.parent.postMessage({ type: "wallet_state_request" }, "*");
      }, 500);
    }
  }

  private _handleMessage = (event: MessageEvent) => {
    if (event.data.type === "wallet_state_response") {
      const wasConnected = this._connected;
      this._connected = !!event.data.connected;
      
      if (event.data.publicKey) {
        this._publicKey = new PublicKey(event.data.publicKey);
      } else {
        this._publicKey = null;
      }
      
      // Emit connect/disconnect events if state changed
      if (!wasConnected && this._connected && this._publicKey) {
        this.emit('connect', this._publicKey);
      } else if (wasConnected && !this._connected) {
        this.emit('disconnect');
      }
      
      this._connecting = false;
    }
    
    if (event.data.type === "sign_transaction_response") {
      if (event.data.error) {
        this._onSignTransactionReject?.(new Error(event.data.error));
      } else if (event.data.signedTransaction) {
        try {
          const signedTx = Transaction.from(Uint8Array.from(event.data.signedTransaction));
          this._onSignTransactionResolve?.(signedTx);
        } catch (err) {
          this._onSignTransactionReject?.(err);
        }
      }
      // Clear callbacks
      this._onSignTransactionResolve = undefined;
      this._onSignTransactionReject = undefined;
    }
  };

  get publicKey() {
    return this._publicKey;
  }
  
  get connected() {
    return this._connected;
  }
  
  get connecting() {
    return this._connecting;
  }
  
  get readyState() {
    return WalletReadyState.Installed;
  }
  
  async connect(): Promise<void> {
    if (this._connecting || this._connected) return;
    this._connecting = true;
    
    return new Promise((resolve, reject) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data.type === "wallet_state_response") {
          window.removeEventListener("message", handleResponse);
          if (event.data.connected) {
            this._publicKey = new PublicKey(event.data.publicKey);
            this._connected = true;
            this.emit("connect", this._publicKey);
            resolve();
          } else {
            reject(new Error("Wallet not connected"));
          }
          this._connecting = false;
        }
      };
      
      window.addEventListener("message", handleResponse);
      // Request parent to connect wallet
      window.parent.postMessage({ type: "wallet_connect_request" }, "*");
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener("message", handleResponse);
        if (!this._connected) {
          this._connecting = false;
          reject(new Error("Connection request timed out"));
        }
      }, 30000);
    });
  }
  
  async disconnect(): Promise<void> {
    if (this._connected) {
      try {
        window.parent.postMessage({ type: "wallet_disconnect_request" }, "*");
      } catch (err) {
        console.warn("Error sending disconnect to parent", err);
      }
    }
    this._publicKey = null;
    this._connected = false;
    this.emit("disconnect");
    return;
  }
  
  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._connected) throw new WalletNotConnectedError();
    
    return new Promise((resolve, reject) => {
      // Store callbacks
      this._onSignTransactionResolve = resolve as any;
      this._onSignTransactionReject = reject;
      
      try {
        const serialized = (transaction as Transaction).serialize({ requireAllSignatures: false });
        window.parent.postMessage({ 
          type: "sign_transaction", 
          transaction: Array.from(serialized) 
        }, "*");
        
        // Timeout after 60 seconds
        setTimeout(() => {
          if (this._onSignTransactionReject) {
            this._onSignTransactionReject(new Error("Transaction signing timed out"));
            this._onSignTransactionResolve = undefined;
            this._onSignTransactionReject = undefined;
          }
        }, 60000);
      } catch (err) {
        this._onSignTransactionReject?.(err);
        // Clear callbacks
        this._onSignTransactionResolve = undefined;
        this._onSignTransactionReject = undefined;
        throw err;
      }
    });
  }
  
  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this._connected) throw new WalletNotConnectedError();
    
    // Sign transactions one by one
    const signedTransactions: T[] = [];
    for (const transaction of transactions) {
      signedTransactions.push(await this.signTransaction(transaction));
    }
    return signedTransactions;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    throw new Error("signMessage not implemented");
  }
}

const WalletConnectionProvider: FC<WalletConnectionProviderProps> = ({ children }) => {
  // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet;
  
  // You can also provide a custom RPC endpoint
  const endpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(network);
  
  // Determine if we're running in an iframe
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  // Create appropriate wallet adapters based on context
  const wallets = useMemo(() => {
    if (isIframe) {
      // In iframe, use the IframeWalletAdapter as a bridge to parent wallet
      return [new IframeWalletAdapter()];
    }
    // In normal context, use direct wallet adapters
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network })
    ];
  }, [network, isIframe]);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletConnectionProvider; 