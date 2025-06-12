import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { downloadArtifact } from '@/api/projectArtifact';
import { Button } from '@/components/ui/button';
import { Rocket, AlertTriangle } from 'lucide-react';
import { createAndRegisterEphemeral } from '@/utils/ephemeral/ephemeralKey';
import { deployWithEphemeralKey } from '@/lib/ephemeralDeployment';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
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
  const [isLoading, setIsLoading] = useState(false);
  const [bytesLoaded, setBytesLoaded] = useState(false);
  const [programBytes, setProgramBytes] = useState<ArrayBuffer | null>(null);
  const [byteLength, setByteLength] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [deployStage, setDeployStage] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  // ────────────────────────────────────────────────────────────────
  //  Guards that survive React 18 Strict-Mode double-mounts
  // ────────────────────────────────────────────────────────────────
  const backendStartedRef = useRef(false);   // true ⇢ deploy already scheduled for this dialog open
  const backendRunningRef = useRef(false);   // true ⇢ promise currently inflight, ignore any more clicks

  // Load the program bytes when the modal opens
  useEffect(() => {
    if (isOpen && !bytesLoaded && !isLoading) {
      loadProgramBytes();
    }
  }, [isOpen, bytesLoaded, isLoading]);

  const loadProgramBytes = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    console.log("🔍 Fetching compiled program...");
    
    try {
      const bytes = await downloadArtifact(projectId);
      setProgramBytes(bytes);
      setByteLength(bytes.byteLength);
      setBytesLoaded(true);
      console.log(`✅ Program fetched: ${bytes.byteLength.toLocaleString()} bytes`);
    } catch (error) {
      console.error("Failed to load program bytes:", error);
      toast.error("Failed to load program", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ *
   *  Deploy with ephemeral key
   * ------------------------------------------------------------------ */
  const handleDeploy = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();                 // blocks hidden form submit

      /* Strict-Mode & double-click guards */
      if (backendRunningRef.current) return;   // re-entrancy
      if (backendStartedRef.current) return;   // dev re-mount
      backendRunningRef.current = true;
      backendStartedRef.current = true;

      if (isLoading) return;                  
      setIsLoading(true);
      setProgress(0);                   // show bar, starts at 0 %
      console.log('🚀 Starting deployment…');

      // 🖌️  let React flush this paint BEFORE the wallet popup blocks the thread
      await new Promise(r => setTimeout(r, 0));

      try {
        // 1. create key & tell backend
        const ephem = await createAndRegisterEphemeral(projectId);
        console.log(`🔑 Ephemeral key: ${ephem.publicKey.toBase58()}`);

        // 2. run the local-wallet deploy signer that **pays fees**
        const deployResult = await deployWithEphemeralKey({
          soBytes: programBytes!,
          connection,
          wallet,
          /** explicit generic helps TS infer correct overload */
          ephemeralKeypair: ephem,
          onProgress: (raw, message) => {
            /**
             * The library emits either:
             *   • a fraction 0-1  ➜ multiply by 100
             *   • or an integer   ➜ already a %
             */
            const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);

            // keep at least 1 % so the bar is visible during very small uploads
            setProgress(Math.max(1, Math.min(pct, 100)));
            setDeployStage(message ?? '');
            console.log('[DEPLOY]', pct + '%', message);
          }
        });

        if (deployResult.success) {
          onSuccess(deployResult.programId.toBase58());
        }
        
        /* 5 – success UX */
        toast.success('Program deployed with ephemeral key', {
          description: `Program ID: ${deployResult.programId.toBase58()}`,
          action: {
            label: 'Explorer',
            onClick: () =>
              window.open(
                `https://explorer.solana.com/address/${deployResult.programId.toBase58()}?cluster=devnet`,
                '_blank',
              ),
          },
        });

        onSuccess(deployResult.programId.toBase58());
        onClose();
      } catch (err: any) {
        console.error(err);
        toast.error('Deployment failed', { description: err.message });
      } finally {
        setIsLoading(false);           // re-enable UI
        setProgress(null);             // hide bar fully

        backendRunningRef.current = false;
        backendStartedRef.current = false;  // dialog can deploy again if reopened
      }
    }, [isLoading, projectId, programBytes, connection, wallet, onSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="bg-[#121214] border-[#2a2a2d] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">
            Deploy Program to Devnet
          </DialogTitle>
          <DialogDescription className="text-[#6e6e76]">
            Your program will be deployed using your connected wallet. 
            Make sure you have enough SOL for the transaction fees.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {bytesLoaded ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6e6e76]">Program size:</span>
                <span className="text-sm font-mono">{byteLength.toLocaleString()} bytes</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6e6e76]">Wallet:</span>
                <span className="text-sm font-mono truncate max-w-[200px]">
                  {wallet.publicKey ? wallet.publicKey.toBase58() : 'Not connected'}
                </span>
              </div>
              
              {!wallet.publicKey && (
                <div className="bg-[#2a2a2d] p-4 rounded-md flex items-start space-x-2 mt-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">Wallet not connected</p>
                    <p className="text-xs text-[#6e6e76]">
                      Please connect your wallet to deploy the program.
                    </p>
                  </div>
                </div>
              )}
              
              {isLoading && progress !== null && (
                <div className="space-y-2 mt-4">
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6e6e76]">
                        {deployStage || 'Preparing...'}
                      </span>
                      <span className="text-sm text-[#6e6e76]">{progress}%</span>
                    </div>
                    <Progress value={progress} aria-label="deployment progress" />
                  </>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20">
              <div className="animate-pulse text-[#6e6e76]">
                Loading program data...
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
            type="button"                      /* stops implicit form submit */
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