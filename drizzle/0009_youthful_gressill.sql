ALTER TYPE "public"."contact_subject" ADD VALUE 'cart';--> statement-breakpoint
CREATE TABLE "contact_submission_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"product_slug" text,
	"product_name" text,
	"product_sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_submission_items" ADD CONSTRAINT "contact_submission_items_submission_id_contact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."contact_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_submission_items_submission_id_idx" ON "contact_submission_items" USING btree ("submission_id");