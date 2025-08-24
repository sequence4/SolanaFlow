import { API_URL } from "@/config/api";

// Helper function to get auth token
function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Helper function for API calls
async function apiCall(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// Local validator functions
export const startLocalValidator = (projectId: string, data: { walletPubkey?: string; reset?: boolean }) =>
  apiCall(`/api/projects/${projectId}/local-validator/start`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const stopLocalValidator = (projectId: string) =>
  apiCall(`/api/projects/${projectId}/local-validator/stop`, {
    method: "POST",
  });

export const getLocalValidatorStatus = (projectId: string) =>
  apiCall(`/api/projects/${projectId}/local-validator/status`);

export const getLocalValidatorHealth = (projectId: string) =>
  apiCall(`/api/projects/${projectId}/local-validator/health`);

export const deployToLocalValidator = (projectId: string, data: { forceRebuild?: boolean; walletPubkey?: string }) =>
  apiCall(`/api/projects/${projectId}/local-validator/deploy`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const quickDeployLocal = (projectId: string, data: { walletPubkey?: string; resetValidator?: boolean }) =>
  apiCall(`/api/projects/${projectId}/local-validator/quick-deploy`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getClusterInfo = (projectId: string, preferLocal?: boolean) =>
  apiCall(`/api/projects/${projectId}/cluster-info${preferLocal ? '?preferLocal=true' : ''}`);

export const switchCluster = (projectId: string, data: { cluster: string; customUrl?: string }) =>
  apiCall(`/api/projects/${projectId}/switch-cluster`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// Export as projectApi object for consistency
export const projectApi = {
  startLocalValidator,
  stopLocalValidator,
  getLocalValidatorStatus,
  getLocalValidatorHealth,
  deployToLocalValidator,
  quickDeployLocal,
  getClusterInfo,
  switchCluster,
};