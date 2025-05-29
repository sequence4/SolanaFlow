/**
 * utils/project/createProject.ts
 * ---------------------------------------------------------------
 * 2025-05-26 ─ Slim refactor
 *
 * ‣ Sole responsibility: persist a project row in the `solanaproject`
 *   table.  NO container execs, NO filesystem work, NO anchor init.
 *
 * ‣ Why keep this helper at all?
 *   • Centralises the "new-project" SQL in one place.
 *   • Makes it trivial to extend with tags/owner ACL in the future.
 * ---------------------------------------------------------------
 */

import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import pool from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

/** Shape of the payload received from the controller layer */
export interface CreateProjectArgs {
  name       : string;
  description?: string;
  details?   : any;          // JSONB blob – UI workflow state, etc.
}

/** Shape of what we return to the controller / REST layer */
export interface CreatedProject {
  id         : string;
  name       : string;
  description: string | null;
  rootPath   : string;
  details    : any;
  createdAt  : Date;
}

/**
 * Persist a new project row.  If a collision on `root_path` ever occurs
 * (users choose identical names), append the first 6 chars of the project
 * UUID – still human-readable yet unique.
 */
export const createProject = async (input: CreateProjectArgs): Promise<CreatedProject> => {
  const projectId = uuidv4();
  const rootPath = `${slugify(input.name, { lower: true })}-${uuidv4().slice(0, 8)}`;
  const extended = { ...(input.details || {}), isLite: true };

  try {
    const result = await pool.query(
      `INSERT INTO solanaproject 
       (id, name, description, root_path, details, last_updated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, name, description, root_path, details`,
      [projectId, input.name, input.description, rootPath, JSON.stringify(extended), new Date()]
    );

    return result.rows[0];
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      throw new AppError('A project with this name already exists', 409);
    }
    throw error;
  }
};

/* -----------------------------------------------------------------
 * Utility note:
 *  - JSON.stringify() serialises `details` so Postgres can accept it
 *    as JSONB (text → server-side parse)
 *  - All SQL is parameterised ($1…$n) to avoid injection
 *  - No need for setImmediate() here; insertion is <5 ms.  If you want
 *    non-blocking semantics, wrap the call in setImmediate at the
 *    controller layer (see Node docs)
 * ----------------------------------------------------------------- */
