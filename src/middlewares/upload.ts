import multer from "multer";
import { AppError } from "../utils/AppError";

export const MAX_FILE_SIZE_MB = 2;
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, // bytes
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError(400, `${file.fieldname}: only PDF, JPEG or PNG files are allowed`));
    }
    cb(null, true);
  },
});


export const uploadNewApplicationDocs = upload.fields([
  { name: "birth_proof", maxCount: 1 },
  { name: "address_proof", maxCount: 1 },
]);

export const uploadCorrectionDocs = upload.fields([
  { name: "current_certificate", maxCount: 1 },
  { name: "correction_proof", maxCount: 1 },
]);