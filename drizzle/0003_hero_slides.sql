CREATE TABLE "hero_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"youtube_id" varchar(32),
	"r2_key" text,
	"r2_poster_key" text,
	"eyebrow_pt" text,
	"eyebrow_en" text,
	"headline_pt" text NOT NULL,
	"headline_en" text,
	"description_pt" text,
	"description_en" text,
	"primary_cta_label_pt" text,
	"primary_cta_label_en" text,
	"primary_cta_href" text,
	"secondary_cta_label_pt" text,
	"secondary_cta_label_en" text,
	"secondary_cta_href" text,
	"loop_window_start_seconds" integer,
	"loop_window_end_seconds" integer,
	"muted" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_slides_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hero_slides_published_sort_idx" ON "hero_slides" USING btree ("published","sort_order");