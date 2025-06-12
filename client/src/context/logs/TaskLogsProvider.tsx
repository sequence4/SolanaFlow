"use client";

import React, { useState, useEffect, useCallback } from "react";
import TaskLogsContext, { TaskLog, Step } from "./TaskLogsContext";

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
    // Keep steps until a new task explicitly sets them
    // setSteps([]); 
    setShowDetails(false); // Reset details view as well
  }, []);

  const updateStage = useCallback((stage: string) => {
    const index = STAGES.findIndex(s => s.stage === stage);
    // Set to found index or -1 if stage is unrecognized
    setCurrentStep(index);
    setIsVisible(true);
  }, []);

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
        
        addLog,
        setProgress,
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