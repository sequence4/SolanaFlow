import { api } from './apiHelper';
import { 
  SaveProjectResponse, 
  ProjectContextToSave, 
  ListProjectsResponse,
  ProjectContextType,
} from '../context/project/ProjectContextTypes';
import { TaskResponse } from './interfaces/Task';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;   // we *expect* it

/* ensure every URL we store ends in `/dapp/<projectId>`  */
const withDappPath = (url: string | undefined, projectId: string): string => {
  if (!url) return "";
  return url.includes("/dapp/") ? url : `${url.replace(/\/$/, "")}/dapp/${projectId}`;
};

export const projectApi = {

  runCommand: async (
    command: string,
    cwd: string
  ): Promise<{
    message: string;
    command: string;
    cwd: string;
    taskId: string;
    output: string;
  }> => {
    try {
      const response = await api.post('/projects/run-command', { command, cwd });
      return response.data;
    } catch (error) {
      console.error('Error running command:', error);
      throw error;
    }
  },

  /* ──────────────────────────────────────────────────────────────────────
     NOTE: every project route is mounted at `/projects` on the server.
     The "/org/projects" suffix lives *inside* that router.        */
  listProjects: async (page = 1, limit = 10, search?: string)
  : Promise<{ data: any[]; totalPages: number }> => {
    try {
      const resp = await axios.get(`${API_BASE}/projects/org/projects`, {
        params: { page, limit, search },
      });

      // ── normalise every possible server reply shape ───────────────
      const payload = resp.data ?? {};                   // axios .data

      // If server returned an *array* directly, wrap it
      if (Array.isArray(payload)) {
        return { data: payload, totalPages: 1 };
      }

      // Otherwise expect { data: … , totalPages: … }
      return {
        data:      payload.data      ?? [],
        totalPages: payload.totalPages ?? 1,
      };
    } catch (error) {
      console.error('Error listing projects:', error);
      return { data: [], totalPages: 1 }; // Fail gracefully
    }
  },

  startContainer: async (projectId: string): Promise<{ message: string; taskId: string }> => {
    try {
      console.log(`[DEBUG_API] startContainer - Starting container for projectId: ${projectId}`);
      const response = await api.post(`/projects/${projectId}/start-container`);
      console.log(`[DEBUG_API] startContainer - Response:`, response.data);
      return response.data;
    } catch (err) {
      console.error('[DEBUG_API] Error starting container:', err);
      if (axios.isAxiosError(err) && err.response?.status === 503) {
        console.error('All workers busy - try again in a minute');
      } else {
        console.error('Container start failed:', 
          axios.isAxiosError(err) ? err.response?.data?.message : "Unknown error"
        );
      }
      throw err;
    }
  },

  async compileTs(tsFileName: string): Promise<{ jsContent: string; message: string }> {
    const response = await api.post('/projects/compile-ts', { tsFileName });
    return response.data;
  },

  createProject: async (
    projectInfo: ProjectContextToSave
  ): Promise<SaveProjectResponse> => {
    try {
      console.log(`[DEBUG_API] createProject - Creating project:`, {
        name: projectInfo.name,
        description: projectInfo.description ? projectInfo.description.substring(0, 20) + '...' : 'none'
      });
      const response = await api.post('/projects/create', projectInfo);
      console.log(`[DEBUG_API] createProject - Response:`, {
        message: response.data.message,
        projectId: response.data.project?.id
      });
      return response.data;
    } catch (error) {
      console.error('[DEBUG_API] Error creating project:', error);
      throw error;
    }
  },

  updateProject: async (
    projectId: string,
    projectContext: ProjectContextToSave
  ): Promise<SaveProjectResponse> => {
    try {
      const response = await api.put(`/projects/update/${projectId}`, projectContext);
      return response.data;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  getProjectDetails: async (projectId: string): Promise<ProjectContextType> => {
    try {
      console.log(`[DEBUG_API] getProjectDetails - Fetching project details for ID: ${projectId}`);
      const response = await api.get(`/projects/details/${projectId}`);
      
      console.log(`[DEBUG_API] getProjectDetails - Raw API response status: ${response.status}, statusText: ${response.statusText}`);
      console.log(`[DEBUG_API] getProjectDetails - Raw API response data:`, response.data);
      
      if (response.data.project.container_url) {
        const raw = response.data.project.container_url;
        response.data.project.containerUrl = withDappPath(raw, projectId);
        delete response.data.project.container_url;
      } else if (response.data.project.containerUrl) {
        response.data.project.containerUrl = withDappPath(response.data.project.containerUrl, projectId);
      } else {
        console.log(`[DEBUG_API] getProjectDetails - No container_url or containerUrl found in response`);
      }
      
      console.log(`[DEBUG_API] getProjectDetails - Final project object with containerUrl: "${response.data.project.containerUrl || 'undefined'}"`);
      return response.data.project;
    } catch (error) {
      console.error('[DEBUG_API] Error getting project details:', error);
      throw error;
    }
  },

  getProjectRootPath: async (projectId: string): Promise<string> => {
    try {
      const response = await api.get(`/projects/root-path/${projectId}`);
      return response.data.rootPath;
    } catch (error) {
      console.error('Error getting project root path:', error);
      throw error;
    }
  },

  deleteProject: async (projectId: string): Promise<TaskResponse> => {
    try {
      const response = await api.delete(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },

  runFunction: async (
    projectId: string, 
    functionName: string,
    parameters: any[],
    ephemeralPubkey?: string
  ): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/run-script`, {
        functionName,
        parameters,
        ephemeralPubkey
      });
      return response.data;
    } catch (error) {
      console.error('Error running function:', error);
      throw error;
    }
  },

  initAnchorProject: async (
    projectId: string, 
    projectName: string,
  ): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/init`, { projectId, projectName });
      return response.data;
    } catch (error) {
      console.error('Error initializing Anchor project:', error);
      throw error;
    }
  },

  setCluster: async (projectId: string): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/set-cluster`);
      return response.data;
    } catch (error) {
      console.error('Error setting cluster:', error);
      throw error;
    }
  },

  buildProject: async (projectId: string): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/build`);
      return response.data;
    } catch (error) {
      console.error('Error building project:', error);
      throw error;
    }
  },

  getBuildArtifact: async (projectId: string): Promise<{ status: string, base64So: string }> => {
    try {
      const response = await api.get(`/projects/${projectId}/build-artifact`);
      return response.data;
    } catch (error) {
      console.error('Error getting build artifact:', error);
      throw error;
    }
  },

  /**
   * POST the 64-byte secret key array so the backend can register the keypair.
   * Returns the new ephemeral pubkey and the program's secret key if available.
   * If no secretKey provided, attempts to use the Anchor-generated program keypair.
   */
  createEphemeral: async (
    projectId: string,
    secretKey?: number[]
  ): Promise<{ ephemeralPubkey: string; secretKey?: number[] }> => {
    try {
      const body = secretKey ? { secretKey } : {};
      const response = await api.post(`/projects/${projectId}/ephemeral`, body);
      const data = response.data;
      return {
        ephemeralPubkey: data.pubkey ?? data.ephemeralPubkey,
        secretKey: data.secretKey
      };
    } catch (err) {
      console.error('Error creating ephemeral:', err);
      throw err;
    }
  },

  deployProject: async (projectId: string): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/deploy`);
      return response.data;
    } catch (error) {
      console.error('Error deploying project:', error);
      throw error;
    }
  },

  deployProjectEphemeral: async (projectId: string, ephemeralPubkey: string): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/deploy-ephemeral`, {
        ephemeralPubkey
      });
      return response.data;
    } catch (error) {
      console.error('Error deploying project with ephemeral key:', error);
      throw error;
    }
  },

  runProjectCommand: async (
    projectId: string,
    commandType: 'anchor clean' | 'cargo clean'
  ): Promise<{ message: string; taskId: string }> => {
    try {
      const response = await api.post(`/projects/${projectId}/run-command`, {
        commandType,
      });
      return response.data;
    } catch (error) {
      console.error('Error running project command:', error);
      throw error;
    }
  },

  installPackages: async (projectId: string): Promise<TaskResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/install-packages`);
      return response.data;
    } catch (error) {
      console.error('Error installing npm packages:', error);
      throw error;
    }
  },

  installNodeDependencies: async (
    projectId: string,
    packages: string[]
  ): Promise<TaskResponse> => {
    try {
      console.log(`Installing dependencies for project ${projectId}:`);
      console.log(`Packages to install: ${JSON.stringify(packages)}`);
      
      const response = await api.post(
        `/projects/${projectId}/install-node-dependencies`,
        { packages }
      );
      
      console.log(`Install dependencies API response:`, response.data);
      return response.data;
    } catch (error) {
      console.error('Error installing node dependencies:', error);
      throw error;
    }
  },

  fetchContainerUrl: async (projectId: string): Promise<{ containerUrl: string }> => {
    try {
      console.log(`[DEBUG_API] fetchContainerUrl - Fetching container URL for project: ${projectId}`);
      const response = await api.get(`/projects/${projectId}/container-url`);
      console.log(`[DEBUG_API] fetchContainerUrl - Response:`, response.data);
      const raw  = response.data.containerUrl || response.data.container_url;
      const full = withDappPath(raw, projectId);
      return { containerUrl: full };
    } catch (error) {
      console.error('[DEBUG_API] Error fetching container URL:', error);
      throw error;
    }
  },
  
  /** Get the deterministic **secret** keypair generated during build. */
  getProgramKeypair: async (projectId: string): Promise<{ secretKey: number[] }> => {
    try {
      const response = await api.get(`/projects/${projectId}/program-keypair`);
      return response.data;                   // { secretKey: [...] }
    } catch (error) {
      console.error('Error getting program keypair:', error);
      throw error;
    }
  },

  /**
   * Persist the freshly‑generated 64‑byte secret key so later builds
   * (and other team‑members) can upgrade the same program ID.
   */
  saveProgramKeypair: async (
    projectId: string,
    secretKey: number[],
  ) => {
    return api.post(
      `/projects/${projectId}/program-keypair`,
      { secretKey },
    );
  },

  /** Fetch the existing **public** program ID (no secret key). */
  getProgramId: async (projectId: string): Promise<{ programId: string }> => {
    try {
      const response = await api.get(`/projects/${projectId}/program-id`);
      return response.data;                       // { programId: "..." }
    } catch (error) {
      console.error('Error getting program ID:', error);
      throw error;
    }
  },

};