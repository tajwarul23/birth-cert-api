DROP INDEX "applications_status_created_at_idx";--> statement-breakpoint
CREATE INDEX "applications_status_created_at_id_idx" ON "applications" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "applications_created_at_id_idx" ON "applications" USING btree ("created_at","id");