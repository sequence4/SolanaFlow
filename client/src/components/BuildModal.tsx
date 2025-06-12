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
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";

/* ------------------------------------------------------------------ *
 *  Props
 * ------------------------------------------------------------------ */
interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isBuilding: boolean;
  percent: number | null;       // NEW
  stage: string;                // NEW
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */
export function BuildModal({
  isOpen,
  onClose,
  onSuccess,
  isBuilding,
  percent,
  stage,
}: BuildModalProps) {
  /* Start Build */
  const handleStart = () => onSuccess();   // parent starts SSE

  /* ---------------------------------------------------------------- *
   *  UI
   * ---------------------------------------------------------------- */
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        /* Block closing while build is running */
        if (!open && !isBuilding) onClose();
      }}
    >
      <DialogContent className="bg-[#121214] border-[#2a2a2d] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">
            Build Program
          </DialogTitle>
          <DialogDescription className="text-[#6e6e76]">
            This will run <code>anchor build</code> inside a disposable
            container and generate the final <code>.so</code> artefact.
          </DialogDescription>
        </DialogHeader>

        {isBuilding && percent !== null && (
          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6e6e76]">{stage}</span>
              <span className="text-sm text-[#6e6e76]">{percent}%</span>
            </div>
            <Progress value={percent} aria-label="build progress" />
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            disabled={isBuilding}
            onClick={onClose}
            className="w-full sm:w-auto bg-transparent border-[#2a2a2d] text-white hover:bg-[#2a2a2d]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleStart}
            disabled={isBuilding}
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