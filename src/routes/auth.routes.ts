import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { loginSchema, registerSchema, verifyOtpSchema } from "../validators/auth.validators";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", validate(loginSchema), authController.login);

export default router;