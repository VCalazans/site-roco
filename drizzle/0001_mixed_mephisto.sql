CREATE TYPE "public"."sync_run_status" AS ENUM('queued', 'running', 'success', 'error');--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"status" "sync_run_status" DEFAULT 'queued' NOT NULL,
	"stats" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "representatives" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "representatives" ADD COLUMN "review_notes" text;