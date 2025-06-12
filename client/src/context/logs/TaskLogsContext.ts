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
  
  addLog: (message: string) => void;
  setProgress: (progress: number) => void;
  setCurrentStep: (step: number) => void;
  setIsVisible: (isVisible: boolean) => void;
  setShowDetails: (showDetails: boolean) => void;
  addSystemLog: (log: string) => void;
  resetLogs: () => void;
  setSteps: (steps: Step[]) => void;
  updateStage: (stage: string) => void;
  setIsBuilding: (b: boolean) => void;
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
});

export default TaskLogsContext; 