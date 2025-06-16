import { projectApi } from '../../api/projectApi';
import { ProjectContextType, ProjectStateType } from '../../context/project/ProjectContextTypes';
import { FileTreeItemType } from '../../interfaces/FileTreeItemType';

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

  /* ------------------------------------------------------------------ *
   *  Build a fully-typed default ProjectState object
   * ------------------------------------------------------------------ */
  const blankTree: FileTreeItemType = {
    name: ctx.name ?? 'src',
    path: '',
    type: 'directory',
    children: [],
  };

  const defaultProjectState: ProjectStateType = {
    mode: 'basic',
    nodes: [],
    edges: [],
    config: {},
    built: false,
    deployed: false,
    fileTree: blankTree,
  };

  const details = ctx.details
    ? { ...ctx.details, projectState: ctx.details.projectState ?? defaultProjectState }
    : { projectState: defaultProjectState };

  /* ------------------------------------------------------------------ *
   *  Persist the project, obtain its id
   * ------------------------------------------------------------------ */
  const { project } = await projectApi.createProject({
    name: ctx.name || 'Untitled Project',
    description: ctx.description,
    details,
  });

  /* ------------------------------------------------------------------ *
   *  Merge (not replace) existing context so SetStateAction signature
   *  remains correct.
   * ------------------------------------------------------------------ */
  setCtx(prev => ({
    ...prev,
    id: project.id,
    details: {
      ...details,
      // keep any runtime helper functions already present in prev.details
      ...(prev.details ?? {}),
    },
  }));

  return project.id;
}; 