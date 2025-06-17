import { projectApi } from '../../api/projectApi';
import {
  ProjectContextType,
  ProjectDetailsType,
  ProjectStateType,
} from '../../context/project/ProjectContextTypes';
import { FileTreeItemType } from '../../interfaces/FileTreeItemType';

/**
 * Guarantee that a ProjectContext object has a DB id.
 * • If ctx.id already exists ➜ just return it.
 * • Otherwise create the project on the backend, update React state,
 *   and return the freshly-minted id.
 */
export const ensureId = async (
  ctx: ProjectContextType,
  setCtx: React.Dispatch<React.SetStateAction<ProjectContextType>>
): Promise<string> => {
  /* ---------- fast-path ---------- */
  if (ctx.id) return ctx.id;

  /* ---------- build a fully-typed blank ProjectState ---------- */
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

  /* ---------- stitch together a ProjectDetails object ---------- */
  const details: ProjectDetailsType = {
    projectState: ctx.details?.projectState ?? defaultProjectState,
    // keep any existing updater or fall back to a no-op to satisfy the type
    setProjectState: ctx.details?.setProjectState ?? (() => {}),
  };

  /* ---------- persist ---------- */
  const { project } = await projectApi.createProject({
    name: ctx.name || 'Untitled Project',
    description: ctx.description,
    details,
  });

  /* ---------- react-state update (type-safe) ---------- */
  setCtx((prev) => ({
    ...prev,
    id: project.id,
    details: {
      ...details,
      // merge back any non-typed helpers that might live on prev.details
      ...(prev.details ?? {}),
    },
  }));

  return project.id;
}; 