import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { startInstallPackagesTask } from "../../utils/project/startInstallPackagesTask";

export const installPackages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const { packages } = req.body;
    const userId = req.user?.id ?? 'mock-user';
    
    try {
      const projectCheck = await pool.query(
        'SELECT * FROM solanaproject WHERE id = $1',
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
  
      const taskId = await startInstallPackagesTask(id, userId, packages);
  
      res.status(200).json({
        message: 'NPM packages installation started successfully',
        taskId: taskId,
      });
    } catch (error) {
      console.error('Error in installPackages:', error);
      next(new AppError('Failed to start package installation process', 500));
    }
  };