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
    message: "OTP sent (mock). For MVP demonstration only, the OTP is returned in the response.",
     data: { otp },
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
    message: "OTP sent (mock). For MVP demonstration only, the OTP is returned in the response.",
     data: { otp },
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

//post /api/auth/logout
export const logout = async(req: Request, res: Response)=>{
    await authService.logout(req.cookies?.[COOKIE_NAMES.refresh]);
    res.clearCookie(COOKIE_NAMES.access, accessCookieOption);
    res.clearCookie(COOKIE_NAMES.refresh, refreshCookieOption);

    res.status(200).json({success:true, message:"Logged out"});
}

// POST /api/auth/refresh
export const refresh = async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, expiresAt } = await authService.refresh(
      req.cookies?.[COOKIE_NAMES.refresh],
    );

    res.cookie(COOKIE_NAMES.access, accessToken, accessCookieOption);
    res.cookie(COOKIE_NAMES.refresh, refreshToken, {
      ...refreshCookieOption,
      maxAge: expiresAt.getTime() - Date.now(),
    });

    res.status(200).json({ success: true, message: "Token refreshed" });
  } catch (err) {
    res.clearCookie(COOKIE_NAMES.access, accessCookieOption);
    res.clearCookie(COOKIE_NAMES.refresh, refreshCookieOption);
    throw err;
  }
};

// GET /api/auth/me
export const getMe = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
};