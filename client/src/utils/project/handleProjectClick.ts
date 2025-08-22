export const handleProjectClick = async (
  projectId: string, 
  projectName: string,
  onProjectClick: (projectId: string, projectName: string) => void,
  closePopover: () => void
) => {
  onProjectClick(projectId, projectName);
  closePopover();
};