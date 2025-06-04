import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { downloadArtifact } from '@/api/projectArtifact';
import { deployUpgradeableProgram } from '@/lib/deployUpgradeableProgram';
import { Button } from '@/components/ui/button';
import { Rocket, AlertTriangle, Info } from 'lucide-react';
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
  taskLogs: {
    addSystemLog: (message: string) => void;
    setIsVisible: (visible: boolean) => void;
  };
}

export function ProgramDeployer({ 
  projectId, 
  isOpen, 
  onClose, 
  onSuccess,
  taskLogs
}: ProgramDeployerProps) {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [bytesLoaded, setBytesLoaded] = useState(false);
  const [programBytes, setProgramBytes] = useState<ArrayBuffer | null>(null);
  const [byteLength, setByteLength] = useState(0);
  const [progress, setProgress] = useState(0);
  const [deployStage, setDeployStage] = useState<string>('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  // Load the program bytes when the modal opens
  useEffect(() => {
    if (isOpen && !bytesLoaded && !isLoading) {
      loadProgramBytes();
    }
  }, [isOpen, bytesLoaded, isLoading]);

  const loadProgramBytes = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    taskLogs.addSystemLog("🔍 Fetching compiled program...");
    
    try {
      const bytes = await downloadArtifact(projectId);
      setProgramBytes(bytes);
      setByteLength(bytes.byteLength);
      setBytesLoaded(true);
      taskLogs.addSystemLog(`✅ Program fetched: ${bytes.byteLength.toLocaleString()} bytes`);
    } catch (error) {
      console.error("Failed to load program bytes:", error);
      taskLogs.addSystemLog(`❌ Failed to load program: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Failed to load program", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !programBytes) {
      return;
    }

    setIsLoading(true);
    setProgress(0);
    taskLogs.addSystemLog("🚀 Starting browser-side program deployment...");
    taskLogs.setIsVisible(true);
    
    try {
      // const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      
      const { programId, signatures } = await deployUpgradeableProgram({
        soBytes: programBytes,
        connection,
        wallet,
        onProgress: (progressInfo) => {
          const percentComplete = Math.floor((progressInfo.uploaded / progressInfo.total) * 100);
          setProgress(percentComplete);
          setDeployStage(progressInfo.stage);
          
          if (progressInfo.chunkIndex !== undefined && progressInfo.totalChunks !== undefined) {
            setCurrentChunk(progressInfo.chunkIndex + 1);
            setTotalChunks(progressInfo.totalChunks);
          }
          
          // Log progress to task logs
          if (progressInfo.stage === 'create') {
            taskLogs.addSystemLog("🏗️ Creating program buffer...");
          } else if (progressInfo.stage === 'write') {
            if (progressInfo.chunkIndex === 0) {
              taskLogs.addSystemLog(`📦 Writing program data in ${progressInfo.totalChunks} chunks...`);
            }
            if (progressInfo.chunkIndex !== undefined && progressInfo.chunkIndex % 5 === 0) {
              const percent = Math.floor((progressInfo.uploaded / progressInfo.total) * 100);
              taskLogs.addSystemLog(`📤 Uploaded ${percent}% (chunk ${progressInfo.chunkIndex + 1}/${progressInfo.totalChunks})`);
            }
          } else if (progressInfo.stage === 'deploy') {
            taskLogs.addSystemLog("🔄 Finalizing deployment...");
          } else if (progressInfo.stage === 'complete') {
            taskLogs.addSystemLog(`✅ Deployment complete!`);
            taskLogs.addSystemLog(`📝 Program ID: ${programId.toBase58()}`);
            taskLogs.addSystemLog(`🔍 View on Explorer: https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
          }
        }
      });
      
      // Show success message
      toast.success("Program deployed successfully", {
        description: `Program ID: ${programId.toBase58()}`,
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`, '_blank')
        }
      });
      
      // Call the success callback
      onSuccess(programId.toBase58());
      onClose();
    } catch (error) {
      console.error("Deployment failed:", error);
      taskLogs.addSystemLog(`❌ Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Deployment failed", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  }, [wallet, programBytes, projectId, onSuccess, onClose, taskLogs]);

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
              
              {isLoading && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6e6e76]">
                      {deployStage === 'create' ? 'Creating buffer...' :
                       deployStage === 'write' ? `Writing chunk ${currentChunk}/${totalChunks}...` :
                       deployStage === 'deploy' ? 'Finalizing deployment...' :
                       deployStage === 'complete' ? 'Deployment complete!' : 'Preparing...'}
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
            onClick={handleDeploy}
            disabled={isLoading || !bytesLoaded || !wallet.publicKey}
            className="w-full sm:w-auto bg-[#4d7cfe] hover:bg-[#4d7cfe]/90 text-white flex items-center"
          >
            {isLoading ? (
              <span>Deploying...</span>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                <span>Deploy to Devnet</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 