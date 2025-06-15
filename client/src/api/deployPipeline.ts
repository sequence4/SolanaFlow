import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';
import { API_URL } from '@/config/api';
import { useTaskLogs } from '@/context/logs/useTaskLogs';

export function deployPipeline(
  projectId: string,
  graph: unknown,
  onProgress: (msg: unknown) => void,
  walletSigned = true,
) {
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
  
  // Get taskLogs from the context
  const taskLogs = window.__taskLogsRef?.current;
  
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

        // 🚀 new: UI is ready – hide spinner, mount iframe, show explorer
        if (msg.stage === "ui-ready" && taskLogs) {
          taskLogs.updateStage("ui-ready", msg);
        }

        // 📦 new: build has actually begun (good place to start a progress bar)
        if (msg.stage === "build-started" && taskLogs) {
          taskLogs.updateStage("build-started");
        }

        onProgress(msg);
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
