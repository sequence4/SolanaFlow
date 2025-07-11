import { API_URL } from "@/config/api";

/** Downloads the compiled .so for a project and returns it as an ArrayBuffer */
export async function downloadArtifact(projectId: string): Promise<ArrayBuffer> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_URL}/api/projects/${projectId}/artifact`, {
    method: "GET",
    headers: {
      Accept: "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching artifact`);

  return res.arrayBuffer();   // returns raw binary for further processing
} 