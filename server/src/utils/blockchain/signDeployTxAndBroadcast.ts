import { Keypair, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { getContainerName } from "../container/getContainerName";
import { runCommand } from "../command-execution/runCommand";
import { sendAndConfirmRawTransaction } from "@solana/web3.js";
//import { getProgramSecret, awsSecretsEnabled } from "../awsSecrets";
import { APP_CONFIG } from "../../config/appConfig";
import { getProjectRootPath } from "../fileUtils";
import path from "path";
import { findMissingSigners } from "./findMissingSigners";
import fs from "fs";

/**
 * Signs a partially-signed deploy transaction with the fixed program keypair (generated during codegen)
 * and broadcasts it to Devnet. This helper ensures the program's secret key remains on the backend,
 * never reaching the client.
 *
 * Steps:
 *   1. Locate the `*-keypair.json` file inside `/usr/src/target/deploy` of the project's container.
 *   2. Load the secret key, derive the programId, and verify it matches the expected `programId`.
 *   3. Decode the partial transaction from `encodedTx`, add the program signature via `partialSign`.
 *   4. Broadcast the fully signed transaction and return its signature.
 *
 * @param projectId  ID of the project whose container holds the compiled artifacts.
 * @param encodedTx  Base64-encoded partially-signed transaction (ephemeral signature present).
 * @param programId  Expected public key of the program; used to verify we loaded the correct keypair.
 * @returns         Transaction signature of the deployed program.
 */
export async function signDeployTxAndBroadcast(
    projectId: string,
    encodedTx: string,
    programId: string,
    opts?: { extraSigners?: Keypair[] }
  ): Promise<{ signature?: string; txForWallet?: string; missing?: string[] }> {
    // Decode incoming tx
    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
  
    // Attempt to sign with server-side program keypair if required
    let programKeypair: Keypair | null = null;
    try {
      //console.log(`[SIGNING] =================== BACKEND KEYPAIR RESOLUTION ===================`);
      //console.log(`[SIGNING] Looking for program keypair for programId: ${programId}`);
      //console.log(`[SIGNING] Project ID: ${projectId}`);
      
      // Try to locate the program keypair for this project using the correct naming convention
      const containerName = await getContainerName(projectId);
      if (containerName) {
        const rootPath = await getProjectRootPath(projectId);
        //console.log(`[SIGNING] Project rootPath: ${rootPath}`);
        
        const rootStem = rootPath.replace(/-[a-f0-9]{8}$/, '');
        //console.log(`[SIGNING] Project rootStem: ${rootStem}`);
        
        let programName = rootStem.replace(/-/g, '_');
        if (/^[0-9]/.test(programName)) programName = 'p' + programName;
        //console.log(`[SIGNING] Derived programName: ${programName}`);
        
        const tempTaskId = uuidv4();
        
        // First try the correct program keypair filename based on the program name
        const correctKeypairPath = `/usr/src/target/deploy/${programName}-keypair.json`;
        //console.log(`[SIGNING] Looking for correct program keypair: ${correctKeypairPath}`);
        
        try {
          const content = await runCommand(
            `docker exec ${containerName} bash -c "cat '${correctKeypairPath}'"`,
            '.',
            tempTaskId,
            { skipSuccessUpdate: true },
          );
          const arr = JSON.parse(content.trim());
          if (Array.isArray(arr) && arr.length === 64) {
            const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
            //console.log(`[SIGNING] Found correct program keypair with pubkey: ${kp.publicKey.toBase58()}`);
            //console.log(`[SIGNING] Expected program ID: ${programId}`);
            
            // Only use this keypair if it matches the expected program ID
            if (kp.publicKey.toBase58() === programId) {
              programKeypair = kp;
              //console.log(`[SIGNING] ✅ Using correct program keypair for deployment`);
            } else {
              console.warn(`[SIGNING] ❌ Keypair mismatch! Found ${kp.publicKey.toBase58()}, expected ${programId}`);
            }
          }
        } catch (e) {
          console.warn(`[SIGNING] Could not read correct keypair file ${correctKeypairPath}:`, (e as any)?.message);
          
          // Fallback: search all keypair files but only use exact matches
          let listCmd = `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && find target/deploy -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" -print'`;
          let out = await runCommand(listCmd, '.', tempTaskId, { skipSuccessUpdate: true });
          let candidates = out.split(/\r?\n/).filter(Boolean);
          if (!candidates.length) {
            listCmd = `docker exec ${containerName} bash -c 'find /usr/src/target/deploy -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" -print'`;
            out = await runCommand(listCmd, '.', tempTaskId, { skipSuccessUpdate: true });
            candidates = out.split(/\r?\n/).filter(Boolean);
          }
          
          for (const c of candidates) {
            try {
             // console.log(`[SIGNING] Checking fallback keypair file: ${c}`);
              const content = await runCommand(
                `docker exec ${containerName} bash -c "cat '${c}'"`,
                '.',
                tempTaskId,
                { skipSuccessUpdate: true },
              );
              const arr = JSON.parse(content.trim());
              if (Array.isArray(arr) && arr.length === 64) {
                const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
               // console.log(`[SIGNING] Found fallback keypair with pubkey: ${kp.publicKey.toBase58()}`);
                
                // ONLY use keypairs that exactly match the expected program ID
                if (kp.publicKey.toBase58() === programId) {
                  programKeypair = kp;
                 // console.log(`[SIGNING] ✅ Found matching program keypair: ${programId}`);
                  break;
                } else {
                  console.log(`[SIGNING] ❌ Skipping mismatched keypair: ${kp.publicKey.toBase58()} != ${programId}`);
                }
              }
            } catch (e) {
              console.warn(`[SIGNING] Failed to load keypair from ${c}:`, (e as any)?.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SIGNING] Failed to locate program keypair for server-side signing:', (e as any)?.message);
    }
  
    let signedCount = transaction.signatures.filter(s => s.signature).length;
    //console.log(`[SIGNING] Initial signature count: ${signedCount}`);
  
    try {
      if (programKeypair) {
        const msg = transaction.compileMessage();
        const signerCount = msg.header.numRequiredSignatures;
        const signerKeys = msg.accountKeys.slice(0, signerCount).map(k => k.toBase58());
        const programKeyStr = programKeypair.publicKey.toBase58();
        //console.log(`[SIGNING] Program keypair available: ${programKeyStr}`);
        //console.log(`[SIGNING] Required signers: ${signerKeys.join(', ')}`);
        
        if (signerKeys.includes(programKeyStr)) {
          transaction.partialSign(programKeypair);
          //console.log('[SIGNING] Program signature applied by server');
        } else {
          console.log('[SIGNING] Program key is not required for this tx');
          // Check if any of the required signers match the program keypair we loaded
          const matchesAnyRequired = signerKeys.some(sk => sk === programKeyStr);
          if (!matchesAnyRequired) {
            console.log(`[SIGNING] Available program key ${programKeyStr} doesn't match any required signer`);
          }
        }
      } else {
        console.log('[SIGNING] No program keypair available for server-side signing');
      }
    } catch (e) {
      console.warn('[SIGNING] partialSign with program keypair failed:', (e as any)?.message);
    }
  
    signedCount = transaction.signatures.filter(s => s.signature).length;
    //console.log(`[SIGNING] After program key: ${signedCount} signatures`);
  
    // Add any extra (controller-supplied) signers – e.g., ephemeral buffer authority
    try {
      const extras = opts?.extraSigners ?? [];
      if (extras.length) {
        const msg = transaction.compileMessage();
        const signerCount = msg.header.numRequiredSignatures;
        const signerKeys = msg.accountKeys.slice(0, signerCount);
        for (const kp of extras) {
          if (signerKeys.some(k => k.equals(kp.publicKey))) {
            transaction.partialSign(kp);
            //console.log(`[SIGNING] Added extra signer ${kp.publicKey.toBase58()}`);
          }
        }
      }
    } catch (e) {
      console.warn('[SIGNING] extraSigners failed:', (e as any)?.message);
    }
  
    // ------------------------------------------------------------------
    // Do we actually still need the program-id signature?
    //  • If the client already signed with `programKeypair`, we can skip
    //    any key-lookup on the server.
    //  • Otherwise we fall back to the legacy behaviour (load the secret
    //    and append the missing signature, if we can find it).
    // ------------------------------------------------------------------
    const needsProgramSig = transaction.signatures.some(
      ({ publicKey, signature }) =>
        publicKey.toBase58() === programId && !signature               // signature is null / undefined
    );
  
    /*
    if (!needsProgramSig) {
      //console.log(
        `[SIGNING] Program signature already present – skipping server-side signing`
      );
    } else if (programKeypair && programKeypair.publicKey.toBase58() === programId) {
      // Double-check the keypair matches the expected program ID before signing
      transaction.partialSign(programKeypair);
      
      console.log(
        `[SIGNING] ✅ Added program signature using correct keypair ${programId}`
      );
      
    } else if (programKeypair) {
      console.error(
        `[SIGNING] ❌ CRITICAL: Program keypair mismatch! Have ${programKeypair.publicKey.toBase58()}, need ${programId}`
      );
      throw new Error(`Program keypair mismatch: expected ${programId}, got ${programKeypair.publicKey.toBase58()}`);
    } else {
      console.warn(
        `[SIGNING] ❌ No matching server keypair found for program ${programId}; deployment will likely fail`
      );
      throw new Error(`No matching program keypair found for ${programId}. Ensure the program was built correctly.`);
    }
      */
    
    // Log compact transaction statistics
    //console.log(`[SIGNING] Transaction has ${transaction.instructions.length} instruction(s); signatures=${signedCount}`);
    
    /* Robust connection helper */
    const endpoint = process.env.RPC_ENDPOINT_DEVNET || 'https://api.devnet.solana.com';
    if (!/^https?:\/\//.test(endpoint)) {
      throw new Error(`Invalid RPC endpoint: ${endpoint}. Set RPC_ENDPOINT_DEVNET to a full https:// URL.`);
    }
    // Attempt to sign with any server-resident keys for other missing signers (NON-PROGRAM KEYS ONLY)
    const msg = transaction.compileMessage();
    const signerCount = msg.header.numRequiredSignatures;
    const signerKeys = msg.accountKeys.slice(0, signerCount).map(k => k.toBase58());
    
    for (const { publicKey, signature } of transaction.signatures) {
      if (!signature && publicKey && (!programKeypair || !publicKey.equals(programKeypair.publicKey))) {
        const pubkeyStr = publicKey.toBase58();
        if (!signerKeys.includes(pubkeyStr)) {
          //console.log(`[SIGNING] Skipping ${pubkeyStr} - not a required signer`);
          continue;
        }
        
        // Skip the program ID key - we handle that separately above
        if (pubkeyStr === programId) {
          //console.log(`[SIGNING] Skipping program key ${pubkeyStr} - handled separately`);
          continue;
        }
        
        const keyPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${pubkeyStr}.json`);
        if (fs.existsSync(keyPath)) {
          try {
            const secretBytes = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            const keypair = Keypair.fromSecretKey(Uint8Array.from(secretBytes));
            
            // Verify keypair matches expected public key before signing
            if (keypair.publicKey.toBase58() === pubkeyStr) {
              transaction.partialSign(keypair);
              //console.log(`[SIGNING] ✅ Added server key signature for ${pubkeyStr}`);
            } else {
              console.warn(`[SIGNING] ❌ Server key mismatch for ${pubkeyStr}: file contains ${keypair.publicKey.toBase58()}`);
            }
          } catch (e) {
            console.warn(`[SIGNING] Failed to sign with server key ${pubkeyStr}:`, (e as any)?.message);
          }
        } else {
          console.log(`[SIGNING] No server key found for required signer ${pubkeyStr}`);
        }
      }
    }
    signedCount = transaction.signatures.filter(s => s.signature).length;
    //console.log(`[SIGNING] After server keys: ${signedCount} signatures`);
  
    // If user or other non-server signers are still missing, return tx for wallet to sign
    const missing = findMissingSigners(transaction).map(pk => pk.toBase58());
    if (missing.length > 0) {
      console.warn(`[SIGNING] Missing signatures for ${missing.join(", ")}`);
      
      // Debug: show which keys the server has available
      const availableServerKeys: string[] = [];
      if (programKeypair) availableServerKeys.push(`program:${programKeypair.publicKey.toBase58()}`);
      if (opts?.extraSigners?.length) {
        availableServerKeys.push(...opts.extraSigners.map(k => `extra:${k.publicKey.toBase58()}`));
      }
      
      // Check for server keys in wallets folder
      const walletsFolderKeys: string[] = [];
      for (const missingPk of missing) {
        const keyPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${missingPk}.json`);
        if (fs.existsSync(keyPath)) {
          walletsFolderKeys.push(`file:${missingPk}`);
        }
      }
      
      //console.log(`[SIGNING] Server has keys: [${availableServerKeys.join(', ')}]`);
      //console.log(`[SIGNING] Available in wallets folder: [${walletsFolderKeys.join(', ')}]`);
      /*
      console.log(`[SIGNING] Missing keys not found anywhere: [${missing.filter(pk => 
        !availableServerKeys.some(k => k.endsWith(pk)) && 
        !walletsFolderKeys.some(k => k.endsWith(pk))
      ).join(', ')}]`);
      */
      
      const txForWallet = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64");
      return { txForWallet, missing };
    }
  
    // Broadcast the fully signed transaction.
    const conn = new Connection(endpoint, "confirmed");
  
    // If fee-payer is one of our extras (e.g., ephemeral), ensure it's funded on dev/test/local
    try {
      if (transaction.feePayer) {
        const feePayer = (opts?.extraSigners ?? []).find(k => k.publicKey.equals(transaction.feePayer!));
        if (feePayer) {
          const bal = await conn.getBalance(feePayer.publicKey, 'confirmed');
          const min = 0.05 * LAMPORTS_PER_SOL;
          if (bal < min && (endpoint.includes('devnet') || endpoint.includes('testnet') || endpoint.includes('localhost'))) {
            //console.log(`[SIGNING] Airdropping to fee-payer ${feePayer.publicKey.toBase58()}…`);
            const sig = await conn.requestAirdrop(feePayer.publicKey, Math.ceil(min - bal));
            await conn.confirmTransaction(sig, 'finalized');
          }
        }
      }
    } catch (e) {
      console.warn('[SIGNING] fee-payer funding check failed:', (e as any)?.message);
    }
  
    // Simulate transaction before sending
    //console.log(`[SIGNING] Simulating transaction on ${endpoint}...`);
    //console.log(`[SIGNING] Transaction size: ${transaction.serialize().length} bytes`);
    //console.log(`[SIGNING] Transaction instructions: ${transaction.instructions.length}`);
    //console.log(`[SIGNING] Transaction signatures: ${transaction.signatures.filter(s => s.signature).length}/${transaction.signatures.length}`);
    
    const sim = await conn.simulateTransaction(transaction);
    
    if (sim.value.err) {
      console.error(`[SIGNING] Simulation failed:`, sim.value.err);
      console.error(`[SIGNING] Simulation logs:`, sim.value.logs);
      console.error(`[SIGNING] Full simulation result:`, JSON.stringify(sim.value, null, 2));
      
      // Enhanced error reporting for debugging
      let errorMessage = 'Transaction simulation failed';
      if (typeof sim.value.err === 'string') {
        errorMessage = sim.value.err;
      } else if (sim.value.err && typeof sim.value.err === 'object') {
        errorMessage = JSON.stringify(sim.value.err);
      }
      
      // Add logs if available for more context
      if (sim.value.logs && sim.value.logs.length > 0) {
        errorMessage += '. Logs: ' + sim.value.logs.join('; ');
      }
      
      throw new Error(`Simulation failed: ${errorMessage}`);
    }
    
    //console.log(`[SIGNING] Simulation successful (${sim.value.unitsConsumed || 0} compute units consumed)`);
    
    // Only log the number of log lines, not their content
    if (sim.value.logs && sim.value.logs.length > 0) {
     // console.log(`[SIGNING] Simulation produced ${sim.value.logs.length} log lines`);
    }
    
    //console.log(`[SIGNING] Sending transaction to ${endpoint}...`);
    
    try {
      const sig = await sendAndConfirmRawTransaction(conn, transaction.serialize());
      //console.log(`[SIGNING] Transaction confirmed with signature: ${sig}`);
      return { signature: sig };
    } catch (error: any) {
      // Handle blockhash expiry
      if (error.message?.includes('Blockhash not found')) {
       // console.log('[SIGNING] Blockhash expired, refreshing and retrying...');
        
        // Get fresh blockhash and update transaction
        const { blockhash } = await conn.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        
        // Collect all available signers for re-signing
        const allSigners: Keypair[] = [];
        if (programKeypair) allSigners.push(programKeypair);
        if (opts?.extraSigners) allSigners.push(...opts.extraSigners);
        
        // Re-sign the transaction with the new blockhash
        if (allSigners.length > 0) {
          transaction.signatures = [];
          transaction.sign(...allSigners);
        //  console.log(`[SIGNING] Re-signed transaction with ${allSigners.length} signers after blockhash refresh`);
        }
        
        // Retry sending
        const sig = await sendAndConfirmRawTransaction(conn, transaction.serialize());
        //console.log(`[SIGNING] Transaction confirmed after retry: ${sig}`);
        return { signature: sig };
      }
      throw error;
    }
  }