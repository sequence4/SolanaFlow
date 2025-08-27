import { api } from './apiHelper';
import { 
  SaveProjectResponse, 
  ProjectContextToSave,
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
      const response = await api.post(`/projects/${projectId}/start-container`);
      return response.data;
    } catch (err) {
      console.error('Error starting container:', err);
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
      const response = await api.post('/projects/create', projectInfo);
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
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
      const response = await api.get(`/projects/details/${projectId}`);
      
      
      if (response.data.project.container_url) {
        const raw = response.data.project.container_url;
        response.data.project.containerUrl = withDappPath(raw, projectId);
        delete response.data.project.container_url;
      } else if (response.data.project.containerUrl) {
        response.data.project.containerUrl = withDappPath(response.data.project.containerUrl, projectId);
      } else {
      }
      
      return response.data.project;
    } catch (error) {
      console.error('Error getting project details:', error);
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
   * Create an ephemeral keypair on the server side.
   * Returns the public key of the generated keypair.
   */
  createEphemeral: async (projectId: string): Promise<{ pubkey: string }> => {
    try {
      const { data } = await api.post(`/projects/${projectId}/ephemeral`);
      return data as { pubkey: string };
    } catch (err) {
      console.error('Error creating ephemeral:', err);
      throw err;
    }
  },

  deployProject: async (
    projectId: string,
    walletPubkey: string,
    bufferAuthority: string
  ): Promise<{ success: boolean; programId: string }> => {
    try {
      const { data } = await api.post(`/projects/${projectId}/deploy`, {
        walletPubkey,
        bufferAuthority,
      });
      return data as { success: boolean; programId: string };
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

  /**
   * Relay a partially signed deploy transaction to the backend.
   * The backend will load the program keypair, sign the transaction, broadcast it,
   * and return the final signature and programId.
   */
  relayTx: async (
    projectId: string,
    payload: { encodedTx: string; programId: string }
  ): Promise<{ signature: string } | { code: 'WALLET_SIGNATURE_REQUIRED'; txBase64: string; missing: string[]; reason?: string; noncePubkey?: string } > => {
    try {
      const response = await api.post(`/projects/${projectId}/relay-tx`, payload, { validateStatus: () => true });
      if (response.status === 409) return response.data;
      if (response.status >= 200 && response.status < 300) return response.data;
      throw new Error(`relay-tx failed: ${response.status} ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.error('Error relaying transaction:', error);
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

  // Local validator functions
  startLocalValidator: async (projectId: string, data: { walletPubkey?: string; reset?: boolean }) => {
    try {
      const response = await api.post(`/projects/${projectId}/local-validator/start`, data);
      return response.data;
    } catch (error) {
      console.error('Error starting local validator:', error);
      throw error;
    }
  },

  stopLocalValidator: async (projectId: string) => {
    try {
      const response = await api.post(`/projects/${projectId}/local-validator/stop`);
      return response.data;
    } catch (error) {
      console.error('Error stopping local validator:', error);
      throw error;
    }
  },

  getLocalValidatorStatus: async (projectId: string) => {
    try {
      const response = await api.get(`/projects/${projectId}/local-validator/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting local validator status:', error);
      throw error;
    }
  },

  getLocalValidatorHealth: async (projectId: string) => {
    try {
      const response = await api.get(`/projects/${projectId}/local-validator/health`);
      return response.data;
    } catch (error) {
      console.error('Error getting local validator health:', error);
      throw error;
    }
  },

  deployToLocalValidator: async (projectId: string, data: { forceRebuild?: boolean; walletPubkey?: string }) => {
    try {
      const response = await api.post(`/projects/${projectId}/local-validator/deploy`, data);
      return response.data;
    } catch (error) {
      console.error('Error deploying to local validator:', error);
      throw error;
    }
  },

  quickDeployLocal: async (projectId: string, data: { walletPubkey?: string; resetValidator?: boolean }) => {
    try {
      const response = await api.post(`/projects/${projectId}/local-validator/quick-deploy`, data);
      return response.data;
    } catch (error) {
      console.error('Error quick deploying to local:', error);
      throw error;
    }
  },

  getClusterInfo: async (projectId: string, preferLocal?: boolean) => {
    try {
      const response = await api.get(`/projects/${projectId}/cluster-info${preferLocal ? '?preferLocal=true' : ''}`);
      return response.data;
    } catch (error) {
      console.error('Error getting cluster info:', error);
      throw error;
    }
  },

  switchCluster: async (projectId: string, data: { cluster: string; customUrl?: string }) => {
    try {
      const response = await api.post(`/projects/${projectId}/switch-cluster`, data);
      return response.data;
    } catch (error) {
      console.error('Error switching cluster:', error);
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
      //console.log(`Installing dependencies for project ${projectId}:`);
      //console.log(`Packages to install: ${JSON.stringify(packages)}`);
      
      const response = await api.post(
        `/projects/${projectId}/install-node-dependencies`,
        { packages }
      );
      
     // console.log(`Install dependencies API response:`, response.data);
      return response.data;
    } catch (error) {
      console.error('Error installing node dependencies:', error);
      throw error;
    }
  },

  fetchContainerUrl: async (projectId: string): Promise<{ containerUrl: string }> => {
    try {
      const response = await api.get(`/projects/${projectId}/container-url`);
      const raw  = response.data.containerUrl || response.data.container_url;
      const full = withDappPath(raw, projectId);
      return { containerUrl: full };
    } catch (error) {
      // Only surface "not found" errors in development (for debugging)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        if (process.env.NODE_ENV === 'development') {
        }
        return { containerUrl: "" };
      } else {
        console.error('Error fetching container URL:', error);
        throw error;
      }
    }
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

  relaySignedTx: async (
    projectId: string,
    encodedTx: string,
    programId: string,
    taskId?: string,
    serverSignFor?: string[],
  ): Promise<
    { signature: string; programId: string } |
    { code: 'WALLET_SIGNATURE_REQUIRED'; txBase64: string; missing: string[] }
  > => {
    const response = await api.post(
      `/projects/${projectId}/relay-signed-tx`,
      { encodedTx, programId, ...(taskId ? { taskId } : {}), ...(serverSignFor?.length ? { serverSignFor } : {}) },
      { validateStatus: () => true }
    );
    if (response.status === 409) return response.data;
    if (response.status >= 200 && response.status < 300) return response.data;
    const err = new Error(`relaySignedTx failed: ${response.status} ${JSON.stringify(response.data)}`);
    console.error('Error relaying signed transaction:', err);
    throw err;
  },

  /**
   * Ask backend to sign & send using an ephemeral server-held key.
   */
  relayEphemeralTx: async (
    projectId: string,
    encodedTx: string,
    programId: string,
    ephemeralPubkey: string,
  ): Promise<{ signature?: string } | { code: 'WALLET_SIGNATURE_REQUIRED'; txBase64: string; missing: string[] }> => {
    const response = await api.post(
      `/projects/${projectId}/relay-tx`,
      { encodedTx, programId, signerHint: { type: 'ephemeral', pubkey: ephemeralPubkey } },
      { validateStatus: () => true }
    );
    if (response.status === 409) return response.data;
    if (response.status >= 200 && response.status < 300) return response.data;
    throw new Error(`relayEphemeralTx failed: ${response.status} ${JSON.stringify(response.data)}`);
  },

  relayDeployTx: async (
    projectId: string,
    payload: { encodedTx: string; programId: string }
  ): Promise<{ signature: string }> => {
    try {
      const response = await api.post(`/projects/${projectId}/relayDeployTx`, payload);
      return response.data;
    } catch (error) {
      console.error('Error relaying deploy transaction:', error);
      throw error;
    }
  },

  /** Durable‑nonce helper */
  getNonce: async (
    projectId: string,
    walletPubkey: string,
  ): Promise<{ noncePubkey: string; nonceHash: string }> => {
    try {
      const response = await api.post(`/projects/${projectId}/nonce`, { walletPubkey }, { validateStatus: () => true });
      if (response.status === 409) return response.data; // WALLET_SIGNATURE_REQUIRED for nonce creation
      if (response.status >= 200 && response.status < 300) return response.data;
      throw new Error(`nonce failed: ${response.status} ${JSON.stringify(response.data)}`);
    } catch (error) {
      /* Keep the original AxiosError so callers can read
       * `error.response.status`.  Converting to a plain Error removes
       * that field and breaks the fallback that creates the nonce. */
      throw error;                // propagate anything else
    }
  },
  
  getProjectPorts: async (projectId: string): Promise<{ data: { rpc: number; ws: number; faucet: number } }> => {
    try {
      const response = await api.get(`/projects/${projectId}/ports`);
      return response;
    } catch (error) {
      console.error('Error getting project ports:', error);
      throw error;
    }
  },

};