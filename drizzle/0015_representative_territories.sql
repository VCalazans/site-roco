CREATE TYPE "public"."territory_kind" AS ENUM('state', 'region', 'city');--> statement-breakpoint
CREATE TABLE "representative_territories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"representative_id" uuid NOT NULL,
	"kind" "territory_kind" NOT NULL,
	"code" varchar(8) NOT NULL,
	"uf" varchar(2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "representative_territories" ADD CONSTRAINT "representative_territories_representative_id_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."representatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "representative_territories_entry_unique" ON "representative_territories" USING btree ("representative_id","kind","code");--> statement-breakpoint
CREATE INDEX "representative_territories_uf_idx" ON "representative_territories" USING btree ("uf");