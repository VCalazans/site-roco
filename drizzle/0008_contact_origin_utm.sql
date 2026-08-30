ALTER TYPE "public"."contact_subject" ADD VALUE 'catalog';--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN "utm_campaign" text;