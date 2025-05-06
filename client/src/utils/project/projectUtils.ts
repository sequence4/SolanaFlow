import React from "react";
import { toast } from "sonner";
import { projectApi } from "@/api/projectApi";
import { ProjectContextType, ProjectStateUpdater, SaveProjectResponse } from "@/context/project/ProjectContextTypes";
import { saveProject } from "./saveProject";
import { fetchFilesAndCodes } from "@/utils/codeGeneration/fetchFilesAndCodes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { UxOpenPanel } from "@/context/ux/UxContextTypes";
import { pollTaskStatus4 } from "@/utils/task/taskUtils";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { Step } from '@/context/logs/TaskLogsContext';

export const fetchProjects = async (
    page: number, 
    search: string, 
    setProjects: (projects: any[]) => void, 
    setTotalPages: (totalPages: number) => void, 
    setLoading: (loading: boolean) => void, 
    setError: (error: string | null) => void,
    limit = 3 
) => {
    setLoading(true);
    setError(null);

    try {
      const { data, totalPages } = await projectApi.listProjects(page, limit, search);
      console.log("data", data);
      console.log("totalPages", totalPages);

      setProjects(data);
      setTotalPages(totalPages);
    } catch (err) {
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
};

export function getSafeProjectContext(
  fetched: Partial<ProjectContextType>,
  setProjectState: (stateUpdater: ProjectStateUpdater) => void
): ProjectContextType {
  return {
    id: fetched.id || "",
    name: fetched.name || "",
    description: fetched.description || "",
    containerUrl: fetched.containerUrl || "",
    injectingNodeTypes: fetched.injectingNodeTypes || [],
    details: {
      ...fetched.details,
      setProjectState:
        setProjectState || (() => {}), 
      projectState: {
        mode: fetched.details?.projectState?.mode || "basic",
        nodes: fetched.details?.projectState?.nodes || [],
        edges: fetched.details?.projectState?.edges || [],
        config: fetched.details?.projectState?.config || {},
        instructions: fetched.details?.projectState?.instructions || [],
        projectFiles: fetched.details?.projectState?.projectFiles || { lib: "", mod: "", state: "" },
        fileTree: fetched.details?.projectState?.fileTree || undefined,
        programId: fetched.details?.projectState?.programId || '',
      }
    }
  };
}

export const handleOpenProject = async (
  projectId: string,
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  setFileTree: (tree: FileTreeItemType | null) => void
) => {
  try {
    console.log(`[DEBUG] handleOpenProject - Starting for projectId: ${projectId}`);
    console.log(`[DEBUG] Current projectContext before API call:`, projectContext);
    
    const fetchedDetails = await projectApi.getProjectDetails(projectId);
    console.log(`[DEBUG] fetchedDetails from API:`, fetchedDetails);
    console.log(`[DEBUG] fetchedDetails.containerUrl:`, fetchedDetails.containerUrl);

    const safeProjectContext = getSafeProjectContext(
      fetchedDetails,
      projectContext.details?.setProjectState || (() => {})
    );
    
    console.log(`[DEBUG] safeProjectContext after getSafeProjectContext:`, safeProjectContext);
    console.log(`[DEBUG] safeProjectContext.containerUrl:`, safeProjectContext.containerUrl);

    setProjectContext(safeProjectContext);
    console.log(`[DEBUG] Project context set with safeProjectContext`);

    if (!fetchedDetails.details?.projectState?.fileTree) {
      setFileTree(null);
    } else {
      fetchFilesAndCodes(projectId, safeProjectContext, setProjectContext, setFileTree, false);
    }

    try {
      const containerResult = await projectApi.startContainer(projectId);
      console.log('Container start task initiated:', containerResult.taskId);
    } catch (containerError) {
      console.error('Error starting container:', containerError);
    }
  } catch (err) {
    console.error("Error opening project:", err);
  }
};

export const handleDeleteProject = async (
  projectId: string, 
  page: number, 
  search: string, 
  setProjects: (projects: any[]) => void, 
  setTotalPages: (totalPages: number) => void, 
  setLoading: (loading: boolean) => void, 
  setError: (error: string | null) => void,
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  setFileTree: (fileTree: FileTreeItemType | null) => void,
  setSelectedFile: (file: FileTreeItemType | null) => void
) => {
  try {
    const loadingToast = toast.loading("Deleting Project", {
      description: "Deleting project and cleaning up resources..."
    });
    
    const response = await projectApi.deleteProject(projectId);
    
    if (response.containerTaskId) {
      try {
        const taskStatus = await pollTaskStatus4(response.containerTaskId);
        toast.dismiss(loadingToast);
        
        if (taskStatus === 'succeed' || taskStatus === 'finished') {
          await fetchProjects(page, search, setProjects, setTotalPages, setLoading, setError);
          
          if (projectContext.id === projectId) {
            setProjectContext((prevCtx) => ({
              ...prevCtx,
              id: "",
              name: "",
              description: "",
              details: {
                ...prevCtx.details,
                setProjectState: prevCtx.details?.setProjectState || (() => {}),
                projectState: {
                  mode: "basic",
                  nodes: [],
                  edges: [],
                  config: {},
                  instructions: [],
                  projectFiles: { lib: "", mod: "", state: "" },
                  fileTree: undefined,
                  built: false,
                  deployed: false,
                },
              },
            }));

            setFileTree(null);
            setSelectedFile(null);
          }
          
          toast("Project Deleted", {
            description: "The project was successfully deleted.",
            style: { backgroundColor: "#4ade80", color: "white" }
          });
        } else if (taskStatus === 'warning') {
          toast("Project Partially Deleted", {
            description: "Project was deleted but there may be issues with cleanup.",
            style: { backgroundColor: "#f87171", color: "white" }
          });
          await fetchProjects(page, search, setProjects, setTotalPages, setLoading, setError);
        } else if (taskStatus === 'failed') {
          toast("Project Deletion Issue", {
            description: "Project record was deleted but container cleanup failed.",
            style: { backgroundColor: "#f87171", color: "white" }
          });
          await fetchProjects(page, search, setProjects, setTotalPages, setLoading, setError);
        }
      } catch (pollError: unknown) {
        toast.dismiss(loadingToast);
        console.error("Error polling container removal task:", pollError);
        
        const isTaskNotFoundError = 
          pollError && 
          typeof pollError === 'object' && 
          pollError !== null &&
          'response' in pollError && 
          pollError.response && 
          typeof pollError.response === 'object' &&
          'status' in pollError.response &&
          pollError.response.status === 404;

        if (isTaskNotFoundError) {
          toast("Project Deleted", {
            description: "Project was successfully deleted and resources cleaned up.",
            style: { backgroundColor: "#4ade80", color: "white" }
          });
        } else {
          toast("Project Deletion Status Unknown", {
            description: "Project may have been deleted, but we couldn't confirm resource cleanup.",
            style: { backgroundColor: "#f87171", color: "white" }
          });
        }
        
        await fetchProjects(page, search, setProjects, setTotalPages, setLoading, setError);
        
        if (projectContext.id === projectId) {
          setProjectContext((prevCtx) => ({
            ...prevCtx,
            id: "",
            name: "",
            description: "",
            details: {
              ...prevCtx.details,
              setProjectState: prevCtx.details?.setProjectState || (() => {}),
              projectState: {
                mode: "basic",
                nodes: [],
                edges: [],
                config: {},
                instructions: [],
                projectFiles: { lib: "", mod: "", state: "" },
                fileTree: undefined,
                built: false,
                deployed: false,
              },
            },
          }));

          setFileTree(null);
          setSelectedFile(null);
        }
      }
    } else {
      toast.dismiss(loadingToast);
      await fetchProjects(page, search, setProjects, setTotalPages, setLoading, setError);
      
      if (projectContext.id === projectId) {
        setProjectContext((prevCtx) => ({
          ...prevCtx,
          id: "",
          name: "",
          description: "",
          details: {
            ...prevCtx.details,
            setProjectState: prevCtx.details?.setProjectState || (() => {}),
            projectState: {
              mode: "basic",
              nodes: [],
              edges: [],
              config: {},
              instructions: [],
              projectFiles: { lib: "", mod: "", state: "" },
              fileTree: undefined,
              built: false,
              deployed: false,
            },
          },
        }));

        setFileTree(null);
        setSelectedFile(null);
      }
      
      toast("Project Deleted", {
        description: "The project was successfully deleted.",
        style: { backgroundColor: "#4ade80", color: "white" }
      });
    }
  } catch (error) {
    console.error("Error deleting project:", error);
    toast("Error Deleting Project", {
      description: "Failed to delete project. Please try again.",
      style: { backgroundColor: "#f87171", color: "white" }
    });
  }
};

export const handleProjectClick = async (
  projectId: string, 
  projectName: string,
  onProjectClick: (projectId: string, projectName: string) => void,
  closePopover: () => void
) => {
  onProjectClick(projectId, projectName);
  closePopover();
};

export const projectCreationSteps: Step[] = [
  {
    icon: "Server",
    message: "Preparing container environment...",
    details: "Creating a Docker container and allocating server resources.",
  },
  {
    icon: "Database",
    message: "Saving project metadata...",
    details: "Storing project details (name, description, etc.) in the database.",
  },
  {
    icon: "Code",
    message: "Configuring React App...",
    details: "Running Anchor init and generating the Create React App starter template.",
  },
  {
    icon: "Cpu",
    message: "Initializing Anchor...",
    details: "Running Anchor init and installing dependencies.",
  },
  {
    icon: "HardDrive",
    message: "Verifying environment...",
    details: "Starting the dev server and checking that the project is ready.",
  },
];

export const handleNewProjectClick = (
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  projectContext: ProjectContextType,
  setFileTree: (fileTree: FileTreeItemType | null) => void,
  setSelectedFile?: (file: FileTreeItemType | null) => void,
  setIsCodeReady?: (isCodeReady: boolean) => void
) => {
  setProjectContext({
    id: '',
    name: '',
    description: '',
    details: {
      setProjectState: projectContext.details?.setProjectState || (() => {}),
      projectState: {
        mode: 'basic',
        nodes: [],
        edges: [],
        config: {},
        programId: '',
        instructions: [],
        projectFiles: { lib: '', mod: '', state: '' },
        fileTree: undefined,
      },
    },
  });

  setFileTree(null);
  if (setSelectedFile) setSelectedFile(null);
  if (setIsCodeReady) setIsCodeReady(false);
  localStorage.removeItem('projectContext');
};

interface TaskLogActions {
    setSteps: (steps: Step[]) => void;
    setProgress: (progress: number) => void;
    setIsVisible: (isVisible: boolean) => void;
    addSystemLog: (log: string) => void;
    resetLogs: () => void;
}

export const handleConfirmNewProject = async (
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  localProjectName: string,
  localProjectDescription: string,
  projectsRefreshCounter: number,
  setProjectsRefreshCounter: (n: number) => void,
  setUxOpenPanel: (panel: UxOpenPanel) => void,
  setFileTree: (tree: FileTreeItemType | null) => void,
  setSelectedFile: (file: FileTreeItemType | null) => void,
  taskLogs?: TaskLogActions
) => {
  console.log(`[DEBUG_PROJECT_CONFIRM] Starting handleConfirmNewProject for project name=${localProjectName}`);
  
  if (!taskLogs) {
      console.warn("TaskLogs not provided to handleConfirmNewProject. Progress UI will not display.");
      return;
  }

  taskLogs.setProgress(0);
  const initialSteps = [...projectCreationSteps]; 
  taskLogs.setSteps(initialSteps);
  taskLogs.setIsVisible(true);
  taskLogs.addSystemLog(`Creating new project: ${localProjectName}...`);
  let success = false;
  await new Promise(resolve => setTimeout(resolve, 15000));
  try {
    taskLogs.setProgress(20); 
    taskLogs.addSystemLog("Preparing container environment...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const newContext: ProjectContextType = {
      id: "", 
      name: localProjectName,
      description: localProjectDescription,
      details: {
        setProjectState: projectContext.details?.setProjectState || (() => {}),
        projectState: {
          mode: "basic",
          nodes: [],
          edges: [],
          config: {},
          instructions: [],
          projectFiles: { lib: "", mod: "", state: "" },
          fileTree: undefined,
        },
      },
    };
    setProjectContext(newContext);
    setFileTree(null);
    setSelectedFile(null);
    taskLogs.addSystemLog("Local context initialized.");

    taskLogs.setProgress(40); 
    taskLogs.addSystemLog("Saving project metadata...");
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    const saveResponse: SaveProjectResponse | null = await saveProject(newContext, setProjectContext);
    if (!saveResponse || !saveResponse.project?.id) {
      throw new Error("Failed to save project metadata.");
    }
    taskLogs.addSystemLog(`Metadata saved (Project ID: ${saveResponse.project.id}).`);
    const backendTaskId = saveResponse.directoryTask?.taskId;

    taskLogs.setProgress(60); 
    taskLogs.addSystemLog("Initializing base code (Backend Task)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    if (backendTaskId) {
      taskLogs.addSystemLog(`Backend task started (ID: ${backendTaskId}). Monitoring...`);
      try {
        const finalStatus = await pollTaskStatus4(backendTaskId);
        
        if (finalStatus === 'succeed' || finalStatus === 'finished') {
          taskLogs.addSystemLog("Backend tasks (Code Init, Deps Install, Verification) completed successfully.");
          success = true; 
        } else if (finalStatus === 'warning') {
          taskLogs.addSystemLog("Backend tasks completed with warnings.");
          success = true; 
        } else {
          throw new Error(`Backend task failed with status: ${finalStatus}`);
        }
      } catch (pollError) {
        throw pollError; 
      }
    } else {
      taskLogs.addSystemLog("No backend task ID. Assuming local setup suffices.");
      success = true;
    }

    if(success){
        taskLogs.setProgress(80);
        taskLogs.addSystemLog("Backend processing finished.");
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    setProjectsRefreshCounter(projectsRefreshCounter + 1);
    
    if (success) {
       const successStep: Step = {
          icon: "CheckCircle", 
          message: "Project created successfully!",
          details: "All steps completed. Your project is ready."
       };
       taskLogs.setSteps([...initialSteps, successStep]); 
       taskLogs.setProgress(100); 
       taskLogs.addSystemLog("Project creation finalized!");
    } else {
       taskLogs.setProgress(100);
       taskLogs.addSystemLog("Project creation failed before finalization step.");
    }

  } catch (error) {
    console.error("Failed to create new project:", error);
    taskLogs.addSystemLog(`Error during project creation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    taskLogs.setProgress(100);
    success = false; 
  } finally {
    if (taskLogs) {
       await new Promise(resolve => setTimeout(resolve, success ? 3000 : 4000)); 
       taskLogs.setIsVisible(false);
    }
  }
};

export const handleSaveClick = async (
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  projectsRefreshCounter: number,
  setProjectsRefreshCounter: (n: number) => void
) => {
    try {
      await toast.promise(
        saveProject(projectContext, setProjectContext),
        {
          loading: "Saving project...",
          success: "Project updated successfully",
          error: "Failed to update project"
        }
      );
      setProjectsRefreshCounter(projectsRefreshCounter + 1);
    } catch (err) {
      console.error("Error saving project:", err);
  }
};