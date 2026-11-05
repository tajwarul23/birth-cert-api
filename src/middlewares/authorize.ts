import { NextFunction, Request, Response } from "express";
import { Role } from "../utils/token";
import { AppError } from "../utils/AppError";

export const authorize =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "You don't have permission to do this");
    }
    next();
  };