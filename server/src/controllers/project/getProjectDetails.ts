import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";

export const getProjectDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;
    // org_id checks temporarily disabled until auth lands
  
  
    try {
      const projectResult = await pool.query(
        `
        SELECT id, name, description, root_path, details, container_url, last_updated, created_at
        FROM solanaproject
        WHERE id = $1
      `,
        [id]
      );
  
      if (projectResult.rows.length === 0) {
        next(
          new AppError('Project not found or you do not have permission to access it', 404)
        );
        return;
      }
  
      const project = projectResult.rows[0];
  
      const projectContext = {
        id: project.id,
        name: project.name,
        description: project.description,
        rootPath: project.root_path || '',
        details: project.details || {},
        containerUrl: project.container_url || "",
      };
      
  
      res.status(200).json({
        message: 'Project details retrieved successfully',
        project: projectContext,
      });
    } catch (error) {
      console.error('Error in getProjectDetails:', error);
      next(error);
    }
  };