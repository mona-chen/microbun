import type { IReq, IRes } from '@shared/types/config';
import type { NextFunction } from 'express';
import { validationResult } from 'express-validator';

export function validateRequest(req: any, res: any, next: NextFunction) {
  const errors = validationResult(req).formatWith(error => error.msg);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      message: errors.array()[0],
      errors: errors.array(),
    });
  }

  next(); // pass to the next middleware/controller
}
