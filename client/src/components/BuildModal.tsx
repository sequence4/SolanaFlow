"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Hammer, AlertTriangle } from "lucide-react";
import { runDeployPipelineWithLogs } from "@/utils/deploy/deployPipeline";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { connection } from "@/utils/connection";
import { useWalletSigner } from "@/utils/wallet";

/* ------------------------------------------------------------------ *
 *  Props
 * ------------------------------------------------------------------ */
interface BuildModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */
export function BuildModal({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: BuildModalProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<string>("Preparing build…");
  const [isRunning, setIsRunning] = useState(false);

  /* Strict-mode + double-click guards (see SO discussion) */
  const startedRef  = useRef(false);   // survives dev re-mounts
  const runningRef  = useRef(false);

  const taskLogs    = useTaskLogs();
  const wallet      = useWalletSigner();

  /* ---------------------------------------------------------------- *
   *  Trigger build when user confirms
   * ---------------------------------------------------------------- */
  const handleStart = useCallback(async () => {
    if (runningRef.current || startedRef.current) return;
    runningRef.current = true;
    startedRef.current = true;

    setIsRunning(true);
    setProgress(1);

    try {
      taskLogs.resetLogs();
      taskLogs.setIsVisible(true);
      taskLogs.addSystemLog("🔨 Building program…");

      await new Promise(r => setTimeout(r, 0));       // paint flush

      /* -------------------------------------------------------------------- *
       *  Re-use existing pipeline util – we only care about progress events
       * -------------------------------------------------------------------- */
      await runDeployPipelineWithLogs(
        { id: projectId } as any,           // current util shape
        {},
        taskLogs,
        () => {},                           // setProjectContext not needed here
        undefined,
        (status?: "error") => {
          if (status === "error") throw new Error("Build failed");
        },
      );

      toast.success("Build completed");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Build failed", { description: err.message });
    } finally {
      setIsRunning(false);
      setProgress(null);
      runningRef.current  = false;
      startedRef.current  = false;
    }
  }, [projectId, onSuccess, onClose, taskLogs]);

  /* ---------------------------------------------------------------- *
   *  Live-update progress from taskLogs
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const unsub = taskLogs.onProgress(({ progress, message }) => {
      setProgress(progress);
      setStage(message ?? "");
    });
    return () => unsub();
  }, [taskLogs]);

  /* ---------------------------------------------------------------- *
   *  UI
   * ---------------------------------------------------------------- */
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isRunning && !open && onClose()}>
      <DialogContent className="bg-[#121214] border-[#2a2a2d] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">
            Build Program
          </DialogTitle>
          <DialogDescription className="text-[#6e6e76]">
            This will run <code>anchor build</code> inside a disposable
            container and generate the final <code>.so</code> artefact. Make
            sure your wallet is connected – it is used to pre-fill authority
            fields in the next step.
          </DialogDescription>
        </DialogHeader>

        {/* ---------- Progress read-out ---------- */}
        {isRunning && progress !== null && (
          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6e6e76]">{stage}</span>
              <span className="text-sm text-[#6e6e76]">{progress}%</span>
            </div>
            <Progress value={progress} aria-label="build progress" /> {/* shadcn Progress */}
          </div>
        )}

        {/* ---------- Wallet hint ---------- */}
        {!wallet.isConnected && (
          <div className="bg-[#2a2a2d] p-4 rounded-md flex items-start space-x-2 mt-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Wallet not connected</p>
              <p className="text-xs text-[#6e6e76]">
                Connect your wallet to auto-fill Mint Authority &amp; Payer Account.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRunning}
            className="w-full sm:w-auto bg-transparent border-[#2a2a2d] text-white hover:bg-[#2a2a2d]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleStart}
            disabled={isRunning || !wallet.isConnected}
            className="w-full sm:w-auto bg-[#22c55e] hover:bg-[#22c55e]/90 text-white flex items-center"
          >
            {isRunning ? (
              <span>Building…</span>
            ) : (
              <>
                <Hammer className="h-4 w-4 mr-2" />
                <span>Start Build</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 