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
  
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const url = `${API_URL}/api/deploy/${projectId}/deploy-pipeline`;
  
  const controller = new AbortController();
  
  fetchEventSource(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ graph, walletSigned }),
    signal: controller.signal,
    openWhenHidden: true,
    
    async onopen(response) {
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} while opening SSE`);
      }
    },
    
    onmessage(event: EventSourceMessage) {
      try {
        if (!event.data || event.data.trim() === '') {
          return;
        }
        
        const msg = JSON.parse(event.data);
        eventBus.emit('progress', msg);
        
        if (msg.type === 'code-generation' && msg.files) {
          eventBus.emit('code-generation', msg);
        }
        
        if (onProgress) {
          onProgress(msg);
        }
      } catch (error) {
        console.error(`[SSE] Error parsing message:`, error, 'Raw data:', event.data);
      }
    },
    
    onerror(err) {
      console.error(`[SSE] Error in connection:`, err);
    },
    
    onclose() {
      console.log(`[SSE] Connection closed`);
    },
  });
  
  return {
    close: () => {
      console.log(`[SSE] Manually closing connection`);
      controller.abort();
    },
    addEventListener: (event: string) => {
      if (event === 'close') {
      }
    }
  };
}
