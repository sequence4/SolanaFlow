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
// No longer using client-side deployment
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SystemInstruction,
  NonceAccount,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  SendTransactionError,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
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
import { connection } from "@/utils/connection";
import { useWalletSigner } from "@/utils/wallet";

import { createEphemeralKey, EphemeralDeployOptions, deployWithEphemeralKey } from "@/api/projectDeploy";
import { BPF_LOADER_CHUNK_SIZE, BPF_UPGRADE_LOADER_ID } from "@/utils/constants";

// Toggle verbose client-side logs by setting NEXT_PUBLIC_DEBUG_LOGS=true in your
// environment.  This reduces noisy console output in production.
// Temporarily enabled by default to debug deployment issues
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true' || true;

/* ────────────────────────────────────────────
   TEMP instrumentation helpers
   They wrap Buffer.writeXXLE so we can see which
   value/offset causes "index out of range".
──────────────────────────────────────────── */
// Global trap so ANY uncaught error prints a stack (esp. "index out of range")
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
  conn: typeof connection,
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
    if (DEBUG_LOGS) console.log("🔍 Fetching compiled program…");

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
        if (DEBUG_LOGS) console.log(
          "[DEPLOY] Valid ELF magic verified:",
          Array.from(bytes.slice(0, 4))
        );
      }

      setProgramBytes(bytes);
      setByteLength(bytes.byteLength);
      setBytesLoaded(true);

      if (DEBUG_LOGS) console.log(`✅ Program fetched: ${bytes.byteLength.toLocaleString()} bytes`);
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
      const rpcUrl = (connection as any)._rpcEndpoint || (connection as any).rpcEndpoint;
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

      if (DEBUG_LOGS) {
        console.log("[DEBUG] =================== DEPLOYMENT START ===================");
        console.log("[DEBUG] existingProgramId from context:", existingProgramId);
        console.log("[DEBUG] projectContext.details:", projectContext?.details);
        console.log("[DEBUG] projectContext.details.projectState:", projectContext?.details?.projectState);
        console.log("[DEBUG] programBytes length:", programBytes?.length);
      }

      try {
        if (!programBytes) {
          toast.error("Program bytes missing");
          return;
        }

        const ctxProgramId = projectContext?.details?.projectState?.programId;
        const looksLikePubkey =
          ctxProgramId && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ctxProgramId);

        if (DEBUG_LOGS) {
          console.log("[DEBUG] ctxProgramId:", ctxProgramId);
          console.log("[DEBUG] looksLikePubkey:", looksLikePubkey);
        }

        if (looksLikePubkey) {
          const candidatePk = new PublicKey(ctxProgramId!);
          const acctInfo = await connection.getAccountInfo(candidatePk, "confirmed");

          if (DEBUG_LOGS) {
            console.log("[DEBUG] Checking if program account exists for:", candidatePk.toBase58());
            console.log("[DEBUG] Account info:", acctInfo ? "EXISTS" : "DOES NOT EXIST");
          }

          if (acctInfo) {
            /* UPGRADE path (unchanged) */
            if (DEBUG_LOGS) console.log("[DEBUG] 🔄 Taking UPGRADE path for existing program");
        const authorityEphem = Keypair.generate();
            if (DEBUG_LOGS) console.log("🔑 Ephemeral authority key:", authorityEphem.publicKey.toBase58());

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

        if (DEBUG_LOGS) console.log("[DEBUG] 🆕 Taking DEPLOY path for new program deployment");

        /* ───────────── NEW: wallet-first signing flow ───────────── */
        // 1. Create an ephemeral keypair on the backend (secret stays on server)
        const ephemeralPubkeyStr = await createEphemeralKey(projectId);
        if (!ephemeralPubkeyStr) {
          throw new Error("Failed to get ephemeral public key from server");
        }
        if (DEBUG_LOGS) console.log(`🔑 Ephemeral key (server-side): ${ephemeralPubkeyStr}`);

        // 2. Ask backend for a durable nonce we can anchor the final tx to
        let noncePubkey: string;
        let nonceHash: string;
        
        try {
          // First try to get an existing nonce account
          const nonceResult = await projectApi.getNonce(
            projectId,
            wallet.publicKey!.toBase58(),
          );
          noncePubkey = nonceResult.noncePubkey;
          nonceHash = nonceResult.nonceHash;
          
          if (DEBUG_LOGS)
            console.log(
              `⏳ Existing durable nonce found – acct ${noncePubkey}, hash ${nonceHash}`,
            );
        } catch (error: any) {
          /* Backend 404 *or* propagated "NO_NONCE_ACCOUNT"
             ⇒ wallet has no durable‑nonce yet – create one */
          if (
            error?.response?.status === 404 ||
            (error instanceof Error && error.message === 'NO_NONCE_ACCOUNT')
          ) {
            setDeployStage('Creating durable nonce account…');
            if (DEBUG_LOGS) console.log('⏳ No nonce account found, creating one with wallet…');
            
            try {
              const newNoncePk = await walletSigner.createNonce(connection);
              if (DEBUG_LOGS)
                console.log(`✅ Created nonce account ${newNoncePk.toBase58()}`);
              
              // Retry now that we have a nonce account
              const nonceResult = await projectApi.getNonce(
                projectId,
                wallet.publicKey!.toBase58(),
              );
              
              noncePubkey = nonceResult.noncePubkey;
              nonceHash = nonceResult.nonceHash;
              
              if (DEBUG_LOGS)
                console.log(
                  `⏳ Durable nonce acquired – acct ${noncePubkey}, hash ${nonceHash}`,
                );
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
          if (DEBUG_LOGS) console.log(`📦 Using existing program ID from context: ${programId.toBase58()}`);
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
        
        console.log(`[DEBUG] Buffer account sizing:`);
        console.log(`[DEBUG] - Program bytes length: ${programBytes.byteLength}`);
        console.log(`[DEBUG] - Buffer metadata overhead: 37 bytes`);
        console.log(`[DEBUG] - Total buffer space: ${bufferSpace} bytes`);
        console.log(`[DEBUG] - Buffer rent: ${bufferRent} lamports`);
        
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

        console.log("createBufferIx", createBufferIx);
        
        // Initialize buffer with wallet as authority
        const bufferInitIx = new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([0, 0, 0, 0]), // InitializeBuffer tag
        });

        console.log("bufferInitIx", bufferInitIx);
        
        // Set buffer authority to ephemeral key (server will sign writes)
        const setAuthorityIx = new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!,       isSigner: true,  isWritable: false },
            { pubkey: ephemeralPubkey,         isSigner: false, isWritable: false },
          ],
          data: Buffer.from([4, 0, 0, 0]), // SetAuthority tag
        });
        
        // Prepare write instructions for program bytes (ephemeral will be signer)
        const writeInstructions: TransactionInstruction[] = [];
        // Keep each write well under the legacy 1232-byte cap
        const CHUNK = 850;
        
        // Verify program bytes integrity before chunking
        console.log(`[DEBUG] Program bytes integrity check: length=${programBytes.length}, first 4 bytes=[${Array.from(programBytes.slice(0, 4)).join(',')}]`);
        console.log(`[DEBUG] Program bytes last 4 bytes=[${Array.from(programBytes.slice(-4)).join(',')}]`);
        
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
            console.log(`[DEBUG] First chunk ELF magic: [${firstBytes.join(',')}]`);
            
            // Verify ELF magic is correct
            if (firstBytes[0] !== 0x7f || firstBytes[1] !== 0x45 || firstBytes[2] !== 0x4c || firstBytes[3] !== 0x46) {
              console.error(`[CRITICAL] ELF magic is invalid in first chunk! Got [${firstBytes.join(',')}], expected [127,69,76,70]`);
              throw new Error(`Invalid ELF magic in program bytes: [${firstBytes.join(',')}]`);
            }
          }
          if (off + slice.length >= programBytes.length) {
            // Last chunk
            console.log(`[DEBUG] Last chunk ends at offset ${off + slice.length}, final bytes: [${Array.from(slice.slice(-4)).join(',')}]`);
          }
          
          let writeIx: TransactionInstruction;
          try {
            const sliceBuffer = Buffer.from(slice);  // Explicit conversion
            // BPF Loader Write instruction format:
            // [1, 0, 0, 0] + u32(offset) + u64(length) + data
            const writeData = Buffer.concat([
              Buffer.from([1, 0, 0, 0]),  // Write instruction tag
              u32LE(off),                 // offset in buffer  
              u64LE(slice.length),        // length of data (BPF Loader uses u64)
              sliceBuffer,                // actual data bytes
            ]);
            
            // Debug: validate the constructed write data for first chunk
            if (off === 0) {
              const dataOffset = 16; // 4 bytes tag + 4 bytes offset + 8 bytes length
              const dataSection = writeData.slice(dataOffset, dataOffset + 4);
              console.log(`[DEBUG] Write instruction data section (first 4 bytes): [${Array.from(dataSection).join(',')}]`);
              
              if (dataSection[0] !== 0x7f || dataSection[1] !== 0x45 || dataSection[2] !== 0x4c || dataSection[3] !== 0x46) {
                console.error(`[CRITICAL] ELF magic corrupted in write instruction! Got [${Array.from(dataSection).join(',')}]`);
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
            if (DEBUG_LOGS) console.log(`[DEBUG] WriteIx chunk ${off}-${off + slice.length}: ${slice.length} bytes`);
          } catch (e) {
            console.error(`[STEP-WRITE offset=${off}] failed`, e);
            throw e;
          }
          writeInstructions.push(writeIx);
        }
        
        // Validate chunk coverage
        console.log(`[DEBUG] Chunk summary: ${chunkSummary.join(', ')}`);
        console.log(`[DEBUG] Total bytes to write: ${totalBytesWritten}, program length: ${programBytes.length}`);
        if (totalBytesWritten !== programBytes.length) {
          throw new Error(`Chunk coverage mismatch: ${totalBytesWritten} != ${programBytes.length}`);
        }

        console.log("writeInstructions", writeInstructions);
        
        // Create program account
        const createProgramAcct = SystemProgram.createAccount({
          fromPubkey: wallet.publicKey!,
          newAccountPubkey: programId,
          lamports: programRent,
          space: 36,
          programId: BPF_UPGRADE_LOADER_ID,
        });

        console.log("createProgramAcct", createProgramAcct);
        
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

        console.log("deployIx", deployIx);
        
        /* ──────────────────────────────────────────────
           Stage 1 – buffer create & init, then hand authority to ephemeral
        ────────────────────────────────────────────── */
        const initTx = new Transaction()
          .add(createBufferIx)
          .add(bufferInitIx)
          .add(setAuthorityIx);
        await signAndRelayWithWallet(initTx, [bufferAccount]);

        /* ──────────────────────────────────────────────
           Stage 2 – upload bytes in batches (ATOMICALLY)
        ────────────────────────────────────────────── */
        console.log(`[DEBUG] Uploading ${writeInstructions.length} write instructions in atomic batches`);
        
        // Calculate optimal batching - each write instruction is ~900-950 bytes
        // Target ~800 bytes per transaction to leave room for transaction overhead
        const MAX_WRITES_PER_TX = Math.max(1, Math.floor(800 / (CHUNK + 100))); // +100 for instruction overhead
        console.log(`[DEBUG] Batching ${MAX_WRITES_PER_TX} write instructions per transaction`);
        
        for (let i = 0; i < writeInstructions.length; i += MAX_WRITES_PER_TX) {
          const batch = writeInstructions.slice(i, i + MAX_WRITES_PER_TX);
          const tx = new Transaction().add(...batch);
          
          // WRITE txs are server-signed by ephemeral: set feePayer + blockhash here
          tx.feePayer = new PublicKey(ephemeralPubkeyStr);
          await ensureLegacyTxBlockhash(tx, connection);
          
          // size guard pre-send
          const probe = tx.serialize({ requireAllSignatures: false });
          console.log(`[DEBUG] Write batch ${Math.floor(i / MAX_WRITES_PER_TX) + 1}: ${batch.length} instructions, ${probe.length} bytes`);
          
          if (probe.length > 1200) {
            throw new Error(`Tx too large (${probe.length} bytes). Reduce CHUNK or writes/tx.`);
          }
          
          // Relay unsigned for server to sign with ephemeral (no wallet popups)
          const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
          const result = await projectApi.relayTx(projectId, { encodedTx: encoded, programId: programId.toBase58() });
          console.log(`[DEBUG] Write batch ${Math.floor(i / MAX_WRITES_PER_TX) + 1} completed`);
          
          setProgress(p => (p ?? 20) + Math.floor((i + batch.length) / writeInstructions.length * 20));
        }
        
        console.log(`[DEBUG] All ${writeInstructions.length} write instructions completed. Buffer should now contain complete program.`);
        
        // VERIFY BUFFER DATA BEFORE DEPLOYMENT
        try {
          console.log(`[DEBUG] Verifying buffer account data integrity...`);
          const bufferAccountInfo = await connection.getAccountInfo(bufferAccount.publicKey);
          if (!bufferAccountInfo?.data) {
            throw new Error("Buffer account has no data after write operations");
          }
          
          console.log(`[DEBUG] Buffer account data length: ${bufferAccountInfo.data.length} bytes`);
          console.log(`[DEBUG] Expected program size: ${programBytes.length} bytes (+ 37 byte metadata)`);
          
          // The buffer account data format is: 37 bytes of metadata + program bytes
          const bufferProgramData = bufferAccountInfo.data.subarray(37);
          console.log(`[DEBUG] Extracted program data length: ${bufferProgramData.length} bytes`);
          
          // Check ELF magic in buffer
          if (bufferProgramData.length >= 4) {
            const bufferElfMagic = Array.from(bufferProgramData.subarray(0, 4));
            console.log(`[DEBUG] Buffer ELF magic: [${bufferElfMagic.join(',')}]`);
            
            if (bufferElfMagic[0] !== 0x7f || bufferElfMagic[1] !== 0x45 || bufferElfMagic[2] !== 0x4c || bufferElfMagic[3] !== 0x46) {
              console.error(`[CRITICAL] Buffer contains corrupted ELF data! Got [${bufferElfMagic.join(',')}], expected [127,69,76,70]`);
              throw new Error(`Buffer corruption detected: Invalid ELF magic [${bufferElfMagic.join(',')}]`);
            } else {
              console.log(`[DEBUG] ✅ Buffer ELF magic is valid`);
            }
          }
          
          // Compare first and last few bytes
          const originalFirst = Array.from(programBytes.slice(0, 8));
          const bufferFirst = Array.from(bufferProgramData.subarray(0, 8));
          const originalLast = Array.from(programBytes.slice(-8));
          const bufferLast = Array.from(bufferProgramData.subarray(-8));
          
          console.log(`[DEBUG] Original first 8 bytes: [${originalFirst.join(',')}]`);
          console.log(`[DEBUG] Buffer first 8 bytes:   [${bufferFirst.join(',')}]`);
          console.log(`[DEBUG] Original last 8 bytes:  [${originalLast.join(',')}]`);
          console.log(`[DEBUG] Buffer last 8 bytes:    [${bufferLast.join(',')}]`);
          
          if (JSON.stringify(originalFirst) !== JSON.stringify(bufferFirst)) {
            console.error(`[CRITICAL] Buffer data corruption detected at start!`);
            throw new Error(`Buffer corruption: First bytes mismatch`);
          }
          
          if (JSON.stringify(originalLast) !== JSON.stringify(bufferLast)) {
            console.error(`[CRITICAL] Buffer data corruption detected at end!`);
            throw new Error(`Buffer corruption: Last bytes mismatch`);
          }
          
          console.log(`[DEBUG] ✅ Buffer data verification passed - proceeding with deployment`);
        } catch (verificationError) {
          console.error(`[CRITICAL] Buffer verification failed:`, verificationError);
          throw verificationError;
        }

        /* ──────────────────────────────────────────────
           Stage 3 – program account + deploy
        ────────────────────────────────────────────── */
        const advanceIx = SystemProgram.nonceAdvance({
          noncePubkey: new PublicKey(noncePubkey),
          authorizedPubkey: wallet.publicKey!,
        });

        const deployTx = new Transaction()
          .add(advanceIx)            /* must be FIRST for durable nonce   */
          .add(createProgramAcct)
          .add(deployIx);

        console.log("deployTx", deployTx);

        // Recent block-hash & fee-payer
        /* Use the durable nonce instead of a recent block‑hash */
        deployTx.recentBlockhash = nonceHash;
        deployTx.feePayer = wallet.publicKey!;

        /* Size guard – keep below ~1232 B ceiling */
        if (deployTx.serialize({ requireAllSignatures: false }).length > 1220) {
          throw new Error("Finalise tx unexpectedly large; investigate batching");
        }

        /* Helpers */
        async function signAndRelayWithWallet(tx: Transaction, extras: Keypair[]) {
          console.log(`[DEBUG] signAndRelayWithWallet called with ${extras.length} extra signers`);
          
          // Set fee payer and blockhash BEFORE compiling message
          tx.feePayer = wallet.publicKey!;
          await ensureLegacyTxBlockhash(tx, connection);
          
          // Force recompile to ensure fee payer is properly set
          tx.compileMessage();
          
          // Debug: log transaction details before signing
          const msg = tx.compileMessage();
          console.log(`[DEBUG] Transaction requires ${msg.header.numRequiredSignatures} signatures`);
          console.log(`[DEBUG] Required signers:`, msg.accountKeys.slice(0, msg.header.numRequiredSignatures).map(k => k.toBase58()));
          console.log(`[DEBUG] Extra signers provided:`, extras.map(k => k.publicKey.toBase58()));
          console.log(`[DEBUG] Wallet public key:`, wallet.publicKey!.toBase58());
          console.log(`[DEBUG] Fee payer:`, tx.feePayer?.toBase58());
          
          // Verify wallet is first signer
          const walletIsFirstSigner = msg.accountKeys[0].equals(wallet.publicKey!);
          console.log(`[DEBUG] Wallet is first signer:`, walletIsFirstSigner);
          if (!walletIsFirstSigner) {
            console.error(`[DEBUG] ERROR: Wallet should be first signer but isn't!`);
            console.error(`[DEBUG] Expected:`, wallet.publicKey!.toBase58());
            console.error(`[DEBUG] Actual first signer:`, msg.accountKeys[0].toBase58());
          }
          
          // Initialize signatures array properly first
          const signers = [wallet.publicKey!, ...extras.map(k => k.publicKey)];
          console.log(`[DEBUG] All signers that need to sign:`, signers.map(s => s.toBase58()));
          
          // Clean signing approach: sign with wallet first on clean transaction
          console.log(`[DEBUG] Clean signing approach: wallet first on clean transaction`);
          
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
          
          console.log(`[DEBUG] Created clean transaction with ${cleanTx.instructions.length} instructions`);
          
          // Debug transaction before wallet signing
          console.log(`[DEBUG] Transaction before wallet signing:`);
          console.log(`[DEBUG] - Instructions: ${cleanTx.instructions.length}`);
          console.log(`[DEBUG] - Fee payer: ${cleanTx.feePayer?.toBase58()}`);
          console.log(`[DEBUG] - Recent blockhash: ${cleanTx.recentBlockhash}`);
          console.log(`[DEBUG] - Signatures length: ${cleanTx.signatures.length}`);
          
          // Try wallet signing with error handling
          try {
            console.log(`[DEBUG] About to call wallet.signTransaction...`);
            const signedTx = await wallet.signTransaction!(cleanTx);
            console.log(`[DEBUG] Wallet.signTransaction returned successfully`);
            console.log(`[DEBUG] Returned tx === original tx:`, signedTx === cleanTx);
            console.log(`[DEBUG] Returned tx signatures length:`, signedTx.signatures.length);
            
            // Always use the returned transaction as it might be a new instance
            if (signedTx !== cleanTx) {
              console.log(`[DEBUG] Wallet returned a different transaction object, replacing cleanTx`);
              // Replace the entire transaction
              Object.assign(cleanTx, {
                signatures: signedTx.signatures,
                feePayer: signedTx.feePayer,
                recentBlockhash: signedTx.recentBlockhash,
                lastValidBlockHeight: signedTx.lastValidBlockHeight,
                instructions: signedTx.instructions
              });
            } else {
              console.log(`[DEBUG] Wallet modified the original transaction in-place`);
            }
          } catch (error) {
            console.error(`[DEBUG] Wallet signing failed:`, error);
            throw error;
          }
          
          console.log(`[DEBUG] Wallet signed clean transaction`);
          
          // Check wallet signature was applied
          let walletSigCount = cleanTx.signatures.filter(s => s.signature).length;
          console.log(`[DEBUG] After wallet signature on clean tx: ${walletSigCount} signatures`);
          
          // Debug each signature slot
          cleanTx.signatures.forEach((sig, idx) => {
            console.log(`[DEBUG] Signature slot ${idx}: ${sig.publicKey.toBase58()} = ${sig.signature ? 'PRESENT' : 'MISSING'}`);
          });
          
          // Then apply extra signatures
          if (extras && extras.length > 0) {
            console.log(`[DEBUG] Applying ${extras.length} extra signatures to clean transaction...`);
            cleanTx.partialSign(...extras);
            console.log(`[DEBUG] Applied ${extras.length} extra signatures to clean transaction`);
          }
          
          // Use the clean transaction for the rest of the process
          tx = cleanTx;
          
          // Recompile message for the clean transaction
          const finalMsg = tx.compileMessage();
          
          // Final signature count check
          let currentSigs = tx.signatures.filter(s => s.signature).length;
          console.log(`[DEBUG] Final signature count: ${currentSigs}/${finalMsg.header.numRequiredSignatures} signatures`);
          
          // Debug: show which signatures we have
          for (let i = 0; i < finalMsg.header.numRequiredSignatures; i++) {
            const signer = finalMsg.accountKeys[i].toBase58();
            const hasSig = tx.signatures[i]?.signature ? 'YES' : 'NO';
            console.log(`[DEBUG] Signature ${i}: ${signer} = ${hasSig}`);
          }
          
          // Handle missing signatures - if only wallet signature is missing, try server handling
          if (currentSigs < finalMsg.header.numRequiredSignatures) {
            const missingSigs = [];
            for (let i = 0; i < finalMsg.header.numRequiredSignatures; i++) {
              if (!tx.signatures[i]?.signature) {
                missingSigs.push(finalMsg.accountKeys[i].toBase58());
              }
            }
            
            console.error(`[DEBUG] Transaction is missing signatures for: ${missingSigs.join(', ')}`);
            
            // If only the wallet signature is missing and it's the first signer, try server approach
            if (missingSigs.length === 1 && missingSigs[0] === wallet.publicKey!.toBase58()) {
              console.log(`[DEBUG] Only wallet signature missing, attempting server-side handling...`);
              
              // Send partially signed transaction to server and let it handle wallet signature request
              const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
              console.log(`[DEBUG] Sending partially signed transaction to relay-signed-tx endpoint`);
              
              try {
                const result = await projectApi.relaySignedTx(
                  projectId,
                  encoded,
                  programId.toBase58()
                );
                
                if ('signature' in result) {
                  console.log(`[DEBUG] Server-side relay successful with signature: ${result.signature}`);
                  return; // Success, exit the function
                } else if (result.code === 'WALLET_SIGNATURE_REQUIRED') {
                  console.log(`[DEBUG] Server requests wallet signature, handling 409 response`);
                  // Let this fall through to the normal 409 handling below
                  throw new Error(`Server requests wallet signature: ${result.missing?.join(', ')}`);
                } else {
                  console.error(`[DEBUG] Unexpected server response:`, result);
                  throw new Error('Unexpected response from server');
                }
              } catch (error) {
                console.error(`[DEBUG] Server-side relay failed, falling back to error:`, error);
                // Fall through to the original error
              }
            }
            
            throw new Error(`Transaction is missing ${finalMsg.header.numRequiredSignatures - currentSigs} signatures: ${missingSigs.join(', ')}`);
          }
          
          const encoded = tx.serialize({ requireAllSignatures: true }).toString("base64");
          console.log(`[DEBUG] Sending fully signed transaction to relay-signed-tx endpoint`);
          
          try {
            const result = await projectApi.relaySignedTx(
              projectId,
              encoded,
              programId.toBase58()
            );
            
            if ('signature' in result) {
              console.log(`[DEBUG] Relay successful with signature: ${result.signature}`);
            } else if (result.code === 'WALLET_SIGNATURE_REQUIRED') {
              console.error(`[DEBUG] Server still needs wallet signature. Missing:`, result.missing);
              throw new Error(`Server requests wallet signature for: ${result.missing?.join(', ')}`);
            } else {
              console.error(`[DEBUG] Unexpected relay response:`, result);
              throw new Error('Unexpected response from relay signed transaction');
            }
          } catch (error) {
            console.error(`[DEBUG] Relay failed:`, error);
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
          console.log('[DEBUG] Wallet returned a different transaction object, replacing deployTx');
          Object.assign(deployTx, signedTx);  // Update deployTx with signed version
        }
        
        console.log('[DEBUG] Deployment transaction signed by wallet');
        console.log('[DEBUG] Deploy tx signers required:', deployTx.compileMessage().accountKeys.slice(0, deployTx.compileMessage().header.numRequiredSignatures).map(k => k.toBase58()));
        
        // Verify wallet signature is present
        const walletSigPresent = deployTx.signatures.find(sig => 
          sig.publicKey?.toBase58() === wallet.publicKey!.toBase58() && sig.signature
        );
        console.log('[DEBUG] Wallet signature present:', walletSigPresent ? '✅ YES' : '❌ NO');
        
        // Check if we need to sign with the program keypair on the client side
        // When using existing program ID, the real keypair is on the backend
        if (!existingProgramId) {
          // Only sign with program keypair if we generated a new one (fallback case)
          deployTx.partialSign(programKeypair);
          console.log('[DEBUG] Program keypair signed deployment transaction (new program)');
        } else {
          // For existing program ID, the backend will handle program keypair signing
          console.log('[DEBUG] Skipping client-side program keypair signing - backend will handle it');
        }
        
        // 5. Send the partially-signed transaction to backend for co-signing and broadcast
        setDeployStage('Sending to server for co-signing...');
        setProgress(60);
        const encodedTx = deployTx.serialize({ requireAllSignatures: false }).toString('base64');

        console.log("encodedTx", encodedTx);
        
        // Debug: Show current signature status before sending to backend
        if (DEBUG_LOGS) {
          const currentSigs = deployTx.signatures.filter(s => s.signature).length;
          const requiredSigs = deployTx.compileMessage().header.numRequiredSignatures;
          console.log(`[DEBUG] Transaction signature status: ${currentSigs}/${requiredSigs} signatures`);
          
          for (let i = 0; i < deployTx.signatures.length; i++) {
            const sig = deployTx.signatures[i];
            const status = sig.signature ? '✅ SIGNED' : '❌ MISSING';
            console.log(`[DEBUG] Signature ${i}: ${sig.publicKey?.toBase58()} ${status}`);
          }
        }
        
        console.log('[DEBUG] Sending deploy transaction to server for ephemeral key signing');
        console.log('[DEBUG] Ephemeral key that should sign:', ephemeralPubkeyStr);
        console.log('[DEBUG] Expected program ID for backend signing:', programId.toBase58());
        
        try {
          const firstRelay = await projectApi.relaySignedTx(
            projectId,
            encodedTx,
            programId.toBase58(),
            undefined,                 // taskId is now optional but still expected by type
            [ephemeralPubkeyStr]       // tell server which ephemeral key must co-sign
          );

          let finalSig: string | undefined;
          if ('signature' in firstRelay) {
            finalSig = firstRelay.signature;
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
              await ensureLegacyTxBlockhash(tx, connection);
              tx.feePayer = wallet.publicKey!;
            }
            const signed = await wallet.signTransaction(tx as any);
            const secondRelay = await projectApi.relaySignedTx(
              projectId,
              signed.serialize({ requireAllSignatures: false }).toString('base64'),
              programId.toBase58()
            );
            if ('signature' in secondRelay) {
              finalSig = secondRelay.signature;
            } else {
              throw new Error(`Still missing signatures: ${secondRelay.missing?.join(', ')}`);
            }
          } else {
            throw new Error('Unexpected relay response');
          }
          
          if (DEBUG_LOGS) console.log(`✅ Transaction confirmed with signature: ${finalSig}`);
          setDeployStage('Transaction confirmed!');
          setProgress(90);
          
          if (DEBUG_LOGS) {
            console.log(`✅ Deployment completed successfully!`);
            console.log(`✅ Program ID: ${programId.toBase58()}`);
            console.log(`✅ Transaction signature: ${finalSig}`);
            console.log(`✅ Calling onSuccess with programId: ${programId.toBase58()}`);
          }
          
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
      <DialogContent className="bg-[#121214] border-[#2a2a2d] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">
            Deploy Program to Devnet
          </DialogTitle>
          <DialogDescription className="text-[#6e6e76]">
            Your program will be deployed using your connected wallet. Make sure
            you have enough SOL for the transaction fees.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {bytesLoaded ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6e6e76]">
                  Program size:
                </span>
                <span className="text-sm font-mono">
                  {byteLength.toLocaleString()} bytes
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6e6e76]">
                  Wallet:
                </span>
                <span className="text-sm font-mono truncate max-w-[200px]">
                  {wallet.publicKey ? wallet.publicKey.toBase58() : "Not connected"}
                </span>
              </div>

              {!wallet.publicKey && (
                <div className="bg-[#2a2a2d] p-4 rounded-md flex items-start space-x-2 mt-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Wallet not connected
                    </p>
                    <p className="text-xs text-[#6e6e76]">
                      Please connect your wallet to deploy the program.
                    </p>
                  </div>
                </div>
              )}

              {progress !== null && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6e6e76]">
                      {deployStage || "Preparing…"}
                    </span>
                    <span className="text-sm text-[#6e6e76]">{progress}%</span>
                  </div>
                  <Progress value={progress} aria-label="deployment progress" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20">
              <div className="animate-pulse text-[#6e6e76]">
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
            className="w-full sm:w-auto bg-transparent border-[#2a2a2d] text-white hover:bg-[#2a2a2d]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDeploy}
            disabled={isLoading || !bytesLoaded}
            className="w-full sm:w-auto bg-[#22c55e] hover:bg-[#22c55e]/90 text-white flex items-center"
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
