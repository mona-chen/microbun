// middleware/populateUserFromHeaders.ts
import type { IReq, IRes } from '@shared/types/config';
import type { Request, Response, NextFunction } from 'express';

export const useUserContext = (req: IReq, _res: IRes, next: NextFunction) => {
  const userId = req.header('X-User-Id');
  const email = req.header('X-User-Email');
  const roles = req.header('X-User-Roles')?.split(',') || [];
  const permissions = req.header('X-User-Permissions')?.split(',') || [];

  if (userId && email) {
    req.user = {
      id: userId,
      email,
      roles,
      permissions,
    };
  }

  next();
};
