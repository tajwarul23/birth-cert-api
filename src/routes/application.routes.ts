import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { uploadCorrectionDocs, uploadNewApplicationDocs } from "../middlewares/upload";
import * as applicationController from "../controllers/application.controller";

const router = Router();

router.post("/new", authenticate, authorize("citizen"),uploadNewApplicationDocs, applicationController.createNew);
router.post("/correction", authenticate, authorize("citizen"),uploadCorrectionDocs, applicationController.createCorrection);
router.get("/me", authenticate, authorize("citizen"), applicationController.getMyApplications)

export default router;