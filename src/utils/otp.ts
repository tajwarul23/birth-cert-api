import crypto from "node:crypto";
import { env } from "../config/env";


export const generateOtp = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
export const otpExpiryDate = () =>
  new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
