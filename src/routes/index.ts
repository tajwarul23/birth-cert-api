import { Router } from "express";
import authRoutes from "./auth.routes";
import applicationRoutes from "./application.routes"
const router = Router();

router.use("/auth", authRoutes);
router.use("/applications", applicationRoutes)

export default router;