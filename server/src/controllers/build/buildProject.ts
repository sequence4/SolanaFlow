import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import pool from "../../config/database";
import { startAnchorBuildTask } from '../../utils/anchor/startAnchorBuildTask';


export const buildProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id ?? 'mock-user';
  
    try {
      const projectCheck = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        return next(
          new AppError(
            'Project not found or you do not have permission to access it',
            404
          )
        );
      }
  
      const { details: detailsStr } = projectCheck.rows[0];
      let details = {};
      try {
        if (typeof detailsStr === 'object' && detailsStr !== null) {
          details = detailsStr;
        } else {
          details = JSON.parse(detailsStr || '{}');
        }
      } catch (err) {
        console.error('Failed to parse details JSON:', err);
        return next(new AppError('Error parsing project details', 500));
      }
  
      if ((details as any).isLite === true) {
        res.status(200).json({ 
          message: 'Build operation skipped for lite project',
          isLite: true
        });
        return;
      }
  
      const taskId = await startAnchorBuildTask(id, userId);
  
      res.status(200).json({
        message: 'Anchor build process started',
        taskId: taskId,
      });
    } catch (error) {
      return next(error);
    }
  };