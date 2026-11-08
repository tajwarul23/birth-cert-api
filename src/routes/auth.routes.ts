import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
} from "../validators/auth.validators";
import { authenticate } from "../middlewares/authenticate";
import {
  loginLimiter,
  registerLimiter,
  resendOtpLimiter,
  verifyOtpLimiter,
} from "../middlewares/rateLimit";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/verify-otp",
  verifyOtpLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp,
);
router.post("/resend-otp", resendOtpLimiter, authController.resendOtp);
router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  authController.login,
);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me", authenticate, authController.getMe);

export default router;
