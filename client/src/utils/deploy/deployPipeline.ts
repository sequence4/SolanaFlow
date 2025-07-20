import React, { useContext } from "react";
import { deployPipeline as sseDeploy } from "../../api/deployPipeline";
import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import UxContext from "@/context/ux/UxContext";
import { FileTreeItemType } from '@/interfaces/FileTreeItemType';

// Track file tree during stream
let currentFileTree: FileTreeItemType[] = [];

// Flag indicating development server mode (auto-open interface when UI is ready)
const IS_DEV_SERVER = process.env.NEXT_PUBLIC_SF_DEV_SERVER === '1';

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

// Helper function to load IDL from localStorage
export function loadIdlFromStorage(projectId: string): { primaryIdl: any, allIdls: any[] } {
  const result = {
    primaryIdl: null as any,
    allIdls: [] as any[]
  };
  
  try {
    // Try to load the primary IDL
    const storedIdl = localStorage.getItem(`idl-${projectId}`);
    if (storedIdl) {
      result.primaryIdl = JSON.parse(storedIdl);
      result.allIdls.push(result.primaryIdl);
    }
    
    // Look for any program-specific IDLs
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`idl-${projectId}-`)) {
        try {
          const idl = JSON.parse(localStorage.getItem(key) || '');
          // Only add if not already in the array
          if (idl && !result.allIdls.some(existing => existing.name === idl.name)) {
            result.allIdls.push(idl);
          }
        } catch (e) {
          console.error(`[deployPipeline] Error parsing IDL from ${key}:`, e);
        }
      }
    }
    
    // If we found program-specific IDLs but no primary IDL, use the first one as primary
    if (!result.primaryIdl && result.allIdls.length > 0) {
      result.primaryIdl = result.allIdls[0];
    }
  } catch (error) {
    console.error("[deployPipeline] Failed to load IDLs from localStorage:", error);
  }
  
  return result;
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

  const { activeTab, setActiveTab: uxSetActiveTab, setContainerUrlRefreshTrigger } = useContext(UxContext);
  
  // Track if we've already switched tabs to avoid multiple switches
  let hasAutoSwitchedTab = false;
  // Track if we've seen Next.js logs to trigger auto-refresh
  let hasSeenNextJsLogs = false;

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

    // Check for Next.js logs to trigger auto-switch and refresh
    if (!hasSeenNextJsLogs && msg.message && typeof msg.message === 'string' && 
        (msg.message.includes('ready started server on') || 
         msg.message.includes('started server on') || 
         msg.message.includes('compiled successfully'))) {
      hasSeenNextJsLogs = true;
      
      // Auto-switch to interface tab if not already there
      if (!hasAutoSwitchedTab && activeTab !== "interface") {
        console.log('[deployPipeline] First Next.js logs detected, switching to interface tab');
        uxSetActiveTab("interface");
        hasAutoSwitchedTab = true;
      }
      
      // Trigger iframe refresh by incrementing the refresh counter
      console.log('[deployPipeline] First Next.js logs detected, triggering iframe refresh');
      // Use the current timestamp to ensure the value changes
      const timestamp = Date.now();
      setContainerUrlRefreshTrigger(timestamp);
    }

    /* ------------ AUTO TAB SWITCH on ui-complete ------------- */
    if ((msg.stage === "ui-complete" || msg.event === "ui-complete") && !hasAutoSwitchedTab) {
      // Skip if we're already there or the user manually picked a tab **after** the build started
      if (activeTab !== "interface") {
        uxSetActiveTab("interface");
        hasAutoSwitchedTab = true;
      }
    }
    /* ---------------------------------------------------------- */

    if (msg.stage === "file-tree-start") {
      taskLogs.addSystemLog("📂 Building project file tree…");
    }

    if (msg.containerUrl) {
      const fullUrl = msg.containerUrl.includes("/dapp/")
        ? msg.containerUrl
        : `${msg.containerUrl.replace(/\/$/, "")}/dapp/${projectContext.id}`;
      console.log(`[deployPipeline] Received containerUrl: ${fullUrl}`);
      taskLogs.addSystemLog(`🌐 Container URL: ${fullUrl}`);
      setProjectContext(prev => ({ ...prev, containerUrl: fullUrl }));
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

    // 🔑 Merge deterministic program ID into context on SSE events.
    // Deep‑clone each level so React notices the change.
    if (msg.event === 'ephemeralKey' || msg.event === 'programIdPersisted') {
      const newProgramId = msg.pubkey || msg.programId;
      if (newProgramId) {
        console.log(`[deployPipeline] Received programId via event:`, newProgramId);
        setProjectContext(prev => ({
          ...prev,
          details: {
            ...structuredClone(prev.details ?? {}),
            projectState: {
              ...structuredClone(prev.details?.projectState ?? {}),
              programId: newProgramId,
            },
          },
        }));
      }
    }

         /* ─────────────── NEW: capture program‑ID events ─────────────── */
     // Handle both program ID events with the same deep-clone logic
     if ((msg.stage === 'ephemeralKey' && msg.pubkey) || 
         (msg.stage === 'programIdPersisted' && msg.programId)) {
       const newProgramId = msg.pubkey || msg.programId;
       console.log('[deployPipeline] Received programId:', newProgramId);
       
       // Deep‑clone each level so React sees a new object reference
       setProjectContext(prev => ({
         ...prev,
         details: {
           ...structuredClone(prev.details ?? {}),
           projectState: {
             ...structuredClone(prev.details?.projectState ?? {}),
             programId: newProgramId,
           },
         },
       }));
     }
    /* ─────────────────────────────────────────────────────────────── */

    if (msg.idl) {
      console.log(`[deployPipeline] Received IDL:`, msg.idl);
      taskLogs.addSystemLog(`📜 Received program IDL`);
      
      try {
        localStorage.setItem(`idl-${projectContext.id}`, JSON.stringify(msg.idl));
      } catch (error) {
        console.error("[deployPipeline] Failed to save IDL to localStorage:", error);
      }
      
      setProjectContext(prev => ({
        ...prev,
        details: {
          ...structuredClone(prev.details ?? {}),
          projectState: {
            ...structuredClone(prev.details?.projectState ?? {}),
            idl: msg.idl,
            idls: (prev.details?.projectState?.idls ?? [])
              .filter((i: any) => i.name !== msg.idl.name)
              .concat(msg.idl),
          }
        }
      }));
    }

    if (msg.idls && Array.isArray(msg.idls) && msg.idls.length > 0) {
      console.log(`[deployPipeline] Received ${msg.idls.length} IDLs`);
      taskLogs.addSystemLog(`📜 Received ${msg.idls.length} program IDLs`);
      
      try {
        // Store all IDLs in localStorage
        msg.idls.forEach((idl: any) => {
          if (idl.name) {
            localStorage.setItem(`idl-${projectContext.id}-${idl.name}`, JSON.stringify(idl));
          }
        });
      } catch (error) {
        console.error("[deployPipeline] Failed to save IDLs to localStorage:", error);
      }
      
      setProjectContext(prev => {
        // Merge new IDLs with existing ones, replacing any with the same name
        const existingIdls = prev.details?.projectState?.idls ?? [];
        const mergedIdls = [
          ...existingIdls.filter((existing: any) => 
            !msg.idls.some((incoming: any) => incoming.name === existing.name)
          ),
          ...msg.idls
        ];
        
        return {
          ...prev,
          details: {
            ...prev.details!,
            projectState: {
              ...prev.details!.projectState,
              // Set the first IDL as the primary one if not already set
              idl: prev.details!.projectState?.idl || msg.idls[0],
              idls: mergedIdls
            }
          }
        };
      });
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
