import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { toast } from "sonner";
import { saveProject } from "./saveProject";

export const handleSaveClick = async (
    projectContext: ProjectContextType,
    setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
    projectsRefreshCounter: number,
    setProjectsRefreshCounter: (n: number) => void
  ) => {
      try {
        await toast.promise(
          (async () => {
            const result = await saveProject(projectContext, setProjectContext);
            return result || "Project saved";
          })(),
          {
            loading: "Saving project...",
            success: "Project updated successfully",
            error: "Failed to update project"
          }
        );
        setProjectsRefreshCounter(projectsRefreshCounter + 1);
      } catch (err) {
        console.error("Error saving project:", err);
    }
  };