import { ProjectContextType } from "@/context/project/ProjectContextTypes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { projectApi } from "@/api/projectApi";
import { getSafeProjectContext } from "./getSafeProjectContext";
import { fetchFilesAndCodes } from "../files/fetchFilesAndCodes";

export const handleOpenProject = async (
  projectId: string,
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  setFileTree: (tree: FileTreeItemType | null) => void
) => {
  try {
    //console.log(`[DEBUG] handleOpenProject - Starting for projectId: ${projectId}`);
    //console.log(`[DEBUG] Current projectContext before API call:`, projectContext);
    
    const fetchedDetails = await projectApi.getProjectDetails(projectId);
    //console.log(`[DEBUG] fetchedDetails from API:`, fetchedDetails);
    //console.log(`[DEBUG] fetchedDetails.containerUrl:`, fetchedDetails.containerUrl);

    const safeProjectContext = getSafeProjectContext(
      fetchedDetails,
      projectContext.details?.setProjectState || (() => {})
    );
    
    //console.log(`[DEBUG] safeProjectContext after getSafeProjectContext:`, safeProjectContext);
    //console.log(`[DEBUG] safeProjectContext.containerUrl:`, safeProjectContext.containerUrl);

    setProjectContext(safeProjectContext);
    //console.log(`[DEBUG] Project context set with safeProjectContext`);

    // Always fetch files and codes to populate the file tree
    fetchFilesAndCodes(projectId, safeProjectContext, setProjectContext, setFileTree, false);

    try {
      const containerResult = await projectApi.startContainer(projectId);
      //console.log('Container start task initiated:', containerResult.taskId);
    } catch (containerError) {
      console.error('Error starting container:', containerError);
    }
  } catch (err) {
    console.error("Error opening project:", err);
  }
};