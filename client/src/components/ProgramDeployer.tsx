import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { downloadArtifact } from "@/api/projectArtifact";
import { projectApi } from "@/api/projectApi";
import { Button } from "@/components/ui/button";
import { Rocket, AlertTriangle } from "lucide-react";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SystemInstruction,
  NonceAccount,
  Transaction,
  VersionedTransaction,
  SendTransactionError,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  Connection,
} from "@solana/web3.js";
import ProjectContext from "@/context/project/ProjectContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { connection } from "@/utils/blockchain/connection";
import { connectionManager } from "@/utils/blockchain/connectionManager";
import { useWalletSigner } from "@/utils/blockchain/wallet";

import { createEphemeralKey, EphemeralDeployOptions, deployWithEphemeralKey } from "@/api/projectDeploy";
import { BPF_UPGRADE_LOADER_ID } from "@/utils/helpers/data";
import { darkTheme } from '@/styles/theme';

if (typeof window !== 'undefined') {
  window.onerror = (msg, src, line, col, err) => {
    console.error('[window.onerror]', msg, 'at', src, line + ':' + col, err);
  };
  window.addEventListener('unhandledrejection', ev => {
    console.error('[unhandledrejection]', ev.reason);
  });
}
function u32LE(n: number): Buffer {
  const b = Buffer.alloc(4);
  try {
    b.writeUInt32LE(n, 0);
  } catch (e) {
    console.error('[u32LE] failed – value', n, 'buffer len', b.length, e);
    throw e;
  }
  return b;
}

function u64LE(n: number): Buffer {
  const b = Buffer.alloc(8);
  const lo = n >>> 0;                                  // low 32 bits
  const hi = Math.floor(n / Math.pow(2, 32)) >>> 0;    // high 32 bits
  b.writeUInt32LE(lo, 0);
  b.writeUInt32LE(hi, 4);
  return b;
}

/** Ensure a legacy Transaction has a recentBlockhash (or durable nonce) */
async function ensureLegacyTxBlockhash(
  tx: Transaction,
  conn: Connection,
): Promise<void> {
  if (!tx.recentBlockhash) {
    let nonceValue: string | null = null;
    const ix0 = tx.instructions?.[0];
    if (ix0 && ix0.programId.equals(SystemProgram.programId)) {
      try {
        const kind = SystemInstruction.decodeInstructionType(ix0);
        if (kind === 'AdvanceNonceAccount') {
          const { noncePubkey } = SystemInstruction.decodeNonceAdvance(ix0);
          const info = await conn.getAccountInfo(noncePubkey, 'confirmed');
          if (info?.data) {
            nonceValue = NonceAccount.fromAccountData(info.data).nonce;
          }
        }
      } catch {}
    }
    tx.recentBlockhash = nonceValue ?? (await conn.getLatestBlockhash('confirmed')).blockhash;
  }
}

interface ProgramDeployerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (programId: string) => void;
}

