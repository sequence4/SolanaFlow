import { projectApi } from '../../api/projectApi';
import { ProjectContextType } from '../../context/project/ProjectContextTypes';

/**
 * Guarantee that a ProjectContext object has a DB id.
 * • If ctx.id already exists ➜ just return it.
 * • Otherwise POST /projects/create, update React state and return the fresh id.
 */
export const ensureId = async (
  ctx: ProjectContextType,
  setCtx: React.Dispatch<React.SetStateAction<ProjectContextType>>,
): Promise<string> => {
  if (ctx.id) return ctx.id;                                   // fast-path

  const { project } = await projectApi.createProject({
    name: ctx.name || 'Untitled Project',
    description: ctx.description,
    details: ctx.details,
  });

  setCtx(prev => ({ ...prev, id: project.id }));               // keep UI in sync
  return project.id;
}; 