import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";

export const listProjects = async (
    req: Request, res: Response, next: NextFunction
  ) => {
    const page   = Number(req.query.page  ?? 1);
    const limit  = Number(req.query.limit ?? 10);
    const search = String(req.query.search ?? '').trim();
  
    const offset = (page - 1) * limit;
    const params: any[] = [limit, offset];
    const whereSQL =
      search
        ? `WHERE name ILIKE $3 OR description ILIKE $3`
        : '';
  
    if (search) params.push(`%${search}%`);
  
    try {
      const { rows } = await pool.query(
        `SELECT id, name, description, container_url AS "containerUrl", details
           FROM solanaproject
           ${whereSQL}
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
        params
      );
  
      const totalQ = await pool.query(
        `SELECT COUNT(*) FROM solanaproject ${whereSQL}`,
        search ? [`%${search}%`] : []
      );
  
      res.json({
        data: rows,
        totalPages: Math.ceil(Number(totalQ.rows[0].count) / limit),
      });
    } catch (err) {
      next(err);
    }
  };