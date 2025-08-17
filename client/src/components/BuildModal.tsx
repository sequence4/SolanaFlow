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
import { darkTheme } from '@/styles/theme';

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
      <DialogContent 
        className="backdrop-blur-xl sm:max-w-md shadow-2xl"
        style={{
          backgroundColor: darkTheme.background.secondary,
          borderColor: darkTheme.border.default,
          backdropFilter: `blur(${darkTheme.glass.blur})`,
          color: darkTheme.text.primary,
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-lg font-medium"
            style={{ color: darkTheme.text.primary }}
          >
            Build Program
          </DialogTitle>
          <DialogDescription style={{ color: darkTheme.text.secondary }}>
            This will run <code>anchor build</code> inside a disposable
            container and generate the final <code>.so</code> artefact.
          </DialogDescription>
        </DialogHeader>

        {isBuilding && (
          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: darkTheme.text.secondary }}>{stage}</span>
              <span className="text-sm" style={{ color: darkTheme.text.secondary }}>
                {percent ?? 0}%
              </span>
            </div>
            <Progress value={percent ?? 0} aria-label="build progress" />
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            disabled={isBuilding}
            onClick={onClose}
            className="w-full sm:w-auto transition-colors"
            style={{
              backgroundColor: 'transparent',
              borderColor: darkTheme.border.default,
              color: darkTheme.text.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = darkTheme.background.tertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleStart}
            disabled={isBuilding}
            className="w-full sm:w-auto flex items-center transition-colors"
            style={{
              backgroundColor: darkTheme.accent.green,
              color: darkTheme.text.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${darkTheme.accent.green}CC`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = darkTheme.accent.green;
            }}
          >
            <Hammer className="h-4 w-4 mr-2" />
            <span>Start Build</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 