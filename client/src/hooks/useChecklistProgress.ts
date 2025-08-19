import { useEffect, useState } from "react";
import eventBus, { ProgressPayload } from "../lib/eventBus";

export interface Step {
  id: number;
  stage: "environment" | "code-gen" | "build";
  title: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
  pct?: number;
  codeSnippet?: {
    language: string;
    content: string;
    filename?: string;
    lineCount?: number;
  };
}

const INITIAL: Step[] = [
  { id: 0, stage: "environment", title: "Environment Setup", description: "", status: "pending" },
  { id: 1, stage: "code-gen"   , title: "Code Generation"   , description: "", status: "pending" },
  { id: 2, stage: "build"      , title: "Program Build"      , description: "", status: "pending" },
];

export function useChecklistProgress() {
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [animatingSteps, setAnimatingSteps] = useState<{[stepId: number]: NodeJS.Timeout}>({});

  // Smooth percentage animation function
  const animatePercentage = (stepId: number, currentPct: number, targetPct: number) => {
    // Clear any existing animation for this step
    if (animatingSteps[stepId]) {
      clearInterval(animatingSteps[stepId]);
    }

    if (currentPct >= targetPct) return;

    const increment = Math.max(1, Math.ceil((targetPct - currentPct) / 20)); // Animate over ~1 second
    const intervalId = setInterval(() => {
      setSteps(prev => prev.map(s => {
        if (s.id === stepId) {
          const newPct = Math.min(targetPct, (s.pct || 0) + increment);
          if (newPct >= targetPct) {
            clearInterval(intervalId);
            setAnimatingSteps(prev => {
              const newState = { ...prev };
              delete newState[stepId];
              return newState;
            });
          }
          return { ...s, pct: newPct };
        }
        return s;
      }));
    }, 50);

    setAnimatingSteps(prev => ({ ...prev, [stepId]: intervalId }));
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(animatingSteps).forEach(intervalId => {
        clearInterval(intervalId);
      });
    };
  }, [animatingSteps]);

  useEffect(() => {
    const onMsg = (payload: any) => {
      if (!payload.stage) return;
      setSteps(prev =>
        prev.map(s => {
          if (s.stage === payload.stage) {
            const nextStatus =
              payload.status === "completed"
                ? "done"
                : payload.status === "error"
                ? "error"
                : "active";
            
            const targetPct =
              payload.pct ??                       // backend may send exact %
              (payload.status === "completed" ? 100 :
               payload.status === "active"     ? 50  : 0);
            
            const currentPct = s.pct || 0;
            
            // Animate percentage smoothly if it's increasing
            if (targetPct > currentPct) {
              animatePercentage(s.id, currentPct, targetPct);
            }
            
            return {
              ...s,
              status: nextStatus,
              description: payload.message ?? s.description,
              pct: targetPct > currentPct ? currentPct : targetPct, // Keep current if animating
              codeSnippet: payload.codeSnippet ? {
                language: payload.codeSnippet.language || 'rust',
                content: payload.codeSnippet.content || '',
                filename: payload.codeSnippet.filename,
                lineCount: payload.codeSnippet.lineCount
              } : s.codeSnippet
            };
          }
          return s;
        }),
      );
    };
    eventBus.on("progress", onMsg);
    return () => eventBus.off("progress", onMsg);
  }, []);

  return steps;
} 