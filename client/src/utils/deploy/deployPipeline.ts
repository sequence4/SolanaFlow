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
) {
  console.log(`[deployPipeline] Starting runDeployPipelineWithLogs for project: ${projectContext.id}`);
  console.log(`[deployPipeline] Graph data summary: ${Object.keys(graph || {}).length} keys`);
  
  taskLogs.resetLogs();
  taskLogs.setIsVisible(true);
  taskLogs.addSystemLog("🚀 Starting deployment pipeline...");

  const update = (msg: any) => {
    console.log(`[deployPipeline] Received update from SSE:`, msg);
    taskLogs.addSystemLog(JSON.stringify(msg));

    // Update the stage in the task logs context
    if (msg.stage) {
      taskLogs.updateStage(msg.stage);
    }

    // Handle completion cases
    if (msg.stage === 'deploy-done' || msg.stage === 'done') {
      taskLogs.addSystemLog("✅ Deployment complete!");
      if (es) {
        es.close();
      }
      setTimeout(() => taskLogs.setIsVisible(false), 3000);
    } else if (msg.stage === 'error') {
      taskLogs.addSystemLog(`❌ Error: ${msg.message || 'Unknown error'}`);
      if (es) {
        es.close();
      }
    }
  };

  let es: ReturnType<typeof sseDeploy> | null = null;
  
  try {
    console.log(`[deployPipeline] Calling SSE deploy with projectId: ${projectContext.id}`);
    es = sseDeploy(projectContext.id!, graph, update);
    
    // Add a close event handler to ensure we clean up
    es.addEventListener('close', () => {
      console.log(`[deployPipeline] SSE connection closed`);
    });

    console.log(`[deployPipeline] SSE EventSource created`);
  } catch (err) {
    console.error(`[deployPipeline] Error in SSE deploy:`, err);
    taskLogs.addSystemLog(`❌ ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  
  // Return the EventSource so the caller can close it if needed
  return es;
}
