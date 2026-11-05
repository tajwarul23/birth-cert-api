import { z } from "zod";
import { passwordSchema, phoneSchema } from "./common";

const yearsAgo = (years: number) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
};
const nidSchema = z
  .string()
  .regex(/^(\d{10}|\d{13}|\d{17})$/, "NID must be 10, 13 or 17 digits");

const dobSchema = z.iso
  .date({ error: "Date of birth must look like YYYY-MM-DD", abort: true })
  .refine((date) => date >= yearsAgo(150), {
    message: "Date of birth is too far in the past",
  })
  .refine((date) => date <= yearsAgo(18), {
    message: "You must be at least 18 years old",
  });

export const registerSchema = z.object({
  nid: nidSchema,
  dob: dobSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z
    .string()
    .min(1, "Password is required")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
      message: "Password is too long",
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
