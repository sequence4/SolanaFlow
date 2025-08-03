import { Connection, Transaction, Keypair, PublicKey, SystemProgram, NONCE_ACCOUNT_LENGTH } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * React hook for wallet transaction signing and utilities
 */
/**
 * Creates a new durable nonce account for the given wallet
 * 
 * @param connection Solana connection
 * @param walletPublicKey Public key of the wallet that will be the nonce authority
 * @param signTransaction Function to sign transactions with the wallet
 * @returns Object containing the nonce public key and transaction signature
 */
export async function createNonceAccount(
  connection: Connection,
  walletPublicKey: PublicKey,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<{ noncePubkey: PublicKey; signature: string }> {
  // Generate a new keypair for the nonce account
  const nonceKeypair = Keypair.generate();
  const noncePubkey = nonceKeypair.publicKey;
  
  // Calculate minimum rent exemption for the nonce account
  const lamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  
  // Create the nonce account transaction
  const tx = SystemProgram.createNonceAccount({
    fromPubkey: walletPublicKey,
    noncePubkey,
    authorizedPubkey: walletPublicKey,
    lamports,
  });
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPublicKey;
  
  // Sign the transaction with both the wallet and the nonce keypair
  const partialSigned = await signTransaction(tx);
  partialSigned.partialSign(nonceKeypair);
  
  // Send the transaction
  const signature = await connection.sendRawTransaction(partialSigned.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  return { noncePubkey, signature };
}

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
      const { blockhash } = await connection.getLatestBlockhash({ commitment: 'confirmed' });
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
  
  /**
   * Create a new durable nonce account for this wallet
   */
  const createNonce = async (connection: Connection): Promise<{ noncePubkey: PublicKey; signature: string }> => {
    if (!wallet.signTransaction || !wallet.publicKey) {
      throw new Error("Wallet not connected or doesn't support signing");
    }
    
    return createNonceAccount(connection, wallet.publicKey, wallet.signTransaction);
  };
  
  return {
    sendTransaction,
    createNonce,
    isConnected: !!wallet.connected,
    publicKey: wallet.publicKey
  };
} 