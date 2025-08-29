import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { startCustomCommandTask } from '../../utils/tasks/startCustomCommandTask';

export const runProjectCommand = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { commandType, functionName, parameters, requiresUmi } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.org_id;
      
      const { ephemeralPubkey } = req.body;
  
      if (!userId || !orgId) {
        return next(new AppError('User information not found', 400));
      }
  
      const projectCheck = await pool.query(
        'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
        [id, orgId]
      );
  
      if (projectCheck.rows.length === 0) {
        return next(
          new AppError(
            'Project not found or you do not have permission to access it',
            404
          )
        );
      }
  
      if (functionName) {        
        const taskId = await startCustomCommandTask(id, userId, 'runFunction', functionName, parameters, ephemeralPubkey);
        
        res.status(200).json({
          message: `Function execution started`,
          taskId: taskId,
        });
        return;
      }
  
      if (!['anchor clean', 'cargo clean'].includes(commandType)) {
        return next(new AppError('Invalid command type', 400));
      }
  
      const taskId = await startCustomCommandTask(id, userId, commandType);
  
      res.status(200).json({
        message: `${commandType} process started`,
        taskId: taskId,
      });
    } catch (error) {
      return next(error);
    }
  };