import { Connection, Transaction } from "@solana/web3.js/lib";
import { Keypair } from "@solana/web3.js";
import { getProgramSecret, awsSecretsEnabled } from "../awsSecrets";
import fs from 'fs';
import path from 'path';
import { sendAndConfirmRawTransaction, } from '@solana/web3.js';
import { APP_CONFIG } from "../../config/appConfig";

export async function broadcastSignedTx(
    programId: string,
    encodedTx: string,
  ): Promise<string> {
    
    // Decode the serialized transaction
    const rawBuffer = Buffer.from(encodedTx, 'base64');
    const tx = Transaction.from(rawBuffer);
    
    // Retrieve the secret key from Secrets Manager and sign
    let signer: Keypair;
    try {
      const secretKey = await getProgramSecret(programId);
      signer = Keypair.fromSecretKey(secretKey);
    } catch (e: any) {
      console.log(`[BROADCAST] AWS retrieval failed, falling back to local file`);
      // Fallback when AWS disabled or creds invalid
      if (awsSecretsEnabled() && e.message !== 'AWS credentials invalid') {
        throw e;
      }
      // Fallback: read the cached keypair JSON written during build
      const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${programId}.json`);
      if (!fs.existsSync(walletPath)) {
        console.error(`[BROADCAST] Program keypair file not found at ${walletPath}`);
        throw new Error(`Program keypair not found at ${walletPath}`);
      }
      try {
        const secretArr = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
        signer = Keypair.fromSecretKey(Uint8Array.from(secretArr));
      } catch (err: any) {
        console.error(`[BROADCAST] Failed to parse program keypair from file`);
        throw new Error(`Failed to parse program keypair: ${err.message}`);
      }
    }
    
    // Sign the transaction with the program keypair
    try {
      tx.partialSign(signer);
    } catch (err: any) {
      console.error(`[BROADCAST] Failed to sign transaction with program key`);
      throw new Error(`Failed to sign transaction with program key: ${err.message}`);
    }
    
    // Broadcast the fully signed transaction
    try {
      /* -----------------------------------------------------------
       * Robust connection helper: fall back to a sane default
       * and fail early if the URL is malformed.
       * ---------------------------------------------------------- */
      const endpoint =
        process.env.RPC_ENDPOINT_DEVNET ||
        "https://api.devnet.solana.com";          // safe default
  
      if (!/^https?:\/\//.test(endpoint)) {
        throw new Error(
          `Invalid RPC endpoint: ${endpoint}. ` +
            "Set RPC_ENDPOINT_DEVNET to a full https:// URL."
        );
      }
      
      const conn = new Connection(endpoint, "confirmed");
      //console.log(`[BROADCAST] Sending transaction to Solana devnet...`);
      const signature = await sendAndConfirmRawTransaction(conn, tx.serialize());
      //console.log(`[BROADCAST] Transaction confirmed with signature: ${signature}`);
      return signature;
    } catch (err: any) {
      console.error(`[BROADCAST] Failed to broadcast transaction: ${err.message}`);
      throw new Error(`Failed to broadcast transaction: ${err.message}`);
    }
  }