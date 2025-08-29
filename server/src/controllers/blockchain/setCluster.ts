import { startSetClusterTask } from "../../utils/anchor/startSetClusterTask";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { NextFunction, Request, Response } from "express";

export const setCluster = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const userId = req.user?.id ?? 'mock-user';
  
    try {
      const projectCheck = await pool.query(
        'SELECT * FROM solanaproject WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        return next(new AppError('Project not found or no permission to access it', 404));
      }
  
      const taskId = await startSetClusterTask(id, userId);
  
      res.status(200).json({
        message: 'Anchor config set cluster devnet process started',
        taskId,
      });
    } catch (error) {
      console.error('Error in setCluster controller:', error);
      next(new AppError('Failed to set cluster devnet', 500));
    }
  };