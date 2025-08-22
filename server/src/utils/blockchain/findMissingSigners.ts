import { Transaction, PublicKey } from "@solana/web3.js";

export function findMissingSigners(tx: Transaction): PublicKey[] {
    const msg = tx.compileMessage();
    const required = msg.header.numRequiredSignatures;
    const missing: PublicKey[] = [];
    for (let i = 0; i < required; i++) {
      const sigPresent = Boolean(tx.signatures[i]?.signature);
      if (!sigPresent) {
        missing.push(msg.accountKeys[i]);
      }
    }
    return missing;
  }