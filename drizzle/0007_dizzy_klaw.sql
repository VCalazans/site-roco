CREATE TYPE "public"."contact_subject" AS ENUM('call_back', 'quote', 'general');--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" "contact_subject" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"company_name" text,
	"cnpj" varchar(18),
	"message" text,
	"product_slug" text,
	"product_name" text,
	"product_sku" text,
	"locale" varchar(5) NOT NULL,
	"client_tracking_id" uuid NOT NULL,
	"consent_granted" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"rd_station_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rd_station_event_uuid" text,
	"rd_station_error" text,
	"email_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"email_error" text,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_submissions_client_tracking_id_unique" UNIQUE("client_tracking_id")
);
--> statement-breakpoint
CREATE INDEX "contact_submissions_created_at_idx" ON "contact_submissions" USING btree ("created_at");