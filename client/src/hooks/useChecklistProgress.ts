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
  generatedFiles?: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
}

const INITIAL: Step[] = [
  { id: 0, stage: "environment", title: "Environment Setup", description: "", status: "pending" },
  { id: 1, stage: "code-gen"   , title: "Code Generation"   , description: "", status: "pending" },
  { id: 2, stage: "build"      , title: "Program Build"      , description: "", status: "pending" },
];

export function useChecklistProgress() {
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [animatingSteps, setAnimatingSteps] = useState<{[stepId: number]: NodeJS.Timeout}>({});
  const [lastProgressMap, setLastProgressMap] = useState<Map<string, number>>(new Map());

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
            
            // Get last known progress for this stage to prevent regression
            const lastPct = lastProgressMap.get(payload.stage) || 0;
            const currentPct = s.pct || 0;
            
            // Never allow progress to go backwards
            const safePct = Math.max(targetPct, lastPct, currentPct);
            
            // Update last progress map
            setLastProgressMap(prev => new Map(prev).set(payload.stage, safePct));
            
            // Animate percentage smoothly if it's increasing
            if (safePct > currentPct) {
              animatePercentage(s.id, currentPct, safePct);
            }
            
            console.log('[PROGRESS] Stage:', payload.stage, 'Target:', targetPct, 'Last:', lastPct, 'Current:', currentPct, 'Safe:', safePct);
            
            return {
              ...s,
              status: nextStatus,
              description: payload.message ?? s.description,
              pct: safePct > currentPct ? currentPct : safePct, // Keep current if animating
              codeSnippet: payload.codeSnippet ? {
                language: payload.codeSnippet.language || 'rust',
                content: payload.codeSnippet.content || '',
                filename: payload.codeSnippet.filename,
                lineCount: payload.codeSnippet.lineCount
              } : s.codeSnippet,
              generatedFiles: payload.files || s.generatedFiles
            };
          }
          return s;
        }),
      );
    };
    eventBus.on("progress", onMsg);
    return () => eventBus.off("progress", onMsg);
  }, [lastProgressMap]);

  return steps;
} 