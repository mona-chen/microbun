import type { IReq, IRes } from '@shared/types/config';
import type { Application, NextFunction } from 'express';

function catchAsync(fn: Function): any {
  return (req: IReq, res: IRes, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export default catchAsync;
