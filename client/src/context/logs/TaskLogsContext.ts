import { createContext } from 'react';

export interface TaskLog {
  message: string;
  timestamp: number;
}

export interface Step {
  icon: string;
  message: string;
  details: string;
}

export interface TaskLogsContextType {
  logs: TaskLog[];
  isVisible: boolean;
  progress: number;
  currentStep: number;
  steps: Step[];
  showDetails: boolean;
  systemLogs: string[];
  memoryStats: string;
  networkStats: string;
  nodeVersion: string;
  isBuilding: boolean;
  uiReady: boolean;
  fileTree: any;
  buildPhase: 'waiting' | 'started' | 'done';
  suppressToast: boolean;                 // NEW – read-only flag
  
  /**
   * Subscribe to fine-grained progress updates without forcing a
   * whole-tree re-render. Returns an unsubscribe function.
   */
  onProgress: (
    cb: (ev: { progress: number; message: string }) => void
  ) => () => void;
  
  addLog: (message: string) => void;
  setProgress: (progress: number) => void;
  setCurrentStep: (step: number) => void;
  setIsVisible: (isVisible: boolean) => void;
  setShowDetails: (showDetails: boolean) => void;
  addSystemLog: (log: string) => void;
  resetLogs: () => void;
  setSteps: (steps: Step[]) => void;
  updateStage: (stage: string, data?: any) => void;
  setIsBuilding: (b: boolean) => void;
  setSuppressToast: (b: boolean) => void; // NEW – setter
}

const TaskLogsContext = createContext<TaskLogsContextType>({
  logs: [],
  isVisible: false,
  progress: 0,
  currentStep: -1,
  steps: [],
  showDetails: false,
  systemLogs: [],
  memoryStats: "128MB / 512MB",
  networkStats: "4.2 MB/s",
  nodeVersion: "v18.12.1",
  isBuilding: false,
  uiReady: false,
  fileTree: null,
  buildPhase: 'waiting',
  suppressToast: false,
  
  onProgress: () => () => {},
  
  addLog: () => {},
  setProgress: () => {},
  setCurrentStep: () => {},
  setIsVisible: () => {},
  setShowDetails: () => {},
  addSystemLog: () => {},
  resetLogs: () => {},
  setSteps: () => {},
  updateStage: () => {},
  setIsBuilding: () => {},
  setSuppressToast: () => {},
});

export default TaskLogsContext; 