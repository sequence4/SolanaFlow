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
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

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
      // @ts-ignore
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

      try {
        if (!programBytes) {
          toast.error("Program bytes missing");
          return;
        }

        const ctxProgramId = projectContext?.details?.projectState?.programId;
        const looksLikePubkey =
          ctxProgramId && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ctxProgramId);

        if (looksLikePubkey) {
          const candidatePk = new PublicKey(ctxProgramId!);
          const acctInfo = await connection.getAccountInfo(candidatePk, "confirmed");

          if (acctInfo) {
            /* UPGRADE path (unchanged) */
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

        // 3. Generate a new program keypair
        const programKeypair = Keypair.generate();
        const programId = programKeypair.publicKey;
        if (DEBUG_LOGS) console.log(`📦 Generated new program ID: ${programId.toBase58()}`);

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
        for (let off = 0; off < programBytes.length; off += CHUNK) {
          const slice = programBytes.slice(off, off + CHUNK);
          let writeIx: TransactionInstruction;
          try {
            writeIx = new TransactionInstruction({
              programId: BPF_UPGRADE_LOADER_ID,
              keys: [
                { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
                // Ephemeral (server-held) is buffer authority during writes
                { pubkey: ephemeralPubkey,          isSigner: true,  isWritable: false },
              ],
              data: Buffer.concat([
                Buffer.from([1, 0, 0, 0]),  // Write tag
                u32LE(off),
                u64LE(slice.length),
                Buffer.from(slice),         // ensure Buffer, not Uint8Array
              ]),
            });
            console.log("writeIx", writeIx);
          } catch (e) {
            console.error(`[STEP-WRITE offset=${off}] failed`, e);
            throw e;
          }
          writeInstructions.push(writeIx);
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
              { pubkey: programId, isSigner: false, isWritable: true },
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
           Stage 2 – upload bytes in batches
        ────────────────────────────────────────────── */
        const MAX_WRITES_PER_TX = 1;           // keep each tx well under the 1,232B cap
        for (let i = 0; i < writeInstructions.length; i += MAX_WRITES_PER_TX) {
          const tx = new Transaction().add(...writeInstructions.slice(i, i + MAX_WRITES_PER_TX));
          // WRITE txs are server-signed by ephemeral: set feePayer + blockhash here
          tx.feePayer = new PublicKey(ephemeralPubkeyStr);
          await ensureLegacyTxBlockhash(tx, connection);
          // size guard pre-send
          const probe = tx.serialize({ requireAllSignatures: false });
          if (probe.length > 1200) {
            throw new Error(`Tx too large (${probe.length} bytes). Reduce CHUNK or writes/tx.`);
          }
          // Relay unsigned for server to sign with ephemeral (no wallet popups)
          // Server relay without wallet signature
          {
            const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
            await projectApi.relayTx(projectId, { encodedTx: encoded, programId: programId.toBase58() });
          }
          setProgress(p => (p ?? 20) + 1);     // cheap visual feedback
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
          tx.feePayer = wallet.publicKey!;
          await ensureLegacyTxBlockhash(tx, connection);
          await wallet.signTransaction!(tx);
          if (extras && extras.length) {
            tx.partialSign(...extras);
          }
          const encoded = tx.serialize({ requireAllSignatures: false }).toString("base64");
          await projectApi.relayTx(projectId, { encodedTx: encoded, programId: programId.toBase58() });
        }

        // Wallet signs AFTER every instruction is already present
        setDeployStage('Awaiting wallet signature…');
        setProgress(40);
        if (!wallet.signTransaction) throw new Error("Wallet can't sign");
        await wallet.signTransaction(deployTx);
        
        // Program keypair and buffer account sign
        deployTx.partialSign(bufferAccount);
        deployTx.partialSign(programKeypair);
        
        // 5. Send the partially-signed transaction to backend for co-signing and broadcast
        setDeployStage('Sending to server for co-signing...');
        setProgress(60);
        const encodedTx = deployTx.serialize({ requireAllSignatures: false }).toString('base64');

        console.log("encodedTx", encodedTx);
        
        try {
          const firstRelay = await projectApi.relaySignedTx(
            projectId,
            encodedTx,
            programId.toBase58(),
            undefined,                 // taskId is now optional but still expected by type
            [ephemeralPubkeyStr]       // tell server which key it must co-sign
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
                'Ask the backend to set feePayer = wallet before returning 409.'
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
