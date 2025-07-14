// client/src/hooks/useBuildAndDeploy.ts

import { useState, useCallback, useContext } from 'react';
import { toast } from 'sonner';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import ProjectContext from '@/context/project/ProjectContext';
import { projectApi } from '@/api/projectApi';
import { runDeployPipelineWithLogs } from '@/utils/deploy/deployPipeline';
import FileContext from '@/context/file/FileContext';

export function useBuildAndDeploy() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const { projectContext, setProjectContext } = useContext(ProjectContext);
  const { setFileTree } = useContext(FileContext);
  const taskLogs = useTaskLogs();
  
  // Function to handle building the project
  const buildProject = useCallback(async (projectId: string, graphData: any, setArtifactUrl?: (url: string) => void) => {
    if (isBuilding) return { success: false };
    
    try {
      setIsBuilding(true);
      taskLogs.resetLogs();
      taskLogs.setIsVisible(true);
      taskLogs.addSystemLog("🔨 Building program...");
      
      // Run the build pipeline
      return new Promise<{success: boolean, error?: Error}>((resolve) => {
        const eventSource = runDeployPipelineWithLogs(
          { ...projectContext, id: projectId },
          graphData,
          taskLogs,
          setProjectContext,
          setArtifactUrl,
          async (status?: 'error') => {
            if (status === 'error') {
              resolve({ success: false, error: new Error('Build failed') });
              return;
            }
            
            taskLogs.addSystemLog("✅ Build completed successfully!");
            
            // Persist the built flag to the server
            try {
              await projectApi.updateProject(projectId, {
                details: {
                  projectState: { built: true }
                }
              });
              
              // Update local context
              setProjectContext(prev => ({
                ...prev,
                details: {
                  ...prev.details!,
                  projectState: {
                    ...prev.details!.projectState,
                    built: true,
                    deployed: false,
                    programId: undefined
                  }
                }
              }));
              
              toast.success("Build completed");
              resolve({ success: true });
            } catch (error) {
              console.error("Failed to persist build state:", error);
              toast.error("Failed to save build state");
              resolve({ success: true, error: error as Error });
            }
          },
          setFileTree
        );
        
        return eventSource;
      });
    } catch (err) {
      console.error('[build] Error:', err);
      toast.error("Build error", {
        description: String(err)
      });
      return { success: false, error: err as Error };
    } finally {
      setIsBuilding(false);
    }
  }, [isBuilding, projectContext, setProjectContext, taskLogs, setFileTree]);
  
  // Function to handle deployment success
  const handleDeploySuccess = useCallback(async (projectId: string, programId: string) => {
    try {
      // Persist the deployed flag to the server
      await projectApi.updateProject(projectId, {
        details: {
          projectState: { 
            deployed: true,
            built: false
          },
          programId
        }
      });
      
      // Update local context
      setProjectContext(prev => ({
        ...prev,
        details: {
          ...prev.details!,
          projectState: {
            ...prev.details!.projectState,
            deployed: true
          },
          programId
        }
      }));
    } catch (error) {
      console.error("Failed to persist deployment state:", error);
      // Still update local state for UX continuity
      setProjectContext(prev => ({
        ...prev,
        details: {
          ...prev.details!,
          projectState: {
            ...prev.details!.projectState,
            deployed: true
          },
          programId
        }
      }));
    }
  }, [setProjectContext]);
  
  return {
    isBuilding,
    isDeploying,
    buildProject,
    handleDeploySuccess
  };
}