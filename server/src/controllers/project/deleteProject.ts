import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";

export const deleteProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
  
    try {
      const { rows } = await pool.query(
        `SELECT container_name FROM solanaproject WHERE id = $1`,
        [id]
      );
      const container = rows[0]?.container_name;
  
      const { rowCount } = await pool.query(
        `DELETE FROM solanaproject WHERE id = $1`,
        [id]
      );
      if (rowCount === 0) return next(new AppError('Not found', 404));
  
      if (container) {
        await pool.query(
          `INSERT INTO cleanup_queue (container_name, project_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [container, id]
        );
      }
  
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };