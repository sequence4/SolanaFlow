"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import TaskLogsContext, { TaskLog, Step } from "./TaskLogsContext";
import eventBus from "@/lib/eventBus";

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
  const [isVisible, setIsVisible] = useState(false);   // stays off; Chat will display logs
  const [suppressToast, setSuppressToast] = useState(false);  // NEW
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

  /* helper – show toast only when allowed */
  const showToastIfAllowed = () => {
    if (!suppressToast && !isVisible) setIsVisible(true);
  };

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
    if (suppressToast) return;
    
    setLogs((prevLogs) => [
      ...prevLogs,
      { message, timestamp: Date.now() },
    ]);
    
    // Make the toast visible when logs are added
    showToastIfAllowed();
  }, [isVisible, suppressToast]);

  const addSystemLog = useCallback((log: string) => {
    if (suppressToast) return;
    
    setSystemLogs((prev) => [...prev, log]);
    setLastMessage(log);
    
    // Also make the toast visible when system logs are added
    showToastIfAllowed();
  }, [isVisible, suppressToast]);

  const handleSetSteps = useCallback((newSteps: Step[]) => {
    setSteps(newSteps);
    
    // Make the toast visible when steps are set
    if (newSteps.length > 0) {
      showToastIfAllowed();
    }
  }, [isVisible, suppressToast]);

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
    /* ---------- 1. dedicated handling for the streamed UI preview ---------- */
    if (stage === "ui-ready") {
      setUiReady(true);
      if (data?.fileTree) {
        setFileTree(data.fileTree);
      }
      return;
    }

    /* ---------- 2. normalise build-sub-stages into the single "build" step */
    const normalisedStage =
      stage.startsWith("build-") ? "build" : stage;

    if (stage === "build-started") setBuildPhase("started");
    if (stage === "build-done")    setBuildPhase("done");

    const index = STAGES.findIndex(s => s.stage === normalisedStage);
    setCurrentStep(index);         // -1 if unknown → toast still shows
    showToastIfAllowed();
    
    if (stage === 'done' || stage === 'error') {
      setSuppressToast(false);              // allow UI toast for future builds
    }
  }, [suppressToast, isVisible]);

  // Subscribe to global progress events (from SSE)
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload && typeof payload === 'object') {
        if (payload.stage) {
          updateStage(payload.stage, payload);
        }
        if (payload.containerUrl) {
          addSystemLog(`🌐 Container URL: ${payload.containerUrl}`);
        }
        if (payload.artifact) {
          addSystemLog("🗄️  Build artefact ready – click to download");
        }
        if (payload.fileTree) {
          const count = Array.isArray(payload.fileTree) ? payload.fileTree.length : 1;
          addSystemLog(`📂 Received project file tree with ${count} items`);
        }
        if (payload.programId) {
          addSystemLog(`🔑 Program ID: ${payload.programId}`);
        }
        if (['deploy-done', 'done', 'completed'].includes(payload.stage)) {
          addSystemLog("✅ Deployment complete!");
          setTimeout(() => setIsVisible(false), 3000);
        } else if (payload.stage === 'deploy-skipped') {
          addSystemLog("✅ Wallet-signed deploy detected – backend deploy step skipped");
        } else if (payload.stage === 'error') {
          addSystemLog(`❌ Error: ${payload.message || 'Unknown error'}`);
        } else if (payload.message && !payload.stage) {
          addSystemLog(payload.message);
        }
      } else if (payload) {
        // If payload is a simple value (string/number), log it directly
        addSystemLog(String(payload));
      }
    };
    eventBus.on('progress', handler);
    return () => {
      eventBus.off('progress', handler);
    };
  }, [updateStage, addSystemLog, setIsVisible]);

  // Wrap setProgress to also notify subscribers
  const setWrappedProgress = useCallback((p: number) => {
    setProgress(p);
    notify(p, lastMessage);
  }, [notify, lastMessage]);

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
        suppressToast,
        
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
        setSuppressToast,
      }}
    >
      {children}
    </TaskLogsContext.Provider>
  );
} 