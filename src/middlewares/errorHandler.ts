import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { isProduction } from "../config/env";
import { MulterError } from "multer";
import { MAX_FILE_SIZE_MB } from "./upload";
 
// Unknown route 
export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
 

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {

    if(res.headersSent){
        console.error(err);
        return next(err)
    }
  
    // errors from services/middlewares
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors ?? null,
    });
  }
 
  // Validation errors from Zod -
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
 
  // Bad JSON in the request body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON body", errors: null });
  }

  // Upload errors from Multer (too big, too many files, unknown field)
if (err instanceof MulterError) {
  const messages: Partial<Record<MulterError["code"], string>> = {
    LIMIT_FILE_SIZE: `File too large, max ${MAX_FILE_SIZE_MB} MB`,
    LIMIT_FILE_COUNT: "Too many files",
    LIMIT_UNEXPECTED_FILE: `Unexpected file field: ${err.field}`,
  };
  return res.status(400).json({ success: false, message: messages[err.code] ?? err.message, errors: null });
}

    if (
    err instanceof Error &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    return res.status(err.status).json({ success: false, message: err.message, errors: null });
  }
 
  // Anything else is a bug
  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Something went wrong",
    errors: isProduction ? null : String(err),
  });
};
 