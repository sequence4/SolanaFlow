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
  deployWithEphemeralKey,
  EphemeralDeployOptions,
} from "@/lib/ephemeralDeployment";
import { PublicKey, Keypair } from "@solana/web3.js";
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
    console.log("🔍 Fetching compiled program…");

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
        console.log(
          "[DEPLOY] Valid ELF magic verified:",
          Array.from(bytes.slice(0, 4))
        );
      }

      setProgramBytes(bytes);
      setByteLength(bytes.byteLength);
      setBytesLoaded(true);

      console.log(`✅ Program fetched: ${bytes.byteLength.toLocaleString()} bytes`);
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

        const authorityEphem = Keypair.generate();
        console.log(
          "🔑 Ephemeral authority key:",
          authorityEphem.publicKey.toBase58()
        );

        const deterministicId = existingProgramId;
        if (!deterministicId) {
          throw new Error("Deterministic program ID missing in project context");
        }
        const programIdPubkey = new PublicKey(deterministicId);
        console.log("🆔 Using deterministic program ID:", programIdPubkey.toBase58());

        const deployOptions: EphemeralDeployOptions = {
          soBytes: programBytes as unknown as ArrayBuffer,
          connection: connection as any,
          wallet: wallet as any,
          ephemeralKeypair: authorityEphem as any,
          programId: programIdPubkey,
          verifyTimeoutMs: 120_000,
          onProgress: (raw: number, message: string) => {
            const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            setProgress(Math.max(1, Math.min(pct, 100)));
            setDeployStage(message ?? "");
            console.log("[DEPLOY]", pct + "%", message);
          },
        };

        // upgrade path (same program ID)
        const projProgId = projectContext?.details?.projectState?.programId;
        if (projProgId && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(projProgId)) {
          deployOptions.programId = new PublicKey(projProgId);
          console.log(
            "[ProgramDeployer] Using existing program ID for upgrade:",
            projProgId
          );
        }

        const deployResult = await deployWithEphemeralKey(deployOptions);

        if (deployResult.success) {
          if (deployResult.warning) toast.warning(deployResult.warning);
          try {
            await projectApi.updateProject(projectId, {
              details: { projectState: { programId: programIdPubkey.toBase58() } },
            });
          } catch (updateErr) {
            console.error("Failed to update project with program ID:", updateErr);
          }
          onSuccess(programIdPubkey.toBase58());
        }

        toast.success("Program deployed successfully", {
          description: `Program ID: ${programIdPubkey.toBase58()}`,
          action: {
            label: "Explorer",
            onClick: () =>
              window.open(
                `https://explorer.solana.com/address/${programIdPubkey.toBase58()}?cluster=devnet`,
                "_blank"
              ),
          },
        });

        onClose();
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
      existingProgramId,
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
            you have enough SOL for the transaction fees.
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
                  {byteLength.toLocaleString()} bytes
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
            disabled={isLoading || !bytesLoaded || !existingProgramId}
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
