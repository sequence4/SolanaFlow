import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";

export async function getContainerUrlController(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      
      const { rows } = await pool.query(
        "SELECT container_url FROM solanaproject WHERE id = $1",
        [id]
      );
  
      if (!rows.length || !rows[0].container_url) {
        res.status(404).json({ 
          message: "Container URL not found for this project" 
        });
        return;
      }
  
      res.json({ containerUrl: rows[0].container_url });
      return;
    } catch (error) {
      next(error);
    }
  }