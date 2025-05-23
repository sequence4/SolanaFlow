import { Request, Response, NextFunction } from 'express';
import { isWorkspaceSubdomain } from '@/utils/cert/validateCertDomain';

export const allowCertificate = (
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const host = req.query.domain as string | undefined;

  if (isWorkspaceSubdomain(host)) {
    return void res.sendStatus(200);
  }

  res.sendStatus(403);
};
