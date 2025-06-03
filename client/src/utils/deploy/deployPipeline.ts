import { deployPipeline as sseDeploy } from '@/api/deployPipeline';
import { ProjectContextType } from '@/context/project/ProjectContextTypes';

export function runDeployPipelineWithLogs(
  projectContext: ProjectContextType,
  graph: unknown,
  taskLogs: {
    setIsVisible: (v: boolean) => void;
    addSystemLog: (msg: string) => void;
    resetLogs: () => void;
    updateStage: (stage: string) => void;
  },
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  setArtifactUrl?: (url: string) => void,
  onComplete?: (status?: 'error') => void,
) {
  
  taskLogs.resetLogs();
  taskLogs.setIsVisible(true);
  taskLogs.addSystemLog("🚀 Starting deployment pipeline...");

  const update = (msg: any) => {
    console.log(`[deployPipeline] Received update from SSE:`, msg);
    taskLogs.addSystemLog(JSON.stringify(msg));

    if (msg.stage) {
      taskLogs.updateStage(msg.stage);
    }

    if (msg.containerUrl) {
      console.log(`[deployPipeline] Received containerUrl: ${msg.containerUrl}`);
      taskLogs.addSystemLog(`🌐 Container URL: ${msg.containerUrl}`);
      setProjectContext(prev => ({ ...prev, containerUrl: msg.containerUrl }));
    }

    if (msg.artifact) {
      try {
        const binary  = atob(msg.artifact as string);
        const bytes   = Uint8Array.from(binary, c => c.charCodeAt(0));
        const blob    = new Blob([bytes], { type: "application/octet-stream" });
        const url     = URL.createObjectURL(blob);

        taskLogs.addSystemLog(`🗄️  Build artefact ready – click to download`);
        if (setArtifactUrl) setArtifactUrl(url);
      } catch (err) {
        console.error("[deployPipeline] failed to decode artefact:", err);
        taskLogs.addSystemLog("⚠️  Unable to create download link for artefact");
      }
    }

    if (msg.stage === 'deploy-done' || msg.stage === 'done' || msg.stage === 'completed') {
      taskLogs.addSystemLog("✅ Deployment complete!");
      if (es) {
        es.close();
      }
      if (onComplete) {
        onComplete();
      }
      setTimeout(() => taskLogs.setIsVisible(false), 3000);
    } else if (msg.stage === 'deploy-skipped') {
      taskLogs.addSystemLog("✅ Wallet-signed deploy detected – backend deploy step skipped");
    } else if (msg.stage === 'error') {
      taskLogs.addSystemLog(`❌ Error: ${msg.message || 'Unknown error'}`);
      if (es) {
        es.close();
      }
      if (onComplete) {
        onComplete('error');
      }
    }
  };

  let es: ReturnType<typeof sseDeploy> | null = null;
  
  try {
    es = sseDeploy(projectContext.id!, graph, update);
    
    es.addEventListener('close', () => {
      console.log(`[deployPipeline] SSE connection closed`);
    });

  } catch (err) {
    taskLogs.addSystemLog(`❌ ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  
  return es;
}
