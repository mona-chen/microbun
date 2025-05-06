import { NextFunction } from 'express';
import AppError from './appError';
import { IReq, IRes } from 'types/config';
import catchAsync from './catchAsync';
import jwt, { Secret } from 'jsonwebtoken';
import User from '../models/user.model';

interface DecodedToken {
  id: string;
  iat: number;
}
export const restrictTo = (...roles: string[]): any => {
  return (req: IReq, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

export const protect = catchAsync(async (req: IReq, res: IRes, next: NextFunction) => {
  let token: string | undefined;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET as Secret) as any;

  const currentUser = await User.query().findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('User recently changed password! Please log in again.', 401));
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});
