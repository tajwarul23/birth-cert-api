import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^\+8801\d{9}$/, "Phone must look like +8801XXXXXXXXX");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[0-9]/, "Password needs a number")
  .regex(/[^A-Za-z0-9]/, "Password needs a special character");
