import { AppError } from "src/middleware/errorHandler";
import { NextFunction, Request, Response } from 'express';
import { Connection, Keypair } from '@solana/web3.js';
import { runCommand } from 'src/utils/command-execution/runCommand';
import pool from 'src/config/database';
import { Transaction } from '@solana/web3.js';
import { signDeployTxAndBroadcast } from 'src/utils/blockchain/signDeployTxAndBroadcast';
import { v4 as uuidv4 } from 'uuid';

const ephemeralKeys = new Map<string, Keypair>();

export const relaySignedTx = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { encodedTx, programId, serverSignFor = [], signerHint } = req.body;
  
  if (!encodedTx || !programId) {
    return next(new AppError('Missing encodedTx or programId', 400));
  }
  
  try {
    // Collect extra server-side signers (ephemeral etc.)
    const extraSigners: Keypair[] = [];

    // From explicit list
    if (Array.isArray(serverSignFor)) {
      for (const pk of serverSignFor) {
        const kp = (ephemeralKeys as Map<string, Keypair>).get(pk);
        if (kp) {
          extraSigners.push(kp);
        } else {
        }
      }
    }
    // From signer hint
    if (signerHint?.type === 'ephemeral' && signerHint?.pubkey) {
      const kp = (ephemeralKeys as Map<string, Keypair>).get(signerHint.pubkey);
      if (kp) {
        extraSigners.push(kp);
      } else {
      }
    }

    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
    const msg = transaction.compileMessage();
    const requiredSigs = msg.header.numRequiredSignatures;
    const currentSigs = transaction.signatures.filter(s => s.signature).length;
    
    
   // console.log(`[RELAY_SIGNED_TX] Checking if this is a deployment transaction...`);
    // Check if this is a BPF upgrade loader transaction - look for Write (1), Deploy (2), or Upgrade (3) instructions
    // The deployment transaction may have multiple instructions (nonce advance, create account, write, deploy)
    let isBPFLoaderTransaction = false;
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      if (instruction && instruction.data.length >= 4) {
        const instructionType = Array.from(instruction.data.slice(0, 4));
      //  console.log(`[RELAY_SIGNED_TX] Instruction ${i} data prefix: [${instructionType.join(',')}]`);
        
        // Check for Write (1) OR Deploy (2) OR Upgrade (3) instructions
        if ((instructionType[0] === 1 || instructionType[0] === 2 || instructionType[0] === 3) 
            && instructionType[1] === 0 && instructionType[2] === 0 && instructionType[3] === 0) {
       //   console.log(`[RELAY_SIGNED_TX] Found BPF loader instruction (type ${instructionType[0]}) at index ${i}`);
          isBPFLoaderTransaction = true;
          
          // For Write instructions, sign with ephemeral key
          if (instructionType[0] === 1) {
        //    console.log(`[RELAY_SIGNED_TX] This is a Write instruction - needs ephemeral signing`);
          }
        }
      }
    }
    
    if (isBPFLoaderTransaction) {
   //   console.log(`[RELAY_SIGNED_TX] This is a BPF loader transaction`);
    } else {
      console.log(`[RELAY_SIGNED_TX] This is not a BPF loader transaction`);
    }
    
    let txSignature: string;
    
    // Force server signing for BPF loader transactions even if they appear "fully signed"
    // because Write transactions need ephemeral key signatures
    if (currentSigs === requiredSigs && !isBPFLoaderTransaction) {
      // Transaction is fully signed and not a BPF loader transaction, broadcast directly
  //    console.log(`[RELAY_SIGNED_TX] Transaction is fully signed, broadcasting directly`);
      const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(endpoint, 'confirmed');
      
      txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: true }
      );
      
   //   console.log(`[RELAY_SIGNED_TX] Direct broadcast successful: ${txSignature}`);
    } else {
      // Transaction needs additional server signing (or is a BPF loader transaction)
      if (isBPFLoaderTransaction) {
 //       console.log(`[RELAY_SIGNED_TX] BPF loader transaction detected, forcing server signature processing`);
      } else {
        console.log(`[RELAY_SIGNED_TX] Transaction needs server signatures, processing...`);
      }
      
      const out = await signDeployTxAndBroadcast(id, encodedTx, programId, { extraSigners });
      if (out?.txForWallet) {
        return res.status(409).json({
          code: 'WALLET_SIGNATURE_REQUIRED',
          missing: out.missing ?? [],
          txBase64: out.txForWallet,
          txForWallet: out.txForWallet,
        });
      }
      txSignature = out.signature as string;
    }
    
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE solanaproject
           SET details     = COALESCE(details::jsonb, '{}'::jsonb) || $1::jsonb,
               last_updated = $2
         WHERE id = $3`,
        [JSON.stringify({ programId }), new Date(), id],
      );
    } finally {
      client.release();
    }
    
  //  console.log(`[RELAY_SIGNED_TX] Program ${programId} deployed successfully for project ${id}`);
    
    // Restart container so Next.js picks up the new Program ID
    const { rows: [proj] } = await pool.query(
      'SELECT container_name FROM solanaproject WHERE id = $1',
      [id]
    );
    if (proj && proj.container_name) {
      try {
        await runCommand(`docker restart ${proj.container_name}`, '.', uuidv4());
      } catch (err) {
        console.error(`[RELAY_SIGNED_TX] Failed to restart container ${proj.container_name}:`, err);
      }
    }
    
    res.status(200).json({ signature: txSignature, programId });
    return;
  } catch (error: any) {
    console.error('[RELAY_SIGNED_TX] Failed to broadcast signed transaction:', error);
    next(new AppError('Failed to relay signed transaction', 500));
    return;
  }
};