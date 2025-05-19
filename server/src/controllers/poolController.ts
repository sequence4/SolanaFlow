import { Request, Response, NextFunction } from 'express';
import {
  rentContainerFromPool,
  releaseContainerToPool,
} from '@/utils/container/rentContainerFromPool';

export const rentContainer = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rented = await rentContainerFromPool();
    if (!rented) return void res.sendStatus(204);
    res.json(rented);
  } catch (err) {
    console.error('Rent-pool DB error:', err);
    next(err);
  }
};

export const releaseContainer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await releaseContainerToPool(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Release-pool DB error:', err);
    next(err);
  }
};
