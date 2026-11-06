import { NextFunction, Request, Response } from "express";
import { COOKIE_NAMES } from "../config/cookies";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/token";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.[COOKIE_NAMES.access];
  if (!token) {
    throw new AppError(401, "Please log in");
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError(401, "Session expired, please refresh or log in again");
  }
  req.user = { id: payload.sub, role: payload.role };
  next();
};
