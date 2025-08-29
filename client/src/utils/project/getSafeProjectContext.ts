import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { ProjectStateUpdater } from "@/context/project/ProjectContextTypes";

export function getSafeProjectContext(
  fetched: Partial<ProjectContextType>,
  setProjectState: (stateUpdater: ProjectStateUpdater) => void
): ProjectContextType {
  return {
    id: fetched.id || "",
    name: fetched.name || "",
    description: fetched.description || "",
    containerUrl: fetched.containerUrl || "",
    injectingNodeTypes: fetched.injectingNodeTypes || [],
    details: {
      ...fetched.details,
      setProjectState:
        setProjectState || (() => {}), 
      projectState: {
        nodes: fetched.details?.projectState?.nodes || [],
        edges: fetched.details?.projectState?.edges || [],
        programId: fetched.details?.projectState?.programId || '',
        built: fetched.details?.projectState?.built || false,
        deployed: fetched.details?.projectState?.deployed || false,
      }
    }
  };
}