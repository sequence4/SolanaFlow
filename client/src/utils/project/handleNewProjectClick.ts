import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";

export const handleNewProjectClick = (
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  projectContext: ProjectContextType,
  setFileTree: (fileTree: FileTreeItemType | null) => void,
  setSelectedFile?: (file: FileTreeItemType | null) => void,
  setIsCodeReady?: (isCodeReady: boolean) => void
) => {
  setProjectContext({
    id: '',
    name: '',
    description: '',
    details: {
      setProjectState: projectContext.details?.setProjectState || (() => {}),
      projectState: {
        nodes: [],
        edges: [],
        config: {},
        programId: '',
        built: false,
        deployed: false,
      },
    },
  });

  setFileTree(null);
  if (setSelectedFile) setSelectedFile(null);
  if (setIsCodeReady) setIsCodeReady(false);
  localStorage.removeItem('projectContext');
};