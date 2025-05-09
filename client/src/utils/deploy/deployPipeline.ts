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
  taskLogs.resetLogs();
  taskLogs.setIsVisible(true);
  taskLogs.setProgress(0);

  const update = (msg: any) => {
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
        break;
      case 'error':
        taskLogs.setProgress(100);
        break;
    }
  };

  await sseDeploy(projectContext.id!, graph, update)
    .catch(err => {
      taskLogs.addSystemLog(`❌ ${err instanceof Error ? err.message : err}`);
      throw err;
    })
    .finally(() => {
      setTimeout(() => taskLogs.setIsVisible(false), 1000);
    });
}
