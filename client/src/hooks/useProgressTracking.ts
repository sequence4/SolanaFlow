import { useState, useEffect, useCallback, useRef } from 'react';
import eventBus from '../lib/eventBus';

interface ProcessInfo {
  id: string;
  stage: string;
  process: string;
  message: string;
  pct: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  details?: {
    current?: number;
    total?: number;
  };
}

interface CodeFiles {
  files: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
  timestamp: number;
}

export function useProgressTracking() {
  const [processes, setProcesses] = useState<Map<string, ProcessInfo>>(new Map());
  const [codeFiles, setCodeFiles] = useState<CodeFiles | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const processTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const handleProgressEvent = useCallback((event: any) => {
    console.log('[PROGRESS-TRACK] Event received:', {
      type: event.type,
      stage: event.stage,
      process: event.process,
      pct: event.pct,
      id: event.id,
      message: event.message?.substring(0, 50) + '...' || 'no message'
    });
    
    // Handle code files separately
    if (event.type === 'code-generation' && event.details?.files) {
      setCodeFiles({
        files: event.details.files,
        timestamp: event.timestamp || Date.now()
      });
      console.log('[PROGRESS-TRACK] Code files received:', event.details.files.length, 'files');
      return;
    }
    
    // Handle progress events
    if (event.type === 'progress' && event.id) {
      setProcesses(prev => {
        const updated = new Map(prev);
        
        // Complete process
        if (event.pct >= 100) {
          console.log('[PROGRESS-TRACK] Process completing:', event.id, event.process);
          
          // Mark as complete first
          updated.set(event.id, {
            id: event.id,
            stage: event.stage,
            process: event.process,
            message: event.message,
            pct: 100,
            startTime: event.timestamp,
            estimatedTimeRemaining: 0,
            details: event.details
          });
          
          // Fade out after delay
          const timeout = setTimeout(() => {
            setProcesses(p => {
              const next = new Map(p);
              next.delete(event.id);
              console.log('[PROGRESS-TRACK] Removed completed process:', event.id);
              return next;
            });
          }, 2000); // Longer delay to see completion
          
          if (processTimeouts.current.has(event.id)) {
            clearTimeout(processTimeouts.current.get(event.id)!);
          }
          processTimeouts.current.set(event.id, timeout);
        } else {
          // Update or add process
          updated.set(event.id, {
            id: event.id,
            stage: event.stage,
            process: event.process,
            message: event.message,
            pct: event.pct || 0,
            startTime: event.timestamp,
            estimatedTimeRemaining: event.estimatedTimeRemaining,
            details: event.details
          });
          
          console.log('[PROGRESS-TRACK] Updated process:', event.id, '→', event.pct + '%');
        }
        
        const activeCount = Array.from(updated.values()).filter(p => p.pct < 100).length;
        console.log('[PROGRESS-TRACK] Active processes:', activeCount, 'of', updated.size);
        
        return updated;
      });
    } else {
      console.warn('[PROGRESS-TRACK] Unknown event type or missing ID:', event.type, event.id);
    }
  }, []);
  
  // Calculate overall progress from all processes
  useEffect(() => {
    const activeProcesses = Array.from(processes.values());
    if (activeProcesses.length === 0) {
      setOverallProgress(0);
      return;
    }
    
    // Weight progress by stage order
    const stageWeights = {
      'environment': 0.1,
      'code-gen': 0.6,
      'build': 0.3,
      'deploy': 0.1
    };
    
    let weightedProgress = 0;
    let totalWeight = 0;
    
    activeProcesses.forEach(p => {
      const weight = stageWeights[p.stage as keyof typeof stageWeights] || 0.1;
      weightedProgress += p.pct * weight;
      totalWeight += weight;
    });
    
    const avgProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
    setOverallProgress(avgProgress);
    
    console.log('[PROGRESS-TRACK] Overall progress updated:', avgProgress + '%');
  }, [processes]);
  
  // Subscribe to events
  useEffect(() => {
    eventBus.on('progress', handleProgressEvent);
    return () => {
      eventBus.off('progress', handleProgressEvent);
      // Clear timeouts
      processTimeouts.current.forEach(t => clearTimeout(t));
    };
  }, [handleProgressEvent]);
  
  return {
    processes: Array.from(processes.values()),
    codeFiles,
    overallProgress,
    // Debug info
    activeProcessCount: processes.size
  };
}