import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import pool from '../config/database';
import { startAnchorInitTask } from '../utils/anchor/startAnchorInitTask';
import { getProjectRootPath } from '../utils/fileUtils';

export const anchorInitProjectController = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const org_id = req.user?.org_id;
    const userId = req.user?.id;
    if (!org_id || !userId) {
      return next(new AppError('User organization not found', 400));
    }
  
    const { projectId, projectName} = req.body;
  
    try {
      const projectResult = await pool.query(
        `SELECT details FROM solanaproject WHERE id = $1`,
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        return next(new AppError('Project not found', 404));
      }
  
      const { details: detailsStr } = projectResult.rows[0];
      
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
          message: 'Operation skipped for lite project',
          isLite: true
        });
        return;
      }
  
      const rootPath = await getProjectRootPath(projectId);
      if(!rootPath) {
        return next(new AppError('Project root path not found', 400));
      }
      
      const taskId = await startAnchorInitTask(projectId, rootPath, projectName, userId);
  
      res.status(200).json({
        message: 'Anchor project initialization started successfully',
        taskId: taskId,
      });
    } catch (error) {
      return next(error);
    }
  };