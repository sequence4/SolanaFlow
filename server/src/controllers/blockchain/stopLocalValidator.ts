import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getContainerName } from "../../utils/container/getContainerName";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database";

/**
 * POST /projects/:id/local-validator/stop
 * Stop the local test validator
 */
export const stopLocalValidator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      
      console.log(`[VALIDATOR_STOP] Stopping validator for project ${projectId}`);
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        return next(new AppError('Container not found', 404));
      }
      
      const stopCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh stop`;
      const output = await runCommand(stopCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      await pool.query(
        `UPDATE solanaproject 
         SET details = jsonb_set(
           COALESCE(details, '{}'::jsonb),
           '{localValidator,active}',
           'false'
         )
         WHERE id = $1`,
        [projectId]
      );
      
      console.log('[VALIDATOR_STOP] Validator stopped');
      
      res.json({
        message: 'Local validator stopped',
        status: 'stopped',
        output: output.substring(0, 500)
      });
      
    } catch (error) {
      console.error('[VALIDATOR_STOP] Error:', error);
      next(new AppError(`Failed to stop validator: ${(error as Error).message}`, 500));
    }
  };