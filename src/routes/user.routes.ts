import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get(
  "/search",
  authenticate,
  authorize("operator"),
  userController.searchCitizen,
);
export default router;
