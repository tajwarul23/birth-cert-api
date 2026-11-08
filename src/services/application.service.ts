import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  applications,
  correctionItems,
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
import type {
  CorrectionForm,
  listApplicationQuery,
  NewApplicationForm,
  updateStatusInput,
} from "../validators/application.validators";
import { hmac } from "../utils/hash";
import { Role } from "../utils/token";
import { asc } from "drizzle-orm";
import { randomInt } from "node:crypto";

// What Multer gives us: { birth_proof: [file], address_proof: [file] }
export type UploadedFiles = Record<string, Express.Multer.File[]>;

type UploadedDoc = UploadedFile & { docType: string };

// what a correction row stores in form_data
type CorrectionFormData = {
  brn: string;
  reason: string;
  originalApplicationId: string;
};

// a form split into sections: { child: {...}, father: {...}, ... }
type FormSections = Record<string, Record<string, unknown>>;

const DUPLICATE_CHILD_MESSAGE =
  "An application for this child is already pending or approved";
const BRN_NOT_FOUND_MESSAGE =
  "No approved birth certificate found with this BRN";
const PENDING_CORRECTION_MESSAGE =
  "A correction for this certificate is already pending";

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

// A correction needs the current certificate + proof of the correct value
const checkCorrectionDocs = (files: UploadedFiles) => {
  if (!files.current_certificate)
    throw new AppError(400, "current_certificate is required");
  if (!files.correction_proof)
    throw new AppError(400, "correction_proof is required");
};

// The approved application that has this BRN
const findApprovedByBrn = async (brn: string) => {
  const original = await db.query.applications.findFirst({
    where: and(eq(applications.brn, brn), eq(applications.status, "approved")),
  });
  if (!original) {
    throw new AppError(404, BRN_NOT_FOUND_MESSAGE);
  }
  return original;
};

// Only one open correction per certificate
const checkNoOpenCorrection = async (brn: string) => {
  const open = await db.query.applications.findFirst({
    where: and(
      eq(applications.type, "correction"),
      eq(applications.status, "pending"),
      sql`${applications.formData}->>'brn' = ${brn}`,
    ),
  });
  if (open) {
    throw new AppError(409, PENDING_CORRECTION_MESSAGE);
  }
};

export const createCorrection = async (
  userId: string,
  form: CorrectionForm,
  files: UploadedFiles,
) => {
  // 1. Checks, in order: who is asking comes before revealing anything about the certificate
  checkCorrectionDocs(files);
  const original = await findApprovedByBrn(form.brn);
  const originalForm = original.formData as NewApplicationForm;
  try {
    await checkApplicantIsParent(userId, originalForm);
  } catch (err) {
    // Not your certificate: answer the same as "doesn't exist", so BRNs can't be probed.
    // Only the 403 is rewritten; DB errors etc. still surface as-is.
    if (err instanceof AppError && err.statusCode === 403) {
      throw new AppError(404, BRN_NOT_FOUND_MESSAGE);
    }
    throw err;
  }
  await checkNoOpenCorrection(form.brn);

  // 2. Find each old value in the saved form. "child.nameEn" -> section "child", key "nameEn"
  //    oldValue comes from OUR database, never from the client.
  const savedForm = original.formData as Record<
    string,
    Record<string, unknown>
  >;
  const items = form.items.map((item) => {
    const [section, key] = item.field.split(".");
    const oldValue = String(savedForm[section][key]);
    if (oldValue === item.newValue) {
      throw new AppError(
        400,
        `${item.field} is already "${oldValue}", nothing to correct`,
      );
    }
    return { field: item.field, oldValue, newValue: item.newValue };
  });

  // 3. Upload, then save everything in one transaction
  const uploaded = await uploadAll(files);
  try {
    return await db.transaction(async (tx) => {
      const [application] = await tx
        .insert(applications)
        .values({
          userId,
          type: "correction",
          formData: {
            brn: form.brn,
            reason: form.reason,
            originalApplicationId: original.id,
          },
        })
        .returning({
          id: applications.id,
          type: applications.type,
          status: applications.status,
          createdAt: applications.createdAt,
        });

      await tx
        .insert(correctionItems)
        .values(items.map((i) => ({ applicationId: application.id, ...i })));

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
        oldStatus: null,
        newStatus: "pending",
        changedBy: userId,
        note: "Correction submitted",
      });

      return { ...application, items };
    });
  } catch (err) {
    await deleteDocuments(uploaded.map((u) => u.publicId));
    // lost the race against a concurrent correction for the same BRN
    if (isUniqueViolation(err)) {
      throw new AppError(409, PENDING_CORRECTION_MESSAGE);
    }
    throw err;
  }
};

export const getMyApplications = async (userId: string) => {
  return db.query.applications.findMany({
    where: eq(applications.userId, userId),
    orderBy: desc(applications.createdAt), // newest first
    columns: {
      id: true,
      type: true,
      status: true,
      brn: true,
      formData: true,
      createdAt: true,
    },
  });
};

