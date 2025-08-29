import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { AppError } from "../../middleware/errorHandler";

export const editProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const { name, description, details } = req.body;
    const userId = req.user?.id;
    // org_id checks temporarily disabled until auth lands
  
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      const projectCheck = await client.query(
        'SELECT * FROM solanaproject WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        throw new AppError(
          'Project not found or you do not have permission to edit it',
          404
        );
      }
  
      let updateQuery = 'UPDATE solanaproject SET last_updated = NOW()';
      const updateValues = [];
      let valueIndex = 1;
  
      if (name !== undefined) {
        updateQuery += `, name = $${valueIndex}`;
        updateValues.push(name);
        valueIndex++;
      }
  
      if (description !== undefined) {
        updateQuery += `, description = $${valueIndex}`;
        updateValues.push(description);
        valueIndex++;
      }
  
      if (details !== undefined) {
        /* single pass-through for details updates (built/deployed/programId) */
        let detailsQuery = `COALESCE(details, '{}'::jsonb)`;
        if (details.projectState?.built !== undefined) {
          detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,built}', to_jsonb(($${valueIndex})::boolean), true)`;
          updateValues.push(!!details.projectState.built); valueIndex++;
        }
        if (details.projectState?.deployed !== undefined) {
          detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,deployed}', to_jsonb(($${valueIndex})::boolean), true)`;
          updateValues.push(!!details.projectState.deployed); valueIndex++;
        }
        if (details.programId !== undefined) {
          detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,programId}', to_jsonb($${valueIndex}), true)`;
          updateValues.push(details.programId); valueIndex++;
        }
        updateQuery += `, details = ${detailsQuery}`;
      }
  
      updateQuery += ` WHERE id = $${valueIndex} RETURNING *`;
      updateValues.push(id);
  
      const result = await client.query(updateQuery, updateValues);
  
      await client.query('COMMIT');
  
      const updatedProject = result.rows[0];
      res.status(200).json({
        message: 'Project updated successfully',
        project: updatedProject,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in editProject:', error);
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Failed to update project', 500));
      }
    } finally {
      client.release();
    }
  };