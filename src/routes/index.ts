import { Router } from "express";
import authRoutes from "./auth.routes";
import applicationRoutes from "./application.routes";
import userRoutes from "./user.routes"
const router = Router();

router.use("/auth", authRoutes);
router.use("/applications", applicationRoutes);
router.use("/users", userRoutes);


export default router;