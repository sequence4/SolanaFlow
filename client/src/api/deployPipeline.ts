import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9999';

export async function deployPipeline(
  projectId: string,
  graph: unknown,
  onProgress: (msg: unknown) => void,
): Promise<void> {
  console.log(`[SSE] Starting deploy pipeline for project: ${projectId}`);
  console.log(`[SSE] API_URL: ${API_URL}`);
  
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  console.log(`[SSE] Headers prepared, auth token ${token ? 'present' : 'missing'}`);

  await fetchEventSource(`${API_URL}/projects/${projectId}/deploy-pipeline`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ graph }),

    async onopen(res) {
      console.log(`[SSE] Connection opened with status: ${res.status}`);
      if (res.status >= 400)
        throw new Error(`HTTP ${res.status} while opening SSE`);
    },

    onmessage(ev: EventSourceMessage) {
      const msg = JSON.parse(ev.data);
      console.log(`[SSE] Received message:`, msg);
      onProgress(msg);
    },

    onerror(err) {
      console.error(`[SSE] Error in connection:`, err);
      throw err;
    },
  });
  
  console.log(`[SSE] Deploy pipeline completed for project: ${projectId}`);
}
