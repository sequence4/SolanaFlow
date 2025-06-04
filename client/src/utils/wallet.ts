import { Connection, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * React hook for wallet transaction signing and utilities
 */
export function useWalletSigner() {
  const wallet = useWallet();
  
  /**
   * A simple helper to send a transaction using the connected wallet
   */
  const sendTransaction = async (transaction: Transaction, connection: Connection): Promise<string> => {
    if (!wallet.signTransaction || !wallet.publicKey) {
      throw new Error("Wallet not connected or doesn't support signing");
    }
    
    // Set the fee payer to the wallet's public key
    transaction.feePayer = wallet.publicKey;
    
    // Get recent blockhash if not already set
    if (!transaction.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
    }
    
    try {
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          /** MUST match the commitment used for getLatestBlockhash */
          preflightCommitment: 'confirmed',
        }
      );
      
      // Return the transaction signature
      return signature;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error("Failed to sign or send transaction: " + errorMessage);
    }
  };
  
  return {
    sendTransaction,
    isConnected: !!wallet.connected,
    publicKey: wallet.publicKey
  };
} 