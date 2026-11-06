import { CookieOptions } from "express";
import { env, isProduction } from "./env";

export const COOKIE_NAMES = {
  verification: "verification_id",
  access: "access_token",
  refresh: "refresh_token",
} as const;

const base: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
};

export const verificationCookieOption: CookieOptions = {
  ...base,
  path: "/api/auth",
  maxAge: env.VERIFICATION_TOKEN_MINUTES * 60 * 1000,
};

export const accessCookieOption: CookieOptions = {
    ...base,
    path: "/",
    maxAge:env.ACCESS_TOKEN_MINUTES * 60 * 1000,
};
export const refreshCookieOption: CookieOptions = {
    ...base,
    path: "/api/auth",
    maxAge:env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
};

