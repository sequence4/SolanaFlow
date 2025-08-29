import {
  Connection,
  Transaction,
  PublicKey,
  Keypair,
  SystemProgram,
  NONCE_ACCOUNT_LENGTH
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * React hook for wallet transaction signing and utilities
 */
/**
 * Create a **durable‑nonce** account owned (and paid) by the connected wallet.
 * Returns the new nonce‑account public key once the tx is confirmed.
 */
export async function createNonceAccount(
  connection: Connection,
  walletPubkey: PublicKey,
  sendTx: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<PublicKey> {
  const nonceKey = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(
    NONCE_ACCOUNT_LENGTH
  );

  const tx = SystemProgram.createNonceAccount({
    fromPubkey: walletPubkey,
    noncePubkey: nonceKey.publicKey,
    authorizedPubkey: walletPubkey,
    lamports,
  });

  /* ── REQUIRED before partialSign ───────────────────────────────
   * Creating the nonce account is still a *regular* transaction, so
   * it needs a fresh recentBlockhash and explicit fee‑payer before
   * we call partialSign — otherwise web3.js throws
   * "Transaction recentBlockhash required". See SO answers & docs. */
  tx.recentBlockhash = (
    await connection.getLatestBlockhash({ commitment: "confirmed" })
  ).blockhash;                    /* stackoverflow.com/q/71021177 */
  tx.feePayer = walletPubkey;     /* Solana core tx format docs */

  tx.partialSign(nonceKey);              // sign with new account
  /* send and **wait for confirmation** so the backend can see the
   * new durable-nonce account before it queries → avoids 404 */
  /* ─────── diagnostics ─────────────────────────────────────────── */
  const sig = await sendTx(tx, connection);        // wallet pays rent + fee
  console.log("[NONCE] createNonceAccount – tx signature:", sig);

  try {
    const confirmation = await connection.confirmTransaction(
      sig,
      "confirmed",
    );
    console.log(
      "[NONCE] confirmTransaction result:",
      JSON.stringify(confirmation),
    );
  } catch (confirmErr) {
    console.error(
      "[NONCE] confirmTransaction threw:",
      confirmErr instanceof Error ? confirmErr.message : confirmErr,
    );
    throw confirmErr;        // surface to caller
  }

  return nonceKey.publicKey;
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
   * Values exposed to consumers
   */
  const createNonce = async (connection: Connection): Promise<PublicKey> => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    return await createNonceAccount(connection, wallet.publicKey, sendTransaction);
  };

  return {
    sendTransaction,
    createNonce,
    isConnected: !!wallet.connected,
    publicKey: wallet.publicKey
  };
} 