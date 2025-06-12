"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";

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
  /* One-click confirm; modal just closes */

  /* ---------------------------------------------------------------- *
   *  Trigger build when user confirms
   * ---------------------------------------------------------------- */
  const handleStart = () => {
    onSuccess();   // parent runs the heavy work
    onClose();     // close immediately
  };

  /* ---------------------------------------------------------------- *
   *  UI
   * ---------------------------------------------------------------- */
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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

        {/* no progress bar, no wallet hint */}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto bg-transparent border-[#2a2a2d] text-white hover:bg-[#2a2a2d]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleStart}
            className="w-full sm:w-auto bg-[#22c55e] hover:bg-[#22c55e]/90 text-white flex items-center"
          >
            <Hammer className="h-4 w-4 mr-2" />
            <span>Start Build</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 