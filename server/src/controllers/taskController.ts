import { NextFunction, Request, Response } from 'express';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getTaskById } from '../utils/taskUtils';

import { PaginatedResponse, TaskQueryParams } from 'src/types';

export const listProjectTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  const {
    page = 1,
    limit = 10,
    status,
    projectId,
  } = req.query as TaskQueryParams;

  try {
    let query = `
      SELECT t.id, t.name, t.created_at, t.last_updated, t.status, t.project_id, 
             sp.name as project_name
      FROM task t
      JOIN solanaproject sp ON t.project_id = sp.id
    `;
    const queryParams: any[] = [];

    if (projectId) {
      query += `${queryParams.length === 0 ? ' WHERE' : ' AND'} t.project_id = $${queryParams.length + 1}`;
      queryParams.push(projectId);
    }

    if (status) {
      query += `${queryParams.length === 0 ? ' WHERE' : ' AND'} t.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) AS count`,
      queryParams
    );
    const totalTasks = parseInt(countResult.rows[0].count);

    query += ` ORDER BY t.last_updated DESC LIMIT $${
      queryParams.length + 1
    } OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, (page - 1) * limit);

    const result = await pool.query(query, queryParams);

    const paginatedResponse: PaginatedResponse<any> = {
      data: result.rows,
      total: totalTasks,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalTasks / limit),
    };

    res.status(200).json({
      message: 'Project tasks retrieved successfully',
      tasks: paginatedResponse,
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { taskId } = req.params;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  try {
    const result = await pool.query(
      `
      SELECT t.id, t.name, t.created_at, t.last_updated, t.status, t.result, t.project_id, 
             sp.name as project_name
      FROM task t
      JOIN solanaproject sp ON t.project_id = sp.id
      WHERE t.id = $1
    `,
      [taskId]
    );

    if (result.rows.length === 0) {
      return next(
        new AppError(
          'Task not found or you do not have permission to access it',
          404
        )
      );
    }

    res.status(200).json({
      message: 'Task retrieved successfully',
      task: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const streamTask = async (
  req: Request<{ taskId: string }>,
  res: Response,
  next: NextFunction,
) => {
  const { taskId } = req.params;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  /*  SSE headers  */
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no'   // disable nginx buffering
  });
  res.flushHeaders();

  let lastStatus = '';
  console.log(`[TASK] Starting task stream for task: ${taskId}`);
  
  const interval = setInterval(async () => {
    try {
      const { status, result } = await getTaskById(taskId);

      if (status !== lastStatus) {
        // Log a clean, human-readable status update
        console.log(`[TASK] Task ${taskId} status: ${status}`);
        
        // For result, only log its presence, not the content
        const hasResult = result !== null && result !== undefined;
        if (hasResult) {
          console.log(`[TASK] Task ${taskId} has result data`);
        }
        
        // Send the actual data to the client
        res.write(`data: ${JSON.stringify({ status, result })}\n\n`);
        lastStatus = status;
      }

      if (['succeed', 'failed', 'finished', 'warning'].includes(status)) {
        clearInterval(interval);
        console.log(`[TASK] Task ${taskId} completed with status: ${status}`);
        res.end();
      }
    } catch (err) {
      clearInterval(interval);
      const errorMessage = (err as Error).message;
      console.error(`[TASK] Error streaming task ${taskId}: ${errorMessage}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
      res.end();
    }
  }, 1000);

  // Clean up when client disconnects
  res.on('close', () => {
    clearInterval(interval);
    console.log(`[TASK] Client disconnected from task stream: ${taskId}`);
  });
};
