import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { ensureId } from "./ensureId";
import { saveProject } from "./saveProject";

export const handleConfirmNewProject = async (
    projectContext: ProjectContextType,
    setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
    name: string,
    description: string,
    _projectsRefreshCounter: number,
    setProjectsRefreshCounter: React.Dispatch<React.SetStateAction<number>>,
    setUxOpenPanel: (p: string) => void,
    _setFileTree: (tree: FileTreeItemType | null) => void,
    _setSelectedFile: (file: FileTreeItemType | null) => void,
    taskLogs: ReturnType<typeof useTaskLogs>,
  ) => {
    try {
      /* ------------------------------------------------------------------
       * 1. Optimistic local update (instant UX feedback)
       * ------------------------------------------------------------------ */
      setProjectContext(prev => ({              // no DB traffic yet
        ...prev,
        name,
        description,
      }));
  
      /* ------------------------------------------------------------------
       * 2. Ensure we have a DB id (cheap INSERT if missing)
       * ------------------------------------------------------------------ */
      const id = await ensureId(projectContext, setProjectContext);
      //console.log(`[DEBUG_PROJECT_CONFIRM] ensured id=${id}`);
  
      /* ------------------------------------------------------------------
       * 3. Persist metadata only when we already have something meaningful
       *    to save.  Right after the very first CREATE the projectState
       *    object is still empty – a PUT would be pointless traffic.
       * ------------------------------------------------------------------ */
      const state = projectContext.details?.projectState;
      const hasMeaningfulState =
        !!state &&
        Object.keys(state).some(
          k => {
            const value = (state as Record<string, unknown>)[k];
            return Array.isArray(value)
              ? value.length > 0            // non-empty array
              : value !== undefined;        // any other truthy value
          }
        );
  
      if (hasMeaningfulState) {
        const result = await saveProject({ ...projectContext, id, name, description }, setProjectContext);
        if (!result) {
          console.warn('Save project returned null, but continuing...');
        }
      }
  
      /* House-keeping */
      setProjectsRefreshCounter(c => c + 1);
      setUxOpenPanel('workflow');
    } catch (err) {
      console.error('[handleConfirmNewProject] fatal:', err);
      taskLogs.addSystemLog(`❌ Failed to create new project: ${String(err)}`);
      throw err;                                 // let caller toast the error
    }
  };