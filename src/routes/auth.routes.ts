import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
} from "../validators/auth.validators";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me", authenticate, authController.getMe);

export default router;
