CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "otps" DROP CONSTRAINT "otps_user_id_unique";--> statement-breakpoint
ALTER TABLE "otps" DROP CONSTRAINT "otps_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "otps" ADD COLUMN "nid_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "otps" ADD COLUMN "name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "otps" ADD COLUMN "phone" varchar(15) NOT NULL;--> statement-breakpoint
ALTER TABLE "otps" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "otps" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone_verified";--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_nid_hash_unique" UNIQUE("nid_hash");