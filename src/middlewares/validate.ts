import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
 
// Usage in a route: router.post("/login", validate(loginSchema), controller)
// Checks req.body against the schema. On failure, Zod's error goes to the
// error handler (400). On success, req.body is replaced with the parsed,
// cleaned data (unknown fields removed, transforms applied).
export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
 