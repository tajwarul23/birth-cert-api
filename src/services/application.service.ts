import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  applications,
  documents,
  nidRegistry,
  statusLogs,
  users,
} from "../db/schema";
import { AppError } from "../utils/AppError";
import {
  deleteDocuments,
  uploadDocument,
  type UploadedFile,
} from "../utils/storage";
import type { NewApplicationForm } from "../validators/application.validators";
import { hmac } from "../utils/hash";


// What Multer gives us: { birth_proof: [file], address_proof: [file] }
export type UploadedFiles = Record<string, Express.Multer.File[]>;

type UploadedDoc = UploadedFile & { docType: string };

const DUPLICATE_CHILD_MESSAGE =
  "An application for this child is already pending or approved";

// Postgres unique_violation. Drizzle wraps driver errors, so the pg error may sit on `cause`.
const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};

// A new application needs exactly these 2 documents
const checkNewDocs = (files: UploadedFiles) => {
  if (!files.birth_proof) throw new AppError(400, "birth_proof is required");
  if (!files.address_proof)
    throw new AppError(400, "address_proof is required");
};

// The logged-in user must be the child's father or mother
const checkApplicantIsParent = async (
  userId: string,
  form: NewApplicationForm,
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { nidHash: true },
  });
  const parentHashes = [hmac(form.father.nid), hmac(form.mother.nid)];
  if (!user?.nidHash || !parentHashes.includes(user.nidHash)) {
    throw new AppError(403, "Only the child's father or mother can apply");
  }
};

// One parent's NID must exist in the mock registry, with the same English name
const checkParent = async (label: string, nid: string, nameEn: string) => {
  const record = await db.query.nidRegistry.findFirst({
    where: eq(nidRegistry.nidNumber, nid),
  });
  if (!record) {
    throw new AppError(400, `${label}'s NID was not found`);
  }
  if (record.name.toLowerCase() !== nameEn.toLowerCase()) {
    throw new AppError(
      400,
      `${label}'s English name doesn't match the NID record`,
    );
  }
};

// Upload files one by one. If one fails, delete the ones already uploaded.
const uploadAll = async (files: UploadedFiles) => {
  const uploaded: UploadedDoc[] = [];
  try {
    for (const [docType, fileList] of Object.entries(files)) {
      const result = await uploadDocument(fileList[0]);
      uploaded.push({ docType, ...result });
    }
    return uploaded;
  } catch (err) {
    await deleteDocuments(uploaded.map((u) => u.publicId));
    throw err;
  }
};
export const createNewApplication = async (
  userId: string,
  form: NewApplicationForm,
  files: UploadedFiles,
) => {
  // 1. Checks that need no upload first (fail fast, nothing to clean up)
  checkNewDocs(files);
  await checkApplicantIsParent(userId, form);
  await Promise.all([
    checkParent("Father", form.father.nid, form.father.nameEn),
    checkParent("Mother", form.mother.nid, form.mother.nameEn),
  ]);

  // 2. Same child (same DOB + mother + birth order) can't have another open or approved new application.
  //    birthOrder tells twins apart. The unique index "applications_new_child_unique" is the real guard
  //    against concurrent submits; this check just fails early with a clear message before uploading.
  const duplicate = await db.query.applications.findFirst({
    where: and(
      eq(applications.type, "new"),
      inArray(applications.status, ["pending", "approved"]),
      sql`${applications.formData}->'child'->>'dateOfBirth' = ${form.child.dateOfBirth}`,
      sql`${applications.formData}->'mother'->>'nid' = ${form.mother.nid}`,
      sql`(${applications.formData}->'child'->>'birthOrder')::int = ${form.child.birthOrder}`,
    ),
    columns: { id: true },
  });
  if (duplicate) {
    throw new AppError(409, DUPLICATE_CHILD_MESSAGE);
  }

  // 3. Upload files to Cloudinary
  const uploaded = await uploadAll(files);

  // 4. Save everything in one transaction. If it fails, remove the uploaded files.
  try {
    return await db.transaction(async (tx) => {
      const [application] = await tx
        .insert(applications)
        .values({ userId, type: "new", formData: form })
        .returning({
          id: applications.id,
          type: applications.type,
          status: applications.status,
          createdAt: applications.createdAt,
        });

      await tx.insert(documents).values(
        uploaded.map((u) => ({
          applicationId: application.id,
          docType: u.docType as (typeof documents.$inferInsert)["docType"],
          fileUrl: u.fileUrl,
          publicId: u.publicId,
        })),
      );

      await tx.insert(statusLogs).values({
        applicationId: application.id,
        oldStatus: null, // nothing before
        newStatus: "pending",
        changedBy: userId,
        note: "Application submitted",
      });

      return application;
    });
  } catch (err) {
    await deleteDocuments(uploaded.map((u) => u.publicId));
    // lost the race against a concurrent submit for the same child
    if (isUniqueViolation(err)) {
      throw new AppError(409, DUPLICATE_CHILD_MESSAGE);
    }
    throw err;
  }
};
