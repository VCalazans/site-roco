ALTER TABLE "representatives" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "representatives" ADD COLUMN "disabled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "representatives" ADD COLUMN "disable_reason" text;--> statement-breakpoint
ALTER TABLE "representatives" ADD CONSTRAINT "representatives_disabled_by_user_id_user_id_fk" FOREIGN KEY ("disabled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;