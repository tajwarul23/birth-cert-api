ALTER TABLE "otps" RENAME COLUMN "created_at)" TO "created_at";--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_applications_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "application_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;