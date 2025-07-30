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

import { createAndRegisterEphemeral } from "@/utils/ephemeral/ephemeralKey";
import { BPF_LOADER_CHUNK_SIZE } from "@/utils/constants";
import { deployWithEphemeralKey, EphemeralDeployOptions } from "@/lib/ephemeralDeployment";

// Toggle verbose client-side logs by setting NEXT_PUBLIC_DEBUG_LOGS=true in your
// environment.  This reduces noisy console output in production.
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

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
          soBytes: programBytes as unknown as ArrayBuffer,
          connection: connection as any,
          wallet: wallet as any,
          ephemeralKeypair: authorityEphem as any,
              programId: candidatePk,
          verifyTimeoutMs: 120_000,
          relayToBackend: true,                 // NEW – keep secret on server
          onProgress: (raw: number, message: string) => {
            const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            setProgress(Math.max(1, Math.min(pct, 100)));
            setDeployStage(message ?? "");
            if (DEBUG_LOGS) console.log("[DEPLOY]", pct + "%", message);
          },
        };

            const deployResult = await deployWithEphemeralKey(deployOptions);
            if (deployResult.success) onSuccess(candidatePk.toBase58());

            if (deployResult.warning) toast.warning(deployResult.warning);

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

        /* ───────────── NEW: fresh deploy handled on server ───────────── */
        // 1. Request an ephemeral keypair from the backend
        const ephemPubkeyStr = await createAndRegisterEphemeral(projectId);
        const ephemeralPubkey = new PublicKey(ephemPubkeyStr);
        if (DEBUG_LOGS) console.log(`🔑 Ephemeral key (server-generated): ${ephemeralPubkey.toBase58()}`);

        // 2. Fund the ephemeral account from the wallet (if needed)
        const bufferSpace = 37 + programBytes.byteLength;
        const bufferRent = await connection.getMinimumBalanceForRentExemption(bufferSpace);
        const programDataRent = await connection.getMinimumBalanceForRentExemption(36);
        const chunkCount = Math.ceil(programBytes.byteLength / BPF_LOADER_CHUNK_SIZE);
        const feeEstimate = (chunkCount + 2) * 10000; // create-buffer + deploy + chunk TXs
        const marginLamports = 0.02 * LAMPORTS_PER_SOL;
        const lamportsNeeded = BigInt(bufferRent) + BigInt(programDataRent) + BigInt(feeEstimate) + BigInt(marginLamports);
        const existingBalance = await connection.getBalance(ephemeralPubkey);
        if (BigInt(existingBalance) < lamportsNeeded) {
          const additional = lamportsNeeded - BigInt(existingBalance);
          if (DEBUG_LOGS) console.log(`Ephemeral account needs ${Number(additional) / LAMPORTS_PER_SOL} SOL; funding from wallet...`);
          const fundIx = SystemProgram.transfer({
            fromPubkey: wallet.publicKey!,
            toPubkey: ephemeralPubkey,
            lamports: Number(additional),
          });
          const fundTx = new Transaction().add(fundIx);

          /* ------------------------------------------------------------ *
           * Let Phantom sign **and** broadcast the single‑instruction
           * transfer.  Because the TX contains nothing else, Phantom's
           * internal simulation will succeed and the red banner vanishes.
           * ------------------------------------------------------------ */
          const { blockhash } = await connection.getLatestBlockhash(
            "confirmed"
          );
          fundTx.recentBlockhash = blockhash;
          fundTx.feePayer = wallet.publicKey!;

          const fundSig = await wallet.sendTransaction(fundTx, connection, {
            preflightCommitment: "confirmed",
          });

          await connection.confirmTransaction(fundSig, "confirmed");

          console.log(
            `✅ Funded ephemeral key with ${
              Number(additional) / LAMPORTS_PER_SOL
            } SOL (tx: ${fundSig})`
          );
        } else {
          if (DEBUG_LOGS) console.log('Ephemeral account already sufficiently funded.');
        }

        // 3. Trigger the backend deployment process
        setDeployStage('Deploying program on backend…');
        const { success } = await projectApi.deployProject(
          projectId,
          wallet.publicKey!.toBase58(),
          ephemeralPubkey.toBase58()
        );
        if (!success) throw new Error('Server deploy failed');

        // 4. Poll for program ID
        while (true) {
          const { programId } = await projectApi.getProgramId(projectId);
          if (programId) { 
            onSuccess(programId); 
            break; 
          }
          await new Promise(r => setTimeout(r, 3000));
        }

        toast.success('Program deployed', {
          description: `Program ID obtained from server`,
          action: {
            label: 'Explorer',
            onClick: (programId) =>
              window.open(
                `https://explorer.solana.com/address/${programId}?cluster=devnet`,
                '_blank'
              ),
          },
        });
        onClose();
        return;
      } catch (err: any) {
        console.error(err);
        toast.error("Deployment failed", { description: err.message });
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
