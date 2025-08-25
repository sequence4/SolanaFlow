import { NextFunction, Request, Response } from 'express';
import { Connection, Transaction } from '@solana/web3.js';
import { AppError } from 'src/middleware/errorHandler';
import { Keypair } from '@solana/web3.js';

const ephemeralKeys = new Map<string, Keypair>();

export const relayTx = async (req: Request, res: Response, next: NextFunction) => {
  const { encodedTx, programId } = req.body;
  
  if (!encodedTx || !programId) {
    return next(new AppError('Missing encodedTx or programId', 400));
  }
  
  try {
    
    const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(endpoint, 'confirmed');
    
    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
    
    if (!transaction.feePayer) {
      console.error('[RELAY_TX] ERROR: No fee payer set');
      return next(new AppError('Transaction must have a fee payer', 400));
    }
        
    if (ephemeralKeys.has(transaction.feePayer.toBase58())) {
      const balance = await connection.getBalance(transaction.feePayer, 'confirmed');
      const MIN_BALANCE = 15000; // Minimum for one transaction
      
      if (balance < MIN_BALANCE) {
        console.error(`[RELAY_TX] Ephemeral fee payer has insufficient balance: ${balance} lamports`);
        console.error(`[RELAY_TX] This indicates initial funding was too low`);
        return next(new AppError(
          `Ephemeral key has insufficient balance (${balance} lamports). ` +
          `Initial funding calculation was too low. Please restart deployment.`,
          400
        ));
      }
      
    }
    
    const msg = transaction.compileMessage();
    const requiredSigners = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
    
    const existingSigs = transaction.signatures.filter(s => s.signature).length;
    
    const signers: Keypair[] = [];
    for (const [pubkeyStr, keypair] of ephemeralKeys) {
      if (requiredSigners.some(k => k.equals(keypair.publicKey))) {
        const sigIndex = msg.accountKeys.findIndex(k => k.equals(keypair.publicKey));
        if (sigIndex >= 0 && sigIndex < transaction.signatures.length) {
          if (!transaction.signatures[sigIndex].signature) {
            signers.push(keypair);
          } else {
            console.log(`[RELAY_TX] Ephemeral key ${pubkeyStr} already signed`);
          }
        }
      }
    }
    
    if (signers.length === 0 && existingSigs < msg.header.numRequiredSignatures) {
      console.error(`[RELAY_TX] ERROR: No ephemeral keys found to complete signing`);
      console.error(`[RELAY_TX] Required signers: ${requiredSigners.map(k => k.toBase58()).join(', ')}`);
      console.error(`[RELAY_TX] Available ephemeral keys: ${Array.from(ephemeralKeys.keys()).join(', ')}`);
      return next(new AppError('No ephemeral key found to sign this transaction', 400));
    }
    
    // Sign with ephemeral keys
    for (const signer of signers) {
      transaction.partialSign(signer);
  //    console.log(`[RELAY_TX] Signed with ephemeral key: ${signer.publicKey.toBase58()}`);
    }
    
    // Verify all required signatures are present
    const finalSigs = transaction.signatures.filter(s => s.signature).length;
 //   console.log(`[RELAY_TX] Final signatures: ${finalSigs}/${msg.header.numRequiredSignatures}`);
    
    if (finalSigs < msg.header.numRequiredSignatures) {
      const missing = [];
      for (let i = 0; i < msg.header.numRequiredSignatures; i++) {
        if (!transaction.signatures[i]?.signature) {
          missing.push(msg.accountKeys[i].toBase58());
        }
      }
      console.error(`[RELAY_TX] Still missing signatures from: ${missing.join(', ')}`);
      return next(new AppError(`Missing signatures from: ${missing.join(', ')}`, 400));
    }
    
    // Send the fully signed transaction
 //   console.log(`[RELAY_TX] Sending fully signed transaction...`);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
 //   console.log(`[RELAY_TX] Transaction sent successfully: ${signature}`);
    
    // Wait for confirmation
    try {
      await connection.confirmTransaction(signature, 'confirmed');
 //     console.log(`[RELAY_TX] Transaction confirmed: ${signature}`);
    } catch (confirmError) {
      console.warn(`[RELAY_TX] Confirmation timeout (continuing): ${confirmError}`);
    }
    
    res.status(200).json({ signature });
  } catch (error: any) {
    console.error('[RELAY_TX] Error:', error.message);
    if (error.logs) {
      console.error('[RELAY_TX] Transaction logs:', error.logs);
    }
    
    if (error.message?.includes('Attempt to debit')) {
      next(new AppError('Fee payer has insufficient SOL balance', 400));
    } else if (error.message?.includes('Transaction simulation failed')) {
      next(new AppError(`Transaction simulation failed: ${error.message}`, 400));
    } else {
      next(new AppError(`Failed to relay transaction: ${error.message}`, 500));
    }
  }
};