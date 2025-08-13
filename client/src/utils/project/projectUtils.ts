import React from "react";
import { toast } from "sonner";
import { projectApi } from "@/api/projectApi";
import { ensureId } from '@/utils/project/ensureId';
import { ProjectContextType, ProjectStateUpdater, SaveProjectResponse } from "@/context/project/ProjectContextTypes";
import { saveProject } from "./saveProject";
import { fetchFilesAndCodes } from "@/utils/files/fetchFilesAndCodes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { UxOpenPanel } from "@/context/ux/UxContextTypes";
import { pollTaskStatus4 } from "@/utils/task/taskUtils";
import { Step } from '@/context/logs/TaskLogsContext';
import { useTaskLogs } from "@/context/logs/useTaskLogs";

export const PROJECTS_PAGE_SIZE = 10;

export const fetchProjects = async (
    page: number, 
    search: string, 
    setProjects: (projects: any[]) => void, 
    setTotalPages: (totalPages: number) => void, 
    setLoading: (loading: boolean) => void, 
    setError: (error: string | null) => void,
    limit = PROJECTS_PAGE_SIZE 
) => {
    setLoading(true);
    setError(null);

    try {
      const { data: list, totalPages } = 
        await projectApi.listProjects(page, limit, search);

      console.log('projects-list', list);
      console.log('totalPages', totalPages);

      // Guard against accidental "limit=0/1" regressions
      if (list.length === 1 && totalPages > 1) {
        console.warn(
          'Project list fetched only one item – check limit parameter in fetchProjects'
        );
      }

      setProjects(list);                 // safe: always an array now
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
        nodes: fetched.details?.projectState?.nodes || [],
        edges: fetched.details?.projectState?.edges || [],
        programId: fetched.details?.projectState?.programId || '',
        built: fetched.details?.projectState?.built || false,
        deployed: fetched.details?.projectState?.deployed || false,
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
        built: false,
        deployed: false,
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
  name: string,
  description: string,
  projectsRefreshCounter: number,
  setProjectsRefreshCounter: React.Dispatch<React.SetStateAction<number>>,
  setUxOpenPanel: (p: string) => void,
  setFileTree: any,
  setSelectedFile: any,
  taskLogs: ReturnType<typeof useTaskLogs>,
) => {
  try {
    /* ------------------------------------------------------------------
     * 1. Optimistic local update (instant UX feedback)
     * ------------------------------------------------------------------ */
    setProjectContext(prev => ({              // no DB traffic yet
      ...prev,
      name,
      description,
    }));

    /* ------------------------------------------------------------------
     * 2. Ensure we have a DB id (cheap INSERT if missing)
     * ------------------------------------------------------------------ */
    const id = await ensureId(projectContext, setProjectContext);
    console.log(`[DEBUG_PROJECT_CONFIRM] ensured id=${id}`);

    /* ------------------------------------------------------------------
     * 3. Persist metadata only when we already have something meaningful
     *    to save.  Right after the very first CREATE the projectState
     *    object is still empty – a PUT would be pointless traffic.
     * ------------------------------------------------------------------ */
    const state = projectContext.details?.projectState;
    const hasMeaningfulState =
      !!state &&
      Object.keys(state).some(
        k => Array.isArray((state as any)[k])
          ? (state as any)[k].length            // non-empty array
          : (state as any)[k] !== undefined     // any other truthy value
      );

    if (hasMeaningfulState) {
      await saveProject({ ...projectContext, id, name, description }, setProjectContext);
    }

    /* House-keeping */
    setProjectsRefreshCounter(c => c + 1);
    setUxOpenPanel('workflow');
  } catch (err) {
    console.error('[handleConfirmNewProject] fatal:', err);
    taskLogs.addSystemLog(`❌ Failed to create new project: ${String(err)}`);
    throw err;                                 // let caller toast the error
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