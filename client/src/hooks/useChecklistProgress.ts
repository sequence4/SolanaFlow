import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import eventBus, { ProgressPayload } from "../lib/eventBus";
import { debugLogger } from "../utils/debugLogger";

export interface Step {
  id: number;
  stage: "environment" | "code-gen" | "build";
  title: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
  pct?: number;
  totalFileCount?: number; // Track total separately from display files
  allFileNames?: string[]; // ALL file names for complete list display
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
  totalFileCount?: number;
  allFileNames?: string[];
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
  // Add a separate ref to track all generated files
  const allGeneratedFilesRef = useRef<Map<string, any>>(new Map());
  
  // Refs for optimization and deduplication
  const updateQueueRef = useRef<StageUpdate[]>([]);
  const processingRef = useRef(false);
  const lastUpdateTimeRef = useRef<Map<string, number>>(new Map());
  const processedEventHashesRef = useRef(new Set<string>());
  const lastEventTimestampRef = useRef<{[key: string]: number}>({});

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
            totalFileCount: latestUpdate.totalFileCount ?? step.totalFileCount,
            allFileNames: latestUpdate.allFileNames ?? step.allFileNames,
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

  // Helper function to get language from filename
  const getLanguageFromFilename = useCallback((filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'rs': 'rust',
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'toml': 'toml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'css': 'css',
      'html': 'html',
      'md': 'markdown'
    };
    return langMap[ext || ''] || 'text';
  }, []);

  // Enhanced message handling with individual file events
  const handleProgressMessage = useCallback((payload: any) => {
    if (!payload.stage) return;
    
    // Handle file-generated events with proper accumulation
    if (payload.type === 'file-generated') {
      const fileName = payload.fileName;
      const fileContent = payload.content || ''; // Use actual content from payload
      const fileLanguage = payload.language || getLanguageFromFilename(fileName);
      
      // Store in ref to prevent loss
      if (!allGeneratedFilesRef.current.has(fileName)) {
        allGeneratedFilesRef.current.set(fileName, {
          filename: fileName,
          content: fileContent, // Use the actual content
          language: fileLanguage // Use the language from payload or derive it
        });
      }
      
      console.log(`[PROGRESS] File generated: ${fileName} (${allGeneratedFilesRef.current.size} total, content length: ${fileContent.length})`);
      
      setSteps(prevSteps => {
        return prevSteps.map(step => {
          if (step.stage === 'code-gen') {
            // Always use the complete file list from ref
            const allFiles = Array.from(allGeneratedFilesRef.current.values());
            
            // Limit display to 10 most recent files
            const displayFiles = allFiles.slice(-10);
            
            return {
              ...step,
              generatedFiles: displayFiles,
              totalFileCount: allFiles.length, // Track total separately
              pct: payload.pct || step.pct,
              description: `Generated ${allFiles.length} files`,
              status: 'active' as const
            };
          }
          return step;
        });
      });
      return;
    }
    
    // Reset file tracking when stage changes
    if (payload.stage !== 'code-gen' && payload.status === 'active') {
      allGeneratedFilesRef.current.clear();
    }
    
    // Create unique hash for event deduplication
    const eventHash = `${payload.stage}-${payload.status}-${payload.pct || 0}-${payload.files?.length || 0}`;
    const now = Date.now();
    
    // Skip duplicate events within 500ms window
    if (processedEventHashesRef.current.has(eventHash)) {
      const lastTime = lastEventTimestampRef.current[eventHash] || 0;
      if (now - lastTime < 500) {
        console.log('[PROGRESS] Skipping duplicate event:', eventHash);
        return;
      }
    }
    
    processedEventHashesRef.current.add(eventHash);
    lastEventTimestampRef.current[eventHash] = now;
    
    // For code-gen stage, batch file updates to prevent accumulation
    if (payload.stage === 'code-gen' && payload.files) {
      // Clear any pending updates for code-gen to prevent accumulation
      updateQueueRef.current = updateQueueRef.current.filter(u => u.stage !== 'code-gen');
      console.log('[PROGRESS] Batching code-gen files:', payload.files.length);
    }
    
    const lastUpdate = lastUpdateTimeRef.current.get(payload.stage) || 0;
    
    // Throttle rapid updates for the same stage (except completion)
    if (payload.status !== 'completed' && now - lastUpdate < 100) {
      return;
    }
    
    lastUpdateTimeRef.current.set(payload.stage, now);
    
    // Add to update queue
    const update: StageUpdate = {
      stage: payload.stage,
      status: payload.status,
      pct: payload.pct,
      message: payload.message,
      totalFileCount: payload.totalFileCount,
      allFileNames: payload.allFileNames,
      files: payload.files,
      codeSnippet: payload.codeSnippet,
    };
    
    updateQueueRef.current.push(update);
    
    // Debounce processing for code-gen events to allow batching
    const delay = payload.stage === 'code-gen' ? 300 : 0;
    setTimeout(processUpdateQueue, delay);
  }, [processUpdateQueue, getLanguageFromFilename]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(animatingSteps).forEach(intervalId => {
        clearInterval(intervalId);
      });
    };
  }, [animatingSteps]);

  // Clear old hashes periodically to prevent memory leaks
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      // Clear hashes older than 5 minutes
      Object.keys(lastEventTimestampRef.current).forEach(hash => {
        if (now - lastEventTimestampRef.current[hash] > 300000) {
          processedEventHashesRef.current.delete(hash);
          delete lastEventTimestampRef.current[hash];
        }
      });
      console.log('[PROGRESS] Cleaned up old event hashes');
    }, 60000); // Clean every minute
    
    return () => clearInterval(interval);
  }, []);

  // Event bus subscription with cleanup
  useEffect(() => {
    const eventHandler = handleProgressMessage;
    eventBus.on("progress", eventHandler);
    
    return () => {
      eventBus.off("progress", eventHandler);
      // Clear any pending updates
      updateQueueRef.current = [];
      processingRef.current = false;
      // Clear deduplication data
      processedEventHashesRef.current.clear();
      lastEventTimestampRef.current = {};
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