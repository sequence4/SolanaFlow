import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";

export const getProgramId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    try {
      const result = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return next(new AppError('Project not found or access denied', 404));
      }
      const detailsObj = (typeof result.rows[0].details === 'object')
        ? result.rows[0].details
        : JSON.parse(result.rows[0].details || '{}');
  
      const programId =
        detailsObj?.projectState?.programId ??
        detailsObj?.programId ??
        detailsObj?.lastProgramId;
      if (!programId) {
        return next(new AppError('Program ID not found for this project', 404));
      }
  
      res.status(200).json({ programId });
    } catch (err) {
      console.error('Error retrieving program ID:', err);
      next(new AppError('Failed to retrieve program ID', 500));
    }
  };