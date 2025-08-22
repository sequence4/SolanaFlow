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
    console.log('[PROGRESS] Event received:', event);
    
    if (event.type === 'code-generation' && event.details?.files) {
      // Handle code files
      setCodeFiles({
        files: event.details.files,
        timestamp: event.timestamp
      });
      return;
    }
    
    if (event.type === 'progress') {
      setProcesses(prev => {
        const updated = new Map(prev);
        
        if (event.pct >= 100) {
          // Process complete - remove after animation
          const timeout = setTimeout(() => {
            setProcesses(p => {
              const next = new Map(p);
              next.delete(event.id);
              return next;
            });
          }, 1000);
          
          processTimeouts.current.set(event.id, timeout);
          updated.delete(event.id);
        } else {
          // Update or add process
          updated.set(event.id, {
            id: event.id,
            stage: event.stage,
            process: event.process,
            message: event.message,
            pct: event.pct,
            startTime: event.timestamp,
            estimatedTimeRemaining: event.estimatedTimeRemaining,
            details: event.details
          });
        }
        
        return updated;
      });
    }
  }, []);
  
  // Calculate overall progress
  useEffect(() => {
    const activeProcesses = Array.from(processes.values());
    if (activeProcesses.length === 0) {
      setOverallProgress(0);
      return;
    }
    
    const totalProgress = activeProcesses.reduce((sum, p) => sum + p.pct, 0);
    const avgProgress = Math.round(totalProgress / activeProcesses.length);
    setOverallProgress(avgProgress);
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
    overallProgress
  };
}