export function ProgramDeployer({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: ProgramDeployerProps) {
  const wallet = useWallet();
  const walletSigner = useWalletSigner();
  const { projectContext } = useContext(ProjectContext);
  const existingProgramId = projectContext?.details?.projectState?.programId;

  const [isLoading, setIsLoading] = useState(false);
  const [bytesLoaded, setBytesLoaded] = useState(false);
  const [programBytes, setProgramBytes] = useState<Uint8Array | null>(null);
  const [byteLength, setByteLength] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [deployStage, setDeployStage] = useState("");

  /* ────────────────────────────────────────────
     Guards that survive React‑18 Strict‑Mode
  ──────────────────────────────────────────── */
  const backendStartedRef = useRef(false);
  const backendRunningRef = useRef(false);

  /* ────────────────────────────────────────────
     Fetch the compiled program bytes (.so)
  ──────────────────────────────────────────── */
  useEffect(() => {
    if (isOpen && !bytesLoaded && !isLoading) {
      loadProgramBytes();
    }
  }, [isOpen, bytesLoaded, isLoading]);

  const loadProgramBytes = async () => {
    if (!projectId) return;

    setIsLoading(true);

    try {
      const raw: any = await downloadArtifact(projectId); // string | ArrayBuffer | Uint8Array

      let bytes: Uint8Array;
      if (raw instanceof Uint8Array) {
        bytes = raw;
      } else if (raw instanceof ArrayBuffer) {
        bytes = new Uint8Array(raw);
      } else if (typeof raw === "string") {
        const bin = atob(raw.replace(/\s+/g, ""));
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        throw new Error(
          "Unsupported artifact format returned by downloadArtifact"
        );
      }

      // ELF magic sanity check
      if (
        !(bytes[0] === 0x7f &&
          bytes[1] === 0x45 &&
          bytes[2] === 0x4c &&
          bytes[3] === 0x46)
      ) {
        console.warn("[DEPLOY] Unexpected ELF magic", bytes.slice(0, 4));
      } else {
      }

      setProgramBytes(bytes);
      setByteLength(bytes.byteLength);
      setBytesLoaded(true);

    } catch (err) {
      console.error("Failed to load program bytes:", err);
      toast.error("Failed to load program", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ────────────────────────────────────────────
     Deploy with an ephemeral authority key
  ──────────────────────────────────────────── */
  const handleDeploy = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();

      // Quick cluster check in UI
      // (prevents wallet‑side simulation failures)
      // @ts-expect-error - accessing private connection properties
      const walletCluster = wallet.adapter?.network;
      const conn = connectionManager.getConnection();
      const rpcUrl = (conn as any)._rpcEndpoint || (conn as any).rpcEndpoint;
      const connCluster = rpcUrl?.includes("devnet") ? "devnet"
        : rpcUrl?.includes("testnet") ? "testnet"
        : "mainnet‑beta";
      if (walletCluster && walletCluster !== connCluster) {
        toast.error(
          `Cluster mismatch: wallet=${walletCluster}, rpc=${connCluster}.`,
          { description: "Switch Phantom network or RPC before deploying." }
        );
        setIsLoading(false);
        return;
      }

      if (backendRunningRef.current || backendStartedRef.current) return;
      backendRunningRef.current = true;
      backendStartedRef.current = true;

      if (isLoading) return;
      setIsLoading(true);
      setProgress(1);
      await new Promise((r) => setTimeout(r, 0)); // paint flush

  
      try {
        if (!programBytes) {
          toast.error("Program bytes missing");
          return;
        }

        const ctxProgramId = projectContext?.details?.projectState?.programId;
        const looksLikePubkey =
          ctxProgramId && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ctxProgramId);

        // Removed debug logs

        if (looksLikePubkey) {
          const candidatePk = new PublicKey(ctxProgramId!);
          const acctInfo = await connectionManager.getConnection().getAccountInfo(candidatePk, "confirmed");

          // Check if program exists on-chain

          if (acctInfo) {
            /* UPGRADE path (unchanged) */
        const authorityEphem = Keypair.generate();

        const deployOptions: EphemeralDeployOptions = {
          programData: programBytes.toString(),
          programArgs: [],
          programEnv: {},
          programId: candidatePk.toBase58(),
        };

            const deployResult = await deployWithEphemeralKey(projectId, authorityEphem.publicKey.toBase58(), deployOptions);
            if (deployResult.taskId) onSuccess(candidatePk.toBase58());

            toast.success("Program upgraded successfully", {
              description: `Program ID: ${candidatePk.toBase58()}`,
              action: {
                label: "Explorer",
                onClick: () =>
                  window.open(
                    `https://explorer.solana.com/address/${candidatePk.toBase58()}?cluster=devnet`,
                    "_blank"
                  ),
              },
            });
            onClose();
            return;
          }
        }


        /* ───────────── NEW: wallet-first signing flow ───────────── */
        // 1. Create an ephemeral keypair on the backend (secret stays on server)
        const ephemeralPubkeyStr = await createEphemeralKey(projectId);
        if (!ephemeralPubkeyStr) {
          throw new Error("Failed to get ephemeral public key from server");
        }

        // 2. Ask backend for a durable nonce we can anchor the final tx to
        // Commented out since we're using fresh blockhash instead
        // let noncePubkey: string;
        // let nonceHash: string;
        
        try {
          // First try to get an existing nonce account
          // const nonceResult = await projectApi.getNonce(
          //   projectId,
          //   wallet.publicKey!.toBase58(),
          // );
          // noncePubkey = nonceResult.noncePubkey;
          // nonceHash = nonceResult.nonceHash;
          
        } catch (error: any) {
          /* Backend 404 *or* propagated "NO_NONCE_ACCOUNT"
             ⇒ wallet has no durable‑nonce yet – create one */
          if (
            error?.response?.status === 404 ||
            (error instanceof Error && error.message === 'NO_NONCE_ACCOUNT')
          ) {
            setDeployStage('Creating durable nonce account…');
            
            try {
              await walletSigner.createNonce(connection);
              
              // Retry now that we have a nonce account
              // const nonceResult = await projectApi.getNonce(
              //   projectId,
              //   wallet.publicKey!.toBase58(),
              // );
              
              // noncePubkey = nonceResult.noncePubkey;
              // nonceHash = nonceResult.nonceHash;
              
            } catch (createError: any) {
              /* Emit detailed diagnostics so we can read response body,
                 Phantom rejections, RPC errors, etc. */
              console.error(
                "[DEPLOY] durable-nonce creation failed:",
                createError?.response?.data ?? createError,
              );

              /* Bubble up original error text to toast for easier reading */
              const msg =
                createError?.response?.data?.message ??
                (createError instanceof Error
                  ? createError.message
                  : String(createError));

              throw new Error(
                "Failed to create durable nonce account → " + msg,
              );
            }
          } else {
            // Any other error => re‑throw
            throw error;
          }
        }

        // Construct PublicKey with the string returned from the server
        const ephemeralPubkey = new PublicKey(ephemeralPubkeyStr);
        
        // CRITICAL: Calculate proper funding for ephemeral key
        const FUNDING_CHUNK = 850;
        const numChunks = Math.ceil(programBytes.length / FUNDING_CHUNK);
        
        // Funding calculation:
        // - Buffer creation: 1 tx
        // - Write chunks: numChunks txs  
        // - SetAuthority after writes: 1 tx
        // - Safety margin: 10 txs
        const totalTxCount = 1 + numChunks + 1 + 10;
        const FEE_PER_TX = 15000; // 15k lamports per transaction (conservative)
        
        const fundingBufferSpace = 37 + programBytes.byteLength;
        const fundingBufferRent = await connectionManager.getConnection().getMinimumBalanceForRentExemption(fundingBufferSpace);
        const totalFeesNeeded = totalTxCount * FEE_PER_TX;
        const SAFETY_CUSHION = 200_000_000; // 0.2 SOL safety
        
        const totalFunding = fundingBufferRent + totalFeesNeeded + SAFETY_CUSHION;
        
        console.log(`[DEPLOY] Funding calculation:
          - Buffer rent: ${fundingBufferRent} lamports
          - Transactions: ${totalTxCount} × ${FEE_PER_TX} = ${totalFeesNeeded} lamports
          - Safety cushion: ${SAFETY_CUSHION} lamports
          - Total funding: ${totalFunding} lamports (${totalFunding / 1_000_000_000} SOL)`);
        
        setDeployStage('Funding ephemeral key...');
        
        // Fund the ephemeral key with calculated amount
        const fundingTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey!,
            toPubkey: ephemeralPubkey,
            lamports: totalFunding,
          })
        );
        
        const fundingSig = await wallet.sendTransaction(fundingTx, connection);
        await connection.confirmTransaction(fundingSig, 'confirmed');
        console.log(`[DEPLOY] Funded ephemeral key with ${totalFunding / 1_000_000_000} SOL`);
        
        setDeployStage('Building transaction...');
        setProgress(10);

        // 3. Use the existing program keypair from code generation, or generate new one
        let programKeypair: Keypair;
        let programId: PublicKey;
        
        if (existingProgramId) {
          // Use the program ID from code generation
          programId = new PublicKey(existingProgramId);
          // Note: The actual keypair will be loaded by the backend from the wallets folder
          // We create a dummy keypair here just for the client-side logic, but the backend
          // will use the correct keypair that matches this programId
          programKeypair = Keypair.generate(); // This is just a placeholder
        } else {
          // Fallback: generate new keypair (this should rarely happen if code gen worked properly)
          programKeypair = Keypair.generate();
          programId = programKeypair.publicKey;
          console.warn(`⚠️ No existing program ID found in context, generating new one: ${programId.toBase58()}`);
          console.warn(`⚠️ This may indicate code generation didn't complete properly`);
        }

        // Find PDA for program data
        const [programDataPk] = PublicKey.findProgramAddressSync(
          [programId.toBuffer()],
          BPF_UPGRADE_LOADER_ID
        );

        // Calculate rent amounts
        const bufferSpace = 37 + programBytes.byteLength;
        const bufferRent = await connection.getMinimumBalanceForRentExemption(bufferSpace);
        const programRent = await connection.getMinimumBalanceForRentExemption(36);
        
        
        // 4. Create buffer account
        const bufferAccount = Keypair.generate();
        setDeployStage('Creating buffer account...');
        setProgress(20);
        
        // Create and initialize buffer transaction
        const createBufferIx = SystemProgram.createAccount({
          fromPubkey: wallet.publicKey!,
          lamports: bufferRent,
          newAccountPubkey: bufferAccount.publicKey,
          space: bufferSpace,
          programId: BPF_UPGRADE_LOADER_ID,
        });

        
        // Initialize buffer with wallet as authority
        const bufferInitIx = new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([0, 0, 0, 0]), // InitializeBuffer tag
        });

        
        // Set buffer authority to ephemeral key (server will sign writes)
        const setAuthorityIx = new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!,       isSigner: true,  isWritable: false },
            { pubkey: ephemeralPubkey,         isSigner: false, isWritable: false },
          ],
          data: Buffer.concat([
            Buffer.from([4, 0, 0, 0]),        // SetAuthority tag
            Buffer.from([1])                   // COption Some(1) to indicate new authority
          ]),
        });
        
        // Prepare write instructions for program bytes (ephemeral will be signer)
        const writeInstructions: TransactionInstruction[] = [];
        // Keep each write well under the legacy 1232-byte cap
        const CHUNK = 850;
        
        // Verify program bytes integrity before chunking
        
        let totalBytesWritten = 0;
        const chunkSummary: string[] = [];
        
        for (let off = 0; off < programBytes.length; off += CHUNK) {
          const slice = programBytes.slice(off, off + CHUNK);
          totalBytesWritten += slice.length;
          chunkSummary.push(`offset:${off} len:${slice.length}`);
          
          // Validate each chunk
          if (off === 0) {
            // First chunk should contain ELF magic if it's the start
            const firstBytes = Array.from(slice.slice(0, 4));
            
            // Verify ELF magic is correct
            if (firstBytes[0] !== 0x7f || firstBytes[1] !== 0x45 || firstBytes[2] !== 0x4c || firstBytes[3] !== 0x46) {
              console.error(`[CRITICAL] ELF magic is invalid in first chunk! Got [${firstBytes.join(',')}], expected [127,69,76,70]`);
              throw new Error(`Invalid ELF magic in program bytes: [${firstBytes.join(',')}]`);
            }
          }
          if (off + slice.length >= programBytes.length) {
            // Last chunk
          }
          
          let writeIx: TransactionInstruction;
          try {
            const sliceBuffer = Buffer.from(slice);  // Explicit conversion
            
            // BPF Upgradeable Loader Write instruction using proper bincode serialization
            // Enum discriminator (1 as u32 for Write variant) + Write { offset: u32, bytes: Vec<u8> }
            // Vec<u8> in bincode: length as u64 + data bytes
            const writeData = Buffer.concat([
              u32LE(1),                   // Write instruction discriminator (u32 LE) - FIXED!
              u32LE(off),                 // offset field (u32 LE)
              u64LE(slice.length),        // Vec<u8> length field (u64 LE for bincode)
              sliceBuffer,                // Vec<u8> data bytes
            ]);
            
            // Debug: validate the constructed write data
            
            // Validate ELF magic in first chunk only
            if (off === 0) {
              const dataOffset = 16; // 4 bytes discriminator + 4 bytes offset + 8 bytes u64 length
              const dataSection = writeData.subarray(dataOffset, dataOffset + 4);
              
              if (dataSection[0] !== 0x7f || dataSection[1] !== 0x45 || dataSection[2] !== 0x4c || dataSection[3] !== 0x46) {
                throw new Error(`ELF magic corrupted in write instruction! Got [${Array.from(dataSection).join(',')}]`);
              }
            }
            
            writeIx = new TransactionInstruction({
              programId: BPF_UPGRADE_LOADER_ID,
              keys: [
                { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
                // Ephemeral (server-held) is buffer authority during writes
                { pubkey: ephemeralPubkey,          isSigner: true,  isWritable: false },
              ],
              data: writeData,
            });
          } catch (e) {
            console.error(`[STEP-WRITE offset=${off}] failed`, e);
            throw e;
          }
          writeInstructions.push(writeIx);
        }
        
        // Validate chunk coverage
        if (totalBytesWritten !== programBytes.length) {
          throw new Error(`Chunk coverage mismatch: ${totalBytesWritten} != ${programBytes.length}`);
        }

        
        // Create program account
        const createProgramAcct = SystemProgram.createAccount({
          fromPubkey: wallet.publicKey!,
          newAccountPubkey: programId,
          lamports: programRent,
          space: 36,
          programId: BPF_UPGRADE_LOADER_ID,
        });

        
        // Deploy instruction
        let deployIx: TransactionInstruction;
        try {
          deployIx = new TransactionInstruction({
            programId: BPF_UPGRADE_LOADER_ID,
            keys: [
              { pubkey: wallet.publicKey!, isSigner: true, isWritable: true },
              { pubkey: programDataPk, isSigner: false, isWritable: true },
              { pubkey: programId, isSigner: true, isWritable: true }, // Program account needs to sign since it's being created
              { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
              { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
              { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: ephemeralPubkey, isSigner: true, isWritable: false },
            ],
            data: Buffer.concat([
              Buffer.from([2, 0, 0, 0]),
              u64LE(programBytes.length),
            ]),
          });
        } catch (e) {
          console.error('[STEP-DEPLOY] failed', e);
          throw e;
        }

        
        /* ──────────────────────────────────────────────
           Stage 1 – buffer create & init, then hand authority to ephemeral
        ────────────────────────────────────────────── */
        const initTx = new Transaction()
          .add(createBufferIx)
          .add(bufferInitIx)
          .add(setAuthorityIx);
        await signAndRelayWithWallet(initTx, [bufferAccount]);
        
        // VERIFY BUFFER AUTHORITY IS SET CORRECTLY with retry logic
        let bufferVerified = false;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            // Add small delay to allow RPC nodes to sync
            if (attempt > 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive backoff
            }
            
            const bufferAccountInfo = await connection.getAccountInfo(bufferAccount.publicKey, 'confirmed');
            if (bufferAccountInfo?.data) {
              // Buffer account format: 4 bytes state discriminant + 1 byte COption + 32 bytes authority (if Some)
              const optionByte = bufferAccountInfo.data[4];
              
              if (optionByte === 1) {
                // Authority is present
                const authorityBytes = bufferAccountInfo.data.subarray(5, 37);
                const authorityPubkey = new PublicKey(authorityBytes);
                
                if (authorityPubkey.toBase58() !== ephemeralPubkeyStr) {
                  throw new Error(`Buffer authority mismatch`);
                }
                bufferVerified = true;
                break;
              } else if (optionByte === 0) {
                throw new Error(`Buffer authority is None - SetAuthority instruction failed`);
              } else {
                throw new Error(`Invalid buffer authority format`);
              }
            } else {
              throw new Error("Buffer account has no data after initialization");
            }
          } catch (verifyError) {
            lastError = verifyError instanceof Error ? verifyError : new Error(String(verifyError));
            if (attempt === 5) {
              console.error(`❌ Buffer authority verification failed after ${attempt} attempts:`, lastError);
              break;
            }
          }
        }
        
        if (!bufferVerified && lastError) {
          throw lastError;
        }

        /* ──────────────────────────────────────────────
           Stage 2 – upload bytes in batches (ATOMICALLY)
        ────────────────────────────────────────────── */
        
        // Calculate optimal batching - each write instruction is ~900-950 bytes
        // Target ~800 bytes per transaction to leave room for transaction overhead
        const MAX_WRITES_PER_TX = Math.max(1, Math.floor(800 / (CHUNK + 100))); // +100 for instruction overhead
        
        let batchBlockhash = null;
        
        for (let i = 0; i < writeInstructions.length; i += MAX_WRITES_PER_TX) {
          const batchNum = Math.floor(i / MAX_WRITES_PER_TX) + 1;
          const batch = writeInstructions.slice(i, i + MAX_WRITES_PER_TX);
          const tx = new Transaction().add(...batch);
          
          // Refresh blockhash every 5 batches or if we don't have one (more frequent)
          if (!batchBlockhash || batchNum % 5 === 1) {
            const latest = await connection.getLatestBlockhash('confirmed');
            batchBlockhash = latest.blockhash;
          }
          
          // FIXED: Ephemeral key pays fees AND signs as authority
          // This works because we properly funded it above
          tx.feePayer = ephemeralPubkey;  // Ephemeral is fee payer
          tx.recentBlockhash = batchBlockhash;
          
          // size guard pre-send
          const probe = tx.serialize({ requireAllSignatures: false });
          
          if (probe.length > 1200) {
            throw new Error(`Tx too large (${probe.length} bytes). Reduce CHUNK or writes/tx.`);
          }
          
          try {
            // No wallet signature needed - send directly to server for ephemeral signing
            const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
            
            const txResult = await projectApi.relayTx(projectId, { 
              encodedTx: encoded, 
              programId: programId.toBase58() 
            });
            
            // Check if this is a successful transaction result
            if ('signature' in txResult) {
              // Only log every 50 batches to reduce clutter
              if (batchNum % 50 === 0 || batchNum === Math.ceil(writeInstructions.length / MAX_WRITES_PER_TX)) {
                console.log(`✅ Write batch ${batchNum}/${Math.ceil(writeInstructions.length / MAX_WRITES_PER_TX)} completed`);
              }
              
              // Add buffer verification after every 10 write batches to detect corruption early
              if (batchNum % 10 === 0 || batchNum === Math.ceil(writeInstructions.length / MAX_WRITES_PER_TX)) {
                console.log(`[VERIFY] Checking buffer after batch ${batchNum}...`);
                
                // Add small delay for RPC sync
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const bufferCheck = await connection.getAccountInfo(bufferAccount.publicKey, 'confirmed');
                if (bufferCheck?.data) {
                  const bufferData = bufferCheck.data.subarray(37); // Skip 37-byte header
                  const firstBytes = Array.from(bufferData.slice(0, 4));
                  
                  if (batchNum >= 10 && firstBytes.join(',') !== '127,69,76,70') {
                    console.error(`[CRITICAL] Buffer corruption detected after batch ${batchNum}!`);
                    console.error(`[CRITICAL] Expected [127,69,76,70], got [${firstBytes.join(',')}]`);
                    console.error(`[CRITICAL] Buffer length: ${bufferData.length}`);
                    
                    // Check if buffer is all zeros
                    const nonZeroBytes = bufferData.filter(b => b !== 0).length;
                    console.error(`[CRITICAL] Non-zero bytes in buffer: ${nonZeroBytes}/${bufferData.length}`);
                    
                    throw new Error(`Buffer corruption detected at batch ${batchNum}`);
                  } else if (batchNum >= 10) {
                    console.log(`[VERIFY] Buffer intact after batch ${batchNum}, ELF magic: [${firstBytes.join(',')}]`);
                  }
                } else {
                  console.error(`[CRITICAL] Buffer account not found after batch ${batchNum}!`);
                }
              }
            } else {
              // This is an error response (e.g., WALLET_SIGNATURE_REQUIRED)
              console.error(`❌ Write batch ${batchNum} failed:`, txResult);
              throw new Error(`Write batch transaction failed: ${JSON.stringify(txResult)}`);
            }
          } catch (error) {
            console.error(`❌ Write batch ${batchNum} error:`, error);
            throw error;
          }
          
          // Update progress from 20% to 80% based on write completion
          const writeProgress = Math.floor((i + batch.length) / writeInstructions.length * 60);
          setProgress(20 + writeProgress);
          
          // Small delay to avoid overwhelming the server
          if (batchNum % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        setProgress(80);
        
        // VERIFY BUFFER DATA BEFORE DEPLOYMENT with retry logic
        let bufferDataVerified = false;
        let lastVerificationError: Error | null = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for RPC to sync
            }
            
            const bufferAccountInfo = await connection.getAccountInfo(bufferAccount.publicKey, 'confirmed');
            if (!bufferAccountInfo?.data) {
              throw new Error("Buffer account has no data after write operations");
            }
            
            // The buffer account data format is: 37 bytes of metadata + program bytes
            const bufferProgramData = bufferAccountInfo.data.subarray(37);
            
            // Check ELF magic in buffer
            if (bufferProgramData.length >= 4) {
              const bufferElfMagic = Array.from(bufferProgramData.subarray(0, 4));
              
              if (bufferElfMagic[0] !== 0x7f || bufferElfMagic[1] !== 0x45 || bufferElfMagic[2] !== 0x4c || bufferElfMagic[3] !== 0x46) {
                throw new Error(`Buffer corruption detected: Invalid ELF magic [${bufferElfMagic.join(',')}]`);
              }
            }
            
            // Compare first and last few bytes
            const originalFirst = Array.from(programBytes.slice(0, 8));
            const bufferFirst = Array.from(bufferProgramData.subarray(0, 8));
            const originalLast = Array.from(programBytes.slice(-8));
            const bufferLast = Array.from(bufferProgramData.subarray(-8));
            
            if (JSON.stringify(originalFirst) !== JSON.stringify(bufferFirst)) {
              throw new Error(`Buffer corruption: First bytes mismatch`);
            }
            
            if (JSON.stringify(originalLast) !== JSON.stringify(bufferLast)) {
              throw new Error(`Buffer corruption: Last bytes mismatch`);
            }
            
            bufferDataVerified = true;
            break;
          } catch (verificationError) {
            lastVerificationError = verificationError instanceof Error ? verificationError : new Error(String(verificationError));
            if (attempt === 3) {
              console.error(`❌ Buffer verification failed after ${attempt} attempts:`, lastVerificationError);
            }
          }
        }
        
        if (!bufferDataVerified && lastVerificationError) {
          throw lastVerificationError;
        }

        /* ──────────────────────────────────────────────
           Stage 3 – program account + deploy
        ────────────────────────────────────────────── */
        
        // Skip nonce for deployment - use fresh blockhash to avoid "Blockhash not found" errors
        // const advanceIx = SystemProgram.nonceAdvance({
        //   noncePubkey: new PublicKey(noncePubkey),
        //   authorizedPubkey: wallet.publicKey!,
        // });

        const deployTx = new Transaction()
          // .add(advanceIx)            /* skip nonce for deployment */
          .add(createProgramAcct)
          .add(deployIx);


        // Recent block-hash & fee-payer
        /* Use fresh blockhash instead of durable nonce to avoid timing issues */
        const { blockhash: freshHash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        deployTx.recentBlockhash = freshHash;
        deployTx.lastValidBlockHeight = lastValidBlockHeight;
        deployTx.feePayer = wallet.publicKey!;

        /* Size guard – keep below ~1232 B ceiling */
        if (deployTx.serialize({ requireAllSignatures: false }).length > 1220) {
          throw new Error("Finalise tx unexpectedly large; investigate batching");
        }

        /* Helpers */
        async function signAndRelayWithWallet(tx: Transaction, extras: Keypair[]): Promise<string> {
          
          // Set fee payer and blockhash BEFORE compiling message
          tx.feePayer = wallet.publicKey!;
          await ensureLegacyTxBlockhash(tx, connectionManager.getConnection());
          
          // Force recompile to ensure fee payer is properly set
          tx.compileMessage();
          
          // Debug: log transaction details before signing
          const msg = tx.compileMessage();
          
          // Verify wallet is first signer
          const walletIsFirstSigner = msg.accountKeys[0].equals(wallet.publicKey!);
          if (!walletIsFirstSigner) {
            throw new Error(`Transaction setup error: Wallet should be first signer`);
          }
          
          // Initialize signatures array properly first
          
          // Clean signing approach: sign with wallet first on clean transaction
          
          // Clone the transaction to ensure clean state
          const cleanTx = new Transaction();
          cleanTx.feePayer = tx.feePayer;
          cleanTx.recentBlockhash = tx.recentBlockhash;
          cleanTx.lastValidBlockHeight = tx.lastValidBlockHeight;
          
          // Add all instructions
          for (const instruction of tx.instructions) {
            cleanTx.add(instruction);
          }
          
          // Force compilation to set up signatures array properly
          cleanTx.compileMessage();
          
          
          // Debug transaction before wallet signing
          
          // Try wallet signing with error handling
          try {
            const signedTx = await wallet.signTransaction!(cleanTx);
            
            // Always use the returned transaction as it might be a new instance
            if (signedTx !== cleanTx) {
              // Replace the entire transaction
              Object.assign(cleanTx, {
                signatures: signedTx.signatures,
                feePayer: signedTx.feePayer,
                recentBlockhash: signedTx.recentBlockhash,
                lastValidBlockHeight: signedTx.lastValidBlockHeight,
                instructions: signedTx.instructions
              });
            } else {
            }
          } catch (error) {
            console.error(`Wallet signing failed:`, error);
            throw error;
          }
          
          
          
          // Then apply extra signatures
          if (extras && extras.length > 0) {
            cleanTx.partialSign(...extras);
          }
          
          // Use the clean transaction for the rest of the process
          tx = cleanTx;
          
          // Recompile message for the clean transaction
          const finalMsg = tx.compileMessage();
          
          // Final signature count check
          let currentSigs = tx.signatures.filter(s => s.signature).length;
          
          // Debug: show which signatures we have
          
          // Handle missing signatures - if only wallet signature is missing, try server handling
          if (currentSigs < finalMsg.header.numRequiredSignatures) {
            const missingSigs = [];
            for (let i = 0; i < finalMsg.header.numRequiredSignatures; i++) {
              if (!tx.signatures[i]?.signature) {
                missingSigs.push(finalMsg.accountKeys[i].toBase58());
              }
            }
            
            
            // If only the wallet signature is missing and it's the first signer, try server approach
            if (missingSigs.length === 1 && missingSigs[0] === wallet.publicKey!.toBase58()) {
              
              // Send partially signed transaction to server and let it handle wallet signature request
              const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
              
              try {
                const result = await projectApi.relaySignedTx(
                  projectId,
                  encoded,
                  programId.toBase58()
                );
                
                if ('signature' in result) {
                  return result.signature; // Success, return the signature
                } else if (result.code === 'WALLET_SIGNATURE_REQUIRED') {
                  // Let this fall through to the normal 409 handling below
                  throw new Error(`Server requests wallet signature: ${result.missing.join(', ')}`);
                } else {
                  throw new Error('Unexpected response from server');
                }
              } catch (error) {
                // Fall through to the original error
              }
            }
            
            throw new Error(`Transaction is missing ${finalMsg.header.numRequiredSignatures - currentSigs} signatures: ${missingSigs.join(', ')}`);
          }
          
          const encoded = tx.serialize({ requireAllSignatures: true }).toString("base64");
          
          try {
            const result = await projectApi.relaySignedTx(
              projectId,
              encoded,
              programId.toBase58()
            );
            
            if ('signature' in result) {
              // Wait for transaction confirmation before returning
              try {
                await connectionManager.getConnection().confirmTransaction({
                  signature: result.signature,
                  blockhash: tx.recentBlockhash!,
                  lastValidBlockHeight: tx.lastValidBlockHeight || (await connectionManager.getConnection().getLatestBlockhash()).lastValidBlockHeight
                }, 'confirmed');
                return result.signature;
              } catch (confirmError) {
                console.warn(`Transaction confirmation failed, but transaction was sent: ${result.signature}`, confirmError);
                // Return signature even if confirmation times out - the transaction likely succeeded
                return result.signature;
              }
            } else if (result.code === 'WALLET_SIGNATURE_REQUIRED') {
              console.error(`Server still needs wallet signature. Missing:`, result.missing);
              throw new Error(`Server requests wallet signature for: ${result.missing?.join(', ')}`);
            } else {
              console.error(`Unexpected relay response:`, result);
              throw new Error('Unexpected response from relay signed transaction');
            }
          } catch (error) {
            console.error(`Relay failed:`, error);
            throw error;
          }
        }

        // Wallet signs AFTER every instruction is already present
        setDeployStage('Awaiting wallet signature…');
        setProgress(40);
        if (!wallet.signTransaction) throw new Error("Wallet can't sign");
        
        const signedTx = await wallet.signTransaction(deployTx);
        
        // Check if wallet returned a different transaction object
        if (signedTx !== deployTx) {
          Object.assign(deployTx, signedTx);  // Update deployTx with signed version
        }
        
        
        
        // Check if we need to sign with the program keypair on the client side
        // When using existing program ID, the real keypair is on the backend
        if (!existingProgramId) {
          // Only sign with program keypair if we generated a new one (fallback case)
          deployTx.partialSign(programKeypair);
        } else {
          // For existing program ID, the backend will handle program keypair signing
        }
        
        // 5. Send the partially-signed transaction to backend for co-signing and broadcast
        setDeployStage('Sending to server for co-signing...');
        setProgress(60);
        const encodedTx = deployTx.serialize({ requireAllSignatures: false }).toString('base64');

        
        
        
        try {
          const firstRelay = await projectApi.relaySignedTx(
            projectId,
            encodedTx,
            programId.toBase58(),
            undefined,                 // taskId is now optional but still expected by type
            [ephemeralPubkeyStr]       // tell server which ephemeral key must co-sign
          );

          if ('signature' in firstRelay) {
            // Success - deployment completed
          } else if (firstRelay.code === 'WALLET_SIGNATURE_REQUIRED' && firstRelay.txBase64) {
            // Ask wallet to countersign and retry the relay
            if (!wallet?.signTransaction) {
              throw new Error('Wallet does not support signTransaction');
            }
            const raw = Buffer.from(firstRelay.txBase64, 'base64');
            const tx: Transaction | VersionedTransaction = (raw[0] === 0x80)
              ? VersionedTransaction.deserialize(raw)
              : Transaction.from(raw);
            // Defensive: for legacy tx ensure feePayer = wallet so wallet is a required signer
            if (tx instanceof Transaction && !tx.feePayer && wallet.publicKey) {
              tx.feePayer = wallet.publicKey;
            }
            // Guard: verify wallet is among required signers before asking to sign
            const message: any = (tx as any).message ?? (tx as Transaction).compileMessage();
            const required = (message.staticAccountKeys ?? message.accountKeys)
              .slice(0, message.header.numRequiredSignatures);
            const walletIsRequired = wallet.publicKey
              ? required.some((k: PublicKey) => k.equals(wallet.publicKey!))
              : false;
            if (!walletIsRequired) {
              console.error('[relay] Wallet is not a required signer of the 409 tx', {
                required: required.map((k: PublicKey) => k.toBase58()),
                wallet: wallet.publicKey?.toBase58(),
              });
              toast.error(
                'Server returned a tx that does not require your wallet signature. ' +
                'This might indicate an issue with the transaction structure.'
              );
              throw new Error('WALLET_NOT_REQUIRED_SIGNER');
            }
            if (tx instanceof Transaction) {
              await ensureLegacyTxBlockhash(tx, connectionManager.getConnection());
              tx.feePayer = wallet.publicKey!;
            }
            const signed = await wallet.signTransaction(tx as any);
            const secondRelay = await projectApi.relaySignedTx(
              projectId,
              signed.serialize({ requireAllSignatures: false }).toString('base64'),
              programId.toBase58()
            );
            if ('signature' in secondRelay) {
              // Success - deployment completed with wallet signature
            } else {
              throw new Error(`Still missing signatures: ${secondRelay.missing?.join(', ')}`);
            }
          } else {
            throw new Error('Unexpected relay response');
          }
          
          setDeployStage('Transaction confirmed!');
          setProgress(90);
          
          
          // Update project with new program ID
          onSuccess(programId.toBase58());
        } catch (err) {
          if (err instanceof SendTransactionError) {
            console.error('Transaction simulation failed:', err);
            console.error('Sim logs:', err.logs);
          }
          throw err;
        }

        toast.success('Program deployment submitted', {
          description: `Program ID: ${programId.toBase58()}`,
          action: {
            label: 'Explorer',
            onClick: () =>
              window.open(
                `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`,
                '_blank'
              ),
          },
        });
        onClose();
        return;
      } catch (err: any) {
        console.error(err);
        toast.error("Deployment failed", { description: err.message ?? err.toString() });
      } finally {
        setIsLoading(false);
        setTimeout(() => {
          setProgress(null);
          setDeployStage("");
        }, 750);

        backendRunningRef.current = false;
        backendStartedRef.current = false;
      }
    },
    [
      isLoading,
      projectId,
      programBytes,
      wallet,
      onSuccess,
      onClose,
      projectContext,
    ]
  );

  /* ────────────────────────────────────────────
     JSX
  ──────────────────────────────────────────── */
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent 
        className="backdrop-blur-xl sm:max-w-md shadow-2xl"
        style={{
          backgroundColor: darkTheme.background.secondary,
          borderColor: darkTheme.border.default,
          backdropFilter: `blur(${darkTheme.glass.blur})`,
          color: darkTheme.text.primary,
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-lg font-medium"
            style={{ color: darkTheme.text.primary }}
          >
            Deploy Program to Devnet
          </DialogTitle>
          <DialogDescription style={{ color: darkTheme.text.secondary }}>
            Your program will be deployed using your connected wallet. Make sure
            you have enough SOL for the transaction fees.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {bytesLoaded ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm font-medium"
                  style={{ color: darkTheme.text.secondary }}
                >
                  Program size:
                </span>
                <span className="text-sm font-mono">
                  {byteLength.toLocaleString()} bytes
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span 
                  className="text-sm font-medium"
                  style={{ color: darkTheme.text.secondary }}
                >
                  Wallet:
                </span>
                <span className="text-sm font-mono truncate max-w-[200px]">
                  {wallet.publicKey ? wallet.publicKey.toBase58() : "Not connected"}
                </span>
              </div>

              {!wallet.publicKey && (
                <div className="bg-muted p-4 rounded-md flex items-start space-x-2 mt-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p 
                      className="text-sm font-medium"
                      style={{ color: darkTheme.text.primary }}
                    >
                      Wallet not connected
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: darkTheme.text.secondary }}
                    >
                      Please connect your wallet to deploy the program.
                    </p>
                  </div>
                </div>
              )}

              {progress !== null && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: darkTheme.text.secondary }}
                    >
                      {deployStage || "Preparing…"}
                    </span>
                    <span 
                      className="text-sm"
                      style={{ color: darkTheme.text.secondary }}
                    >
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} aria-label="deployment progress" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20">
              <div 
                className="animate-pulse"
                style={{ color: darkTheme.text.secondary }}
              >
                Loading program data…
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto transition-colors"
            style={{
              backgroundColor: 'transparent',
              borderColor: darkTheme.border.default,
              color: darkTheme.text.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = darkTheme.background.tertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDeploy}
            disabled={isLoading || !bytesLoaded}
            className="w-full sm:w-auto flex items-center transition-colors"
            style={{
              backgroundColor: darkTheme.accent.green,
              color: darkTheme.text.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${darkTheme.accent.green}CC`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = darkTheme.accent.green;
            }}
          >
            {isLoading ? (
              <span>Deploying…</span>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                <span>Deploy</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
