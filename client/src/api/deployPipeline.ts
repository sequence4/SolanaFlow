import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';
import { API_URL } from '@/config/api';
import eventBus from '@/lib/eventBus';

export function deployPipeline(
  projectId: string,
  graph: unknown,
  onProgress: (msg: unknown) => void,
  walletSigned = true,
) {
  if (!projectId) throw new Error("deployPipeline called without projectId");
  console.log(`[SSE] Starting deploy pipeline for project: ${projectId}`);
  console.log(`[SSE] API_URL: ${API_URL}`);
  
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  console.log(`[SSE] Headers prepared, auth token ${token ? 'present' : 'missing'}`);

  const url = `${API_URL}/api/deploy/${projectId}/deploy-pipeline`;
  
  const controller = new AbortController();
  
  fetchEventSource(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ graph, walletSigned }),
    signal: controller.signal,
    
    async onopen(response) {
      console.log(`[SSE] Connection opened with status: ${response.status}`);
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} while opening SSE`);
      }
    },
    
    onmessage(event: EventSourceMessage) {
      try {
        const msg = JSON.parse(event.data);
        console.log(`[SSE] Received message:`, msg);
        eventBus.emit('progress', msg);
        if (onProgress) {
          onProgress(msg);
        }
      } catch (error) {
        console.error(`[SSE] Error parsing message:`, error);
      }
    },
    
    onerror(err) {
      console.error(`[SSE] Error in connection:`, err);
    },
    
    onclose() {
      console.log(`[SSE] Connection closed`);
    },
  });
  
  console.log(`[SSE] EventSource created for project: ${projectId}`);
  
  // Return an object with the same interface as EventSource for compatibility
  return {
    close: () => {
      console.log(`[SSE] Manually closing connection`);
      controller.abort();
    },
    addEventListener: (event: string, handler: EventListener) => {
      // This is a minimal implementation to match the interface
      if (event === 'close') {
        // We can't really add listeners to the fetch stream,
        // but this will be called from our wrapper code
      }
    }
  };
}
