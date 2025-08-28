import { NextFunction, Request, Response } from 'express';
import { Connection, Transaction } from '@solana/web3.js';
import { AppError } from 'src/middleware/errorHandler';
import { getProjectEphemeralKey } from '../../utils/ephemeralKeyStore';

export const relayTx = async (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
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
    
    const msg = transaction.compileMessage();
    const requiredSigners = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
    
    // Get the ephemeral key for this project
    const ephemeralKey = getProjectEphemeralKey(projectId);
    
    if (!ephemeralKey) {
      console.error(`[RELAY_TX] No ephemeral key found for project ${projectId}`);
      return next(new AppError('No ephemeral key found for this project', 400));
    }
    
    // Check if ephemeral key is a required signer
    const ephemeralIsRequired = requiredSigners.some(k => k.equals(ephemeralKey.publicKey));
    
    if (!ephemeralIsRequired) {
      console.error(`[RELAY_TX] Ephemeral key ${ephemeralKey.publicKey.toBase58()} is not a required signer`);
      console.error(`[RELAY_TX] Required signers: ${requiredSigners.map(k => k.toBase58()).join(', ')}`);
      return next(new AppError('Ephemeral key is not a required signer for this transaction', 400));
    }
    
    // Check if ephemeral key has enough balance if it's the fee payer
    if (transaction.feePayer.equals(ephemeralKey.publicKey)) {
      const balance = await connection.getBalance(ephemeralKey.publicKey, 'confirmed');
      const MIN_BALANCE = 15000; // Minimum for one transaction
      
      if (balance < MIN_BALANCE) {
        console.error(`[RELAY_TX] Ephemeral fee payer has insufficient balance: ${balance} lamports`);
        return next(new AppError(
          `Ephemeral key has insufficient balance (${balance} lamports). ` +
          `Please fund the ephemeral key before proceeding.`,
          400
        ));
      }
    }
    
    // Check if ephemeral key already signed
    const ephemeralSigIndex = msg.accountKeys.findIndex(k => k.equals(ephemeralKey.publicKey));
    const alreadySigned = ephemeralSigIndex >= 0 && 
                         ephemeralSigIndex < transaction.signatures.length &&
                         transaction.signatures[ephemeralSigIndex].signature !== null;
    
    if (!alreadySigned) {
      // Sign with ephemeral key
      transaction.partialSign(ephemeralKey);
      console.log(`[RELAY_TX] Signed with ephemeral key: ${ephemeralKey.publicKey.toBase58()}`);
    } else {
      console.log(`[RELAY_TX] Ephemeral key ${ephemeralKey.publicKey.toBase58()} already signed`);
    }
    
    // Verify all required signatures are present
    const finalSigs = transaction.signatures.filter(s => s.signature).length;
    console.log(`[RELAY_TX] Final signatures: ${finalSigs}/${msg.header.numRequiredSignatures}`);
    
    if (finalSigs < msg.header.numRequiredSignatures) {
      const missing = [];
      for (let i = 0; i < msg.header.numRequiredSignatures; i++) {
        if (!transaction.signatures[i]?.signature) {
          missing.push(msg.accountKeys[i].toBase58());
        }
      }
      console.error(`[RELAY_TX] Still missing signatures from: ${missing.join(', ')}`);
      
      // If only wallet signature is missing, return 409 for wallet to sign
      if (missing.length === 1 && missing[0] !== ephemeralKey.publicKey.toBase58()) {
        return res.status(409).json({
          code: 'WALLET_SIGNATURE_REQUIRED',
          txBase64: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          missing: missing
        });
      }
      
      return next(new AppError(`Missing signatures from: ${missing.join(', ')}`, 400));
    }
    
    // Send the fully signed transaction
    console.log(`[RELAY_TX] Sending fully signed transaction...`);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
    console.log(`[RELAY_TX] Transaction sent successfully: ${signature}`);
    
    // Wait for confirmation
    try {
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`[RELAY_TX] Transaction confirmed: ${signature}`);
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