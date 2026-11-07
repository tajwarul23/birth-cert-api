import cloudinary from "../config/cloudinary";
import { AppError } from "./AppError";


const detectRealType = (buffer: Buffer) => {
  if (buffer.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  return null;
};


const resourceTypeFor = (mimetype: string) => (mimetype === "application/pdf" ? "raw" : "image");

export interface UploadedFile {
  fileUrl: string;
  publicId: string;
}

export const uploadDocument = async (file: Express.Multer.File): Promise<UploadedFile> => {
  if (detectRealType(file.buffer) !== file.mimetype) {
    throw new AppError(400, `${file.fieldname}: file content doesn't match its type`);
  }

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "birth-certificate/documents",
    resource_type: resourceTypeFor(file.mimetype),
    type: "authenticated", 
  });

  return { fileUrl: result.secure_url, publicId: result.public_id };
};


export const deleteDocuments = async (publicIds: string[]) => {
  await Promise.allSettled(
    publicIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId, {
        type: "authenticated",
        resource_type: publicId.endsWith(".pdf") ? "raw" : "image",
        invalidate: true,
      }),
    ),
  );
};