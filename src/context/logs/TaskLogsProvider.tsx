"use client";

import React, { useState, useEffect, useCallback } from "react";
import TaskLogsContext, { type TaskLog, type Step } from "./TaskLogsContext";

export default function TaskLogsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  
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

  // Update current step based on progress
  useEffect(() => {
    // Calculate which step we're on based on progress and the number of steps
    if (steps.length > 0 && progress > 0) {
      const stepIndex = Math.min(
        Math.floor((progress / 100) * steps.length),
        steps.length - 1
      );
      // Only update if the step actually changes
      if (stepIndex !== currentStep) {
        setCurrentStep(stepIndex);
      }
    } else {
      // If no steps or progress is 0, reset to step 0
      setCurrentStep(0);
    }
  }, [progress, steps, currentStep]);

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
    setCurrentStep(0);
    setSystemLogs([]);
    // Keep steps until a new task explicitly sets them
    // setSteps([]); 
    setShowDetails(false); // Reset details view as well
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
        
        addLog,
        setProgress,
        setCurrentStep,
        setIsVisible,
        setShowDetails,
        addSystemLog,
        resetLogs,
        setSteps: handleSetSteps,
      }}
    >
      {children}
    </TaskLogsContext.Provider>
  );
} 