import { Request, Response } from "express";
import { z } from "zod";
import {
  accessCookieOption,
  COOKIE_NAMES,
  refreshCookieOption,
  verificationCookieOption,
} from "../config/cookies";
import { AppError } from "../utils/AppError";
import { LoginInput, RegisterInput, VerifyOtpInput } from "../validators/auth.validators";
import * as authService from "../services/auth.service";
import { isProduction } from "../config/env";

const getVerificationId = (req: Request) => {
  const result = z.uuid().safeParse(req.cookies?.[COOKIE_NAMES.verification]);
  if (!result.success) {
    throw new AppError(
      401,
      "Verification session missing or expired, Please register again",
    );
  }
  return result.data;
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie(COOKIE_NAMES.access, accessToken, accessCookieOption);
  res.cookie(COOKIE_NAMES.refresh, refreshToken, refreshCookieOption);
};
// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  const input: RegisterInput = req.body;
  const { verificationId, otp } = await authService.register(input);

  res.cookie(
    COOKIE_NAMES.verification,
    verificationId,
    verificationCookieOption,
  );
  res.status(201).json({
    success: true,
    message: "OTP sent to the phone on your NID record. It expires in 5 minutes.",
    data: isProduction ? {} : { otp: otp },
  });
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req: Request, res: Response) => {
  const verificationId = getVerificationId(req);
  const { otp }: VerifyOtpInput = req.body;

  const { user, accessToken, refreshToken } = await authService.verifyOtp(
    verificationId,
    otp,
  );

  res.clearCookie(COOKIE_NAMES.verification, verificationCookieOption);
  setAuthCookies(res, accessToken, refreshToken);
  res
    .status(201)
    .json({ success: true, message: "Registration Complete", data: { user } });
};
// POST /api/auth/resend-otp
export const resendOtp = async (req: Request, res: Response) => {
  const verificationId = getVerificationId(req);
  const { otp } = await authService.resendOtp(verificationId);

  res.cookie(
    COOKIE_NAMES.verification,
    verificationId,
    verificationCookieOption,
  );
  res.status(200).json({
    success: true,
    message: "A new OTP was sent",
    data: isProduction ? {} : { otp: otp },
  });
};

// POST /api/auth/login
export const login = async(req: Request, res: Response) =>{
    const {user, accessToken, refreshToken} = await authService.login(req.body);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({
        success:true,
        message:`Welcome ${user.name}`,
        data: {user}
    });

}