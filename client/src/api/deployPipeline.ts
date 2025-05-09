import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9999';

export async function deployPipeline(
  projectId: string,
  graph: unknown,
  onProgress: (msg: unknown) => void,
): Promise<void> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  await fetchEventSource(`${API_URL}/projects/${projectId}/deploy-pipeline`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ graph }),

    async onopen(res) {
      if (res.status >= 400)
        throw new Error(`HTTP ${res.status} while opening SSE`);
    },

    onmessage(ev: EventSourceMessage) {
      onProgress(JSON.parse(ev.data));
    },

    onerror(err) {
      throw err;
    },
  });
}
