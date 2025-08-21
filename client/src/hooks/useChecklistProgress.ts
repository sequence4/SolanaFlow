import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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

interface StageUpdate {
  stage: string;
  status: "active" | "completed" | "error";
  pct?: number;
  message?: string;
  files?: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
  codeSnippet?: {
    language: string;
    content: string;
    filename?: string;
    lineCount?: number;
  };
}

const INITIAL: Step[] = [
  { id: 0, stage: "environment", title: "Environment Setup", description: "", status: "pending" },
  { id: 1, stage: "code-gen", title: "Code Generation", description: "", status: "pending" },
  { id: 2, stage: "build", title: "Program Build", description: "", status: "pending" },
];

export function useChecklistProgress() {
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [animatingSteps, setAnimatingSteps] = useState<{[stepId: number]: NodeJS.Timeout}>({});
  const lastProgressMapRef = useRef(new Map<string, number>());
  
  // Refs for optimization
  const updateQueueRef = useRef<StageUpdate[]>([]);
  const processingRef = useRef(false);
  const lastUpdateTimeRef = useRef<Map<string, number>>(new Map());

  // Debounced update processing to prevent rapid re-renders
  const processUpdateQueue = useCallback(() => {
    if (processingRef.current || updateQueueRef.current.length === 0) return;
    
    processingRef.current = true;
    
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      const updates = [...updateQueueRef.current];
      updateQueueRef.current = [];
      
      if (updates.length === 0) {
        processingRef.current = false;
        return;
      }
      
      setSteps(prevSteps => {
        const newSteps = prevSteps.map(step => {
          // Find the latest update for this step's stage
          const relevantUpdates = updates.filter(u => u.stage === step.stage);
          if (relevantUpdates.length === 0) return step;
          
          // Use the most recent update
          const latestUpdate = relevantUpdates[relevantUpdates.length - 1];
          
          const nextStatus =
            latestUpdate.status === "completed" ? "done" :
            latestUpdate.status === "error" ? "error" :
            latestUpdate.status === "active" ? "active" : step.status;
          
          const targetPct = latestUpdate.pct ?? (
            latestUpdate.status === "completed" ? 100 :
            latestUpdate.status === "active" ? 50 : step.pct || 0
          );
          
          // Prevent progress regression
          const lastPct = lastProgressMapRef.current.get(latestUpdate.stage) || 0;
          const currentPct = step.pct || 0;
          const safePct = Math.max(targetPct, lastPct, currentPct);
          
          // Update last progress tracking
          if (safePct > lastPct) {
            lastProgressMapRef.current.set(latestUpdate.stage, safePct);
          }
          
          // Only animate if progress is increasing significantly
          const shouldAnimate = safePct > currentPct + 5;
          if (shouldAnimate && !animatingSteps[step.id]) {
            animatePercentage(step.id, currentPct, safePct);
          }
          
          return {
            ...step,
            status: nextStatus,
            description: latestUpdate.message ?? step.description,
            pct: shouldAnimate ? currentPct : safePct, // Keep current if animating
            codeSnippet: latestUpdate.codeSnippet ? {
              language: latestUpdate.codeSnippet.language || 'rust',
              content: latestUpdate.codeSnippet.content || '',
              filename: latestUpdate.codeSnippet.filename,
              lineCount: latestUpdate.codeSnippet.lineCount
            } : step.codeSnippet,
            generatedFiles: latestUpdate.files || step.generatedFiles
          };
        });
        
        return newSteps;
      });
      
      processingRef.current = false;
    });
  }, [animatingSteps]);

  // Optimized animation function with cleanup
  const animatePercentage = useCallback((stepId: number, currentPct: number, targetPct: number) => {
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
  }, [animatingSteps]);

  // Enhanced message handling with deduplication and throttling
  const handleProgressMessage = useCallback((payload: any) => {
    if (!payload.stage) return;
    
    const now = Date.now();
    const lastUpdate = lastUpdateTimeRef.current.get(payload.stage) || 0;
    
    // Throttle rapid updates for the same stage (except completion)
    if (payload.status !== 'completed' && now - lastUpdate < 100) {
      return;
    }
    
    lastUpdateTimeRef.current.set(payload.stage, now);
    
    // Add to update queue with sequence number for deduplication
    const update: StageUpdate = {
      stage: payload.stage,
      status: payload.status,
      pct: payload.pct,
      message: payload.message,
      files: payload.files,
      codeSnippet: payload.codeSnippet,
    };
    
    updateQueueRef.current.push(update);
    
    // Process updates in next tick to allow batching
    setTimeout(processUpdateQueue, 0);
  }, [processUpdateQueue]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(animatingSteps).forEach(intervalId => {
        clearInterval(intervalId);
      });
    };
  }, [animatingSteps]);

  // Event bus subscription with cleanup
  useEffect(() => {
    const eventHandler = handleProgressMessage;
    eventBus.on("progress", eventHandler);
    
    return () => {
      eventBus.off("progress", eventHandler);
      // Clear any pending updates
      updateQueueRef.current = [];
      processingRef.current = false;
    };
  }, [handleProgressMessage]);

  // Memoize steps to prevent unnecessary re-renders in parent components
  const memoizedSteps = useMemo(() => steps, [steps]);

  return memoizedSteps;
}

// Enhanced hook with additional optimization for specific use cases
export function useChecklistProgressWithOptimization() {
  const steps = useChecklistProgress();
  
  // Memoize derived state to prevent recalculation
  const derivedState = useMemo(() => {
    const activeStep = steps.find(step => step.status === 'active');
    const completedSteps = steps.filter(step => step.status === 'done');
    const errorSteps = steps.filter(step => step.status === 'error');
    const overallProgress = Math.round(
      steps.reduce((sum, step) => {
        const pct = step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0);
        return sum + pct;
      }, 0) / steps.length
    );
    
    return {
      steps,
      activeStep,
      completedSteps,
      errorSteps,
      overallProgress,
      isComplete: completedSteps.length === steps.length,
      hasErrors: errorSteps.length > 0
    };
  }, [steps]);
  
  return derivedState;
}