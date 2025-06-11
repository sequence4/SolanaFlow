/**  Dev helper – attaches a fake user/org so endpoints that expect them don't 500. */
import { Request, Response, NextFunction } from 'express';

export function mockUser(req: Request, _res: Response, next: NextFunction) {
  // add the minimum fields every controller touches
  req.user = {
    id:        'mock-user',   // <- any deterministic string is fine
    org_id:    null           // <- leave null; we'll stop querying by it
  } as any;
  next();
} 