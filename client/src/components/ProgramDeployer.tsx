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
  Transaction,
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

import { createEphemeralKey, EphemeralDeployOptions, deployWithEphemeralKey } from "@/api/projectDeploy";
import { BPF_LOADER_CHUNK_SIZE } from "@/utils/constants";

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

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  try {
    b.writeBigUInt64LE(n, 0);
  } catch (e) {
    console.error('[u64LE] failed – value', n.toString(), 'buffer len', b.length, e);
    throw e;
  }
  return b;
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
          new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
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
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
        });

        console.log("createBufferIx", createBufferIx);
        
        // Initialize buffer with wallet as authority
        const bufferInitIx = new TransactionInstruction({
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!, isSigner: true, isWritable: false },
          ],
          data: Buffer.from([0, 0, 0, 0]), // InitializeBuffer tag
        });

        console.log("bufferInitIx", bufferInitIx);
        
        // Set buffer authority to ephemeral key
        const setAuthorityIx = new TransactionInstruction({
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
          keys: [
            { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey!, isSigner: true, isWritable: false },
            { pubkey: ephemeralPubkey, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([4, 0, 0, 0]), // SetAuthority tag
        });

        console.log("setAuthorityIx", setAuthorityIx);
        
        // Prepare write instructions for program bytes
        const writeInstructions: TransactionInstruction[] = [];
        const CHUNK = 900;
        for (let off = 0; off < programBytes.length; off += CHUNK) {
          const slice = programBytes.slice(off, off + CHUNK);
          let writeIx: TransactionInstruction;
          try {
            writeIx = new TransactionInstruction({
              programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111'),
              keys: [
                { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
                { pubkey: ephemeralPubkey,        isSigner: true,  isWritable: false },
              ],
              data: Buffer.concat([
                Buffer.from([1, 0, 0, 0]),  // Write tag
                u32LE(off),
                u64LE(BigInt(slice.length)),
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
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
        });

        console.log("createProgramAcct", createProgramAcct);
        
        // Deploy instruction
        let deployIx: TransactionInstruction;
        try {
          deployIx = new TransactionInstruction({
            programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
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
              u64LE(BigInt(programBytes.length)),
            ]),
          });
        } catch (e) {
          console.error('[STEP-DEPLOY] failed', e);
          throw e;
        }

        console.log("deployIx", deployIx);
        
        // Build FULL transaction *before* any signature is added
        const deployTx = new Transaction()
          .add(createBufferIx)
          .add(bufferInitIx)
          .add(setAuthorityIx)
          // all write-chunk instructions
          .add(...writeInstructions)
          // program account + deploy instruction
          .add(createProgramAcct)
          .add(deployIx);

        console.log("deployTx", deployTx);

        // Recent block-hash & fee-payer
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        deployTx.recentBlockhash = blockhash;
        deployTx.feePayer = wallet.publicKey!;

        /* ---------- OPTIONAL size-guard ---------- */
        if (deployTx.serialize({ requireAllSignatures: false }).length > 1200) {
          throw new Error("Transaction too large; split writes into separate TXs");
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
          const { signature } = await projectApi.relaySignedTx(
            projectId,
            encodedTx,
            programId.toBase58(),
            undefined                   // taskId is now optional but still expected by type
          );
          
          if (DEBUG_LOGS) console.log(`✅ Transaction confirmed with signature: ${signature}`);
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
