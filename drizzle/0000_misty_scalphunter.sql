CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."application_type" AS ENUM('new', 'correction');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('birth_proof', 'address_proof', 'current_certificate', 'correction_proof');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('citizen', 'operator');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "application_type" NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"form_data" jsonb NOT NULL,
	"rejection_reason" text,
	"brn" varchar(17),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_brn_unique" UNIQUE("brn")
);
--> statement-breakpoint
CREATE TABLE "correction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"field" varchar(50) NOT NULL,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"file_url" text NOT NULL,
	"public_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nid_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nid_number" varchar(17) NOT NULL,
	"name" varchar(100) NOT NULL,
	"date_of_birth" date NOT NULL,
	"phone" varchar(15) NOT NULL,
	CONSTRAINT "nid_registry_nid_number_unique" UNIQUE("nid_number")
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at)" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"old_status" "application_status",
	"new_status" "application_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"password_hash" text NOT NULL,
	"nid_hash" text,
	"role" "role" DEFAULT 'citizen' NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_nid_hash_unique" UNIQUE("nid_hash")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_items" ADD CONSTRAINT "correction_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_applications_id_fk" FOREIGN KEY ("id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_id_idx" ON "applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applications_status_created_at_idx" ON "applications" USING btree ("status","created_at");