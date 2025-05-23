import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

export const workspaceHeartbeat = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { id } = req.params;

  try {
    await pool.query(
      'UPDATE warm_container_pool SET last_heartbeat = now() WHERE name = $1',
      [id],
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Heartbeat DB error:', err);
    next(err);
  }
};
