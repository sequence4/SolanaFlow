import { deployPipeline as sseDeploy } from '@/api/deployPipeline';
import { ProjectContextType } from '@/context/project/ProjectContextTypes';
import { useContext } from 'react';
import FileContext from '@/context/file/FileContext';
import { FileTreeItemType } from '@/interfaces/FileTreeItemType';
import UxContext from "@/context/ux/UxContext";

// Track file tree state internally to handle streaming
let currentFileTree: FileTreeItemType[] = [];

// Helper function to add a file to the tree
function addFileToTree(path: string, content: string, setFileTree?: (tree: any) => void) {
  if (!setFileTree) return;
  
  // Extract filename from path
  const pathParts = path.split('/');
  const fileName = pathParts[pathParts.length - 1];
  
  // Create a file node
  const fileItem: FileTreeItemType = {
    name: fileName,
    path,
    type: 'file',
    ext: fileName.split('.').pop(),
    content
  };
  
  // Add to tree - simple version just adds at root level
  currentFileTree.push(fileItem);
  setFileTree([...currentFileTree]);
}

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
  setFileTree?: (tree: any) => void,
  setActiveTab?: (tab: string) => void,
) {
  // Reset the file tree collection for streaming
  currentFileTree = [];
  
  taskLogs.resetLogs();
  taskLogs.setIsVisible(true);
  taskLogs.addSystemLog("🚀 Starting deployment pipeline...");

  const { activeTab, setActiveTab: uxSetActiveTab } = useContext(UxContext);

  const update = (msg: any) => {
    console.log(`[deployPipeline] Received update from SSE:`, msg);
    taskLogs.addSystemLog(JSON.stringify(msg));

    if (msg.stage) {
      taskLogs.updateStage(msg.stage);
    }

    if (msg.stage === 'ui-stream') {
      currentFileTree = [];
      if (setFileTree) setFileTree([]);
      taskLogs.addSystemLog("📝  streaming UI…");
    }

    if (msg.event === 'file-written') {
      if (setFileTree) addFileToTree(msg.path, msg.content, setFileTree);
      taskLogs.addSystemLog(`📄 ${msg.path}`);
    }

    /* ------------ AUTO TAB SWITCH on ui-complete ------------- */
    if (msg.stage === "ui-complete" || msg.event === "ui-complete") {
      // only switch if user has NOT manually left workflow
      if (activeTab === "workflow") uxSetActiveTab("interface");
    }
    /* ---------------------------------------------------------- */

    if (msg.stage === "file-tree-start") {
      taskLogs.addSystemLog("📂 Building project file tree…");
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

    if (msg.fileTree && setFileTree) {
      const count = Array.isArray(msg.fileTree) ? msg.fileTree.length : 1;
      console.log(`[deployPipeline] Received fileTree with ${count} items`);
      taskLogs.addSystemLog(`📂 Received project file tree with ${count} items`);
      setFileTree(structuredClone(msg.fileTree as import("@/interfaces/FileTreeItemType").FileTreeItemType[]));
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
    es = sseDeploy(projectContext.id!, graph, update, /* walletSigned = */ true);
    
    es.addEventListener('close', () => {
      console.log(`[deployPipeline] SSE connection closed`);
    });

  } catch (err) {
    taskLogs.addSystemLog(`❌ ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  
  return es;
}
