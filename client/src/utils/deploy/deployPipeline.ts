import { deployPipeline as sseDeploy } from '@/api/deployPipeline';
import { ProjectContextType } from '@/context/project/ProjectContextTypes';

export async function runDeployPipelineWithLogs(
  projectContext: ProjectContextType,
  graph: unknown,
  taskLogs: {
    setIsVisible: (v: boolean) => void;
    setProgress: (n: number) => void;
    addSystemLog: (msg: string) => void;
    resetLogs: () => void;
  },
) {
  console.log(`[deployPipeline] Starting runDeployPipelineWithLogs for project: ${projectContext.id}`);
  console.log(`[deployPipeline] Graph data summary: ${Object.keys(graph || {}).length} keys`);
  
  taskLogs.resetLogs();
  taskLogs.setIsVisible(true);
  taskLogs.setProgress(0);
  taskLogs.addSystemLog("🚀 Starting deployment pipeline...");

  const update = (msg: any) => {
    console.log(`[deployPipeline] Received update from SSE:`, msg);
    taskLogs.addSystemLog(JSON.stringify(msg));

    switch (msg.stage) {
      case 'environment':
        taskLogs.setProgress(10);
        break;
      case 'code-gen':
        taskLogs.setProgress(30);
        break;
      case 'build':
        taskLogs.setProgress(60);
        break;
      case 'deploy':
        taskLogs.setProgress(80);
        break;
      case 'deploy-done':
      case 'done':
        taskLogs.setProgress(100);
        taskLogs.addSystemLog("✅ Deployment complete!");
        break;
      case 'error':
        taskLogs.setProgress(100);
        taskLogs.addSystemLog(`❌ Error: ${msg.message || 'Unknown error'}`);
        break;
    }
  };

  try {
    console.log(`[deployPipeline] Calling SSE deploy with projectId: ${projectContext.id}`);
    await sseDeploy(projectContext.id!, graph, update);
    console.log(`[deployPipeline] SSE deploy completed successfully`);
  } catch (err) {
    console.error(`[deployPipeline] Error in SSE deploy:`, err);
    taskLogs.addSystemLog(`❌ ${err instanceof Error ? err.message : err}`);
    throw err;
  } finally {
    console.log(`[deployPipeline] Finishing up, will hide logs soon`);
    setTimeout(() => taskLogs.setIsVisible(false), 1000);
  }
}
