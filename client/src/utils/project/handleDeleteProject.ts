import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { toast } from "sonner";
import { fetchProjects } from "./fetchProjects";
import { pollTaskStatus4 } from "../task/taskUtils";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { projectApi } from "@/api/projectApi";

export const handleDeleteProject = async (
    projectId: string, 
    page: number, 
    search: string, 
    setProjects: (projects: unknown[]) => void, 
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
                    nodes: [],
                    edges: [],
                    config: {},
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
                  nodes: [],
                  edges: [],
                  config: {},
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
                nodes: [],
                edges: [],
                config: {},
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