export const getApplicationDetailsById = async (
  user: { id: string; role: Role },
  applicationId: string,
) => {
  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });

  if (
    !application ||
    (user.role === "citizen" && application?.userId !== user.id)
  )
    throw new AppError(404, "Application not found");

  const [history, docs, correctionItem] = await Promise.all([
    db
      .select({
        id: statusLogs.id,
        oldStatus: statusLogs.oldStatus,
        newStatus: statusLogs.newStatus,
        note: statusLogs.note,
        createdAt: statusLogs.createdAt,
        changedByName: users.name,
        changedByRole: users.role,
      })
      .from(statusLogs)
      .innerJoin(users, eq(users.id, statusLogs.changedBy))
      .where(eq(statusLogs.applicationId, applicationId))
      .orderBy(asc(statusLogs.createdAt)),

    db.query.documents.findMany({
      where: eq(documents.applicationId, applicationId),
    }),

    db.query.correctionItems.findMany({
      where: eq(correctionItems.applicationId, applicationId),
    }),
  ]);

  return {
    ...application,
    documents: docs,
    correctionItems: correctionItem,
    history,
  };
};

const generateBrn = () => {
  const year = new Date().getFullYear().toString();
  const random = randomInt(0, 10 ** 13)
    .toString()
    .padStart(13, "0");
  return random + year;
};
export const updateApplicationStatus = async (
  applicationId: string,
  operatorId: string,
  input: updateStatusInput,
) => {
  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!application) throw new AppError(404, "Application not found");
  if (application.status !== "pending") {
    throw new AppError(
      409,
      `This application has already been ${application.status}.`,
    );
  }

  return db.transaction(async (tx) => {
    //update the application and statusLogs
    const [updated] = await tx
      .update(applications)
      .set(
        input.status === "approved"
          ? {
              status: "approved",
              brn: application.type === "new" ? generateBrn() : null,
            }
          : { status: "rejected", rejectionReason: input.reason },
      )
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.status, "pending"),
        ),
      )
      .returning();

    if (!updated)
      throw new AppError(
        409,
        "Application was already reviewed by another operator",
      );

    await tx.insert(statusLogs).values({
      applicationId,
      oldStatus: "pending",
      newStatus: input.status,
      changedBy: operatorId,
      note: input.status === "rejected" ? input.reason : "Application approved",
    });

    //for correction-application, update the old application form data too
    if (input.status === "approved" && application.type === "correction") {
      // 1. Find the original application this correction is for
      const correctionData = application.formData as CorrectionFormData;
      const originalId = correctionData.originalApplicationId;

      const original = await tx.query.applications.findFirst({
        where: eq(applications.id, originalId),
      });
      if (!original) throw new AppError(404, "Original application not found");

      // 2. Get the fields to change
      const items = await tx.query.correctionItems.findMany({
        where: eq(correctionItems.applicationId, applicationId),
      });

      // 3. Copy the original form, then put in the new values
      const newFormData: FormSections = JSON.parse(
        JSON.stringify(original.formData),
      );
      for (const item of items) {
        const [section, key] = item.field.split("."); // "child.nameEn" → "child", "nameEn"
        newFormData[section][key] = item.newValue;
      }

      // 4. Save the new form on the original
      await tx
        .update(applications)
        .set({ formData: newFormData })
        .where(eq(applications.id, original.id));

      // 5. Add a log on the original so its history shows the correction
      await tx.insert(statusLogs).values({
        applicationId: original.id,
        oldStatus: "approved",
        newStatus: "approved",
        changedBy: operatorId,
        note: `Corrected: ${items.map((item) => item.field).join(", ")}`,
      });
    }

    return updated;
  });
};

export const listApplications = async (query: listApplicationQuery) => {
  const filters = and(
    query.status ? eq(applications.status, query.status) : undefined,
    query.type ? eq(applications.type, query.type) : undefined,
  );

  if (query.cursor) {
    const cursorRow = await db.query.applications.findFirst({
      where: eq(applications.id, query.cursor),
      columns: { id: true },
    });
    if (!cursorRow) throw new AppError(400, "Invalid cursor");
  }

  const afterCursor = query.cursor
    ? sql`(${applications.createdAt}, ${applications.id}) > (select created_at, id from applications where id = ${query.cursor})`
    : undefined;

  const [total, rows] = await Promise.all([
    db.$count(applications, filters),
    db.query.applications.findMany({
      where: and(filters, afterCursor),
      orderBy: [asc(applications.createdAt), asc(applications.id)],
      limit: query.limit + 1,
      columns: {
        id: true,
        type: true,
        status: true,
        brn: true,
        createdAt: true,
      },
    }),
  ]);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    total,
    applications: pageRows,
    nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
  };
};
