ALTER TABLE "contact_submissions" ADD COLUMN "meta_capi_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN "meta_capi_error" text;