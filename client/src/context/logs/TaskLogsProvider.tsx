"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import TaskLogsContext, { TaskLog, Step } from "./TaskLogsContext";

// Create a global reference for access from non-React contexts
declare global {
  interface Window {
    __taskLogsRef: {
      current: {
        updateStage: (stage: string, data?: any) => void;
      } | null;
    };
  }
}

// Initialize the global reference
if (typeof window !== 'undefined') {
  window.__taskLogsRef = { current: null };
}

// Define the canonical stages list to be used across the app
export const STAGES = [
  { stage: "environment", label: "Build env",   icon: "Server"   },
  { stage: "code-gen",    label: "Code-gen",    icon: "Code"     },
  { stage: "build",       label: "Compile",     icon: "Cpu"      },
  { stage: "deploy",      label: "Deploy",      icon: "HardDrive"},
  { stage: "done",        label: "Complete",    icon: "CheckCircle"}
] as const;

export default function TaskLogsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1); // Start at -1 to indicate "waiting for pipeline"
  const [steps, setSteps] = useState<Step[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [uiReady, setUiReady] = useState(false);
  const [fileTree, setFileTree] = useState<any>(null);
  const [buildPhase, setBuildPhase] = useState<'waiting' | 'started' | 'done'>('waiting');

  /* ---------- very lightweight observer list ---------- */
  type ProgressCB = (e: { progress: number; message: string }) => void;
  const subs = useRef<Set<ProgressCB>>(new Set()).current;

  const onProgress = useCallback(
    (cb: ProgressCB) => {
      subs.add(cb);
      return () => subs.delete(cb);            // unsubscribe
    },
    [subs],
  );

  /* Notify on every progress mutation */
  const notify = useCallback(
    (p: number, msg: string) =>
      subs.forEach((fn) => fn({ progress: p, message: msg })),
    [subs],
  );
  
  // Reset when progress reaches 100%
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (progress >= 100) {
      timer = setTimeout(() => {
        // Auto-hide the toast after completion
        setIsVisible(false);
      }, 3000); // 3 seconds after completion
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // Update progress based on currentStep
  useEffect(() => {
    const newProgress = currentStep < 0 
      ? 0 
      : Math.min(((currentStep + 1) / STAGES.length) * 100, 100);
    setProgress(newProgress);
  }, [currentStep]);

  const addLog = useCallback((message: string) => {
    setLogs((prevLogs) => [
      ...prevLogs,
      { message, timestamp: Date.now() },
    ]);
    
    // Make the toast visible when logs are added
    if (!isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  const addSystemLog = useCallback((log: string) => {
    setSystemLogs((prev) => [...prev, log]);
    setLastMessage(log);
    
    // Also make the toast visible when system logs are added
    if (!isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  const handleSetSteps = useCallback((newSteps: Step[]) => {
    setSteps(newSteps);
    
    // Make the toast visible when steps are set
    if (newSteps.length > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [isVisible]);

  const resetLogs = useCallback(() => {
    setLogs([]);
    setProgress(0);
    setCurrentStep(-1); // Reset to "waiting" state
    setSystemLogs([]);
    setLastMessage("");
    // Keep steps until a new task explicitly sets them
    // setSteps([]); 
    setShowDetails(false); // Reset details view as well
  }, []);

  const updateStage = useCallback((stage: string, data?: any) => {
    // Special handling for ui-ready
    if (stage === 'ui-ready') {
      setUiReady(true);
      if (data?.fileTree) {
        setFileTree(data.fileTree);
      }
      return;
    }

    // Special handling for build phases
    if (stage === 'build-started') {
      setBuildPhase('started');
    } else if (stage === 'build-done') {
      setBuildPhase('done');
    }

    const index = STAGES.findIndex(s => s.stage === stage);
    // Set to found index or -1 if stage is unrecognized
    setCurrentStep(index);
    setIsVisible(true);
  }, []);

  // Wrap setProgress to also notify subscribers
  const setWrappedProgress = useCallback((p: number) => {
    setProgress(p);
    notify(p, lastMessage);
  }, [notify, lastMessage]);

  // Set up global reference for non-React contexts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__taskLogsRef.current = {
        updateStage
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__taskLogsRef.current = null;
      }
    };
  }, [updateStage]);

  return (
    <TaskLogsContext.Provider
      value={{
        logs,
        isVisible,
        progress,
        currentStep,
        steps,
        showDetails,
        systemLogs,
        memoryStats: "128MB / 512MB",
        networkStats: "4.2 MB/s",
        nodeVersion: "v18.12.1",
        isBuilding,
        uiReady,
        fileTree,
        buildPhase,
        
        onProgress,
        
        addLog,
        setProgress: setWrappedProgress,
        setCurrentStep,
        setIsVisible,
        setShowDetails,
        addSystemLog,
        resetLogs,
        setSteps: handleSetSteps,
        updateStage,
        setIsBuilding,
      }}
    >
      {children}
    </TaskLogsContext.Provider>
  );
} 