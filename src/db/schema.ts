import { date } from "drizzle-orm/pg-core";
import { varchar } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";
import { integer } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";
import { jsonb } from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";
import { text } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

/**-----------ENUMS----------------------- */
export const roleEnum = pgEnum("role", ["citizen", "operator"]);
export const applicationTypeEnum = pgEnum("application_type", [
  "new",
  "correction",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);
export const docTypeEnum = pgEnum("doc_type", [
  "birth_proof",
  "address_proof",
  "current_certificate",
  "correction_proof",
]);

/**---------------MOCK NID RECORDS------------- */
export const nidRegistry = pgTable("nid_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  nidNumber: varchar("nid_number", { length: 17 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  dob: date("date_of_birth").notNull(),
  phone: varchar("phone", { length: 15 }).notNull(),
});

/**----------------USERS------------------- */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  nidHash: text("nid_hash").unique(),
  role: roleEnum("role").notNull().default("citizen"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**-----------------OTPs------------------- */
export const otps = pgTable("otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at)", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**------------------APPLICATIONS (NEW or CORRECTION)----------- */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: applicationTypeEnum("type").notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    formData: jsonb("form_data").notNull(),
    rejectionReason: text("rejection_reason"),
    brn: varchar("brn", { length: 17 }).unique(), //this is mock birth reg number, set on approval
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("applications_user_id_idx").on(table.userId),
    index("applications_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

/**---------------------CORRECTION ITEMS (one row per corrected field)----------- */
export const correctionItems = pgTable("correction_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  filed: varchar("field", { length: 50 }).notNull(),
  oldValue: text("old_value").notNull(),
  newValue: text("new_value").notNull(),
});


/**-------------DOCUMENTS (file details, file lives on cloudinary)--------------- */
export const documents = pgTable("documents", {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("id").notNull().references(()=>applications.id, {onDelete:"cascade"}),
    docType: docTypeEnum("doc_type").notNull(),
    fileUrl: text("file_url").notNull(),
    publicId: text("public_id").notNull(),
    createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
});

/**-------------------STATUS LOGS (with full history)------------ */
export const statusLogs = pgTable("status_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(()=>applications.id, {onDelete:"cascade"}),
    oldStatus: applicationStatusEnum("old_status"),
    newStatus: applicationStatusEnum("new_status").notNull(),
    changedBy:uuid("changed_by").notNull().references(()=>users.id, {onDelete:"restrict"}),
    note: text("note"),
    createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
})

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
