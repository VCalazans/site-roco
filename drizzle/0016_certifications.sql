CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_pt" text NOT NULL,
	"name_en" text,
	"note_pt" text,
	"note_en" text,
	"alt_pt" text,
	"alt_en" text,
	"image_key" text,
	"image_path" text,
	"link_url" text,
	"valid_until" date,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Selo que já estava no site (fixo no código até 2026-10-13): entra cadastrado para a equipe gerenciar.
INSERT INTO "certifications" ("name_pt", "name_en", "note_pt", "note_en", "alt_pt", "alt_en", "image_path", "valid_until", "sort_order") SELECT 'Great Place To Work®', 'Great Place To Work®', 'Certificada · fev 2026 – fev 2027', 'Certified · Feb 2026 – Feb 2027', 'Selo Great Place To Work Certificada, fevereiro de 2026 a fevereiro de 2027, Brasil', 'Great Place To Work Certified seal, February 2026 to February 2027, Brazil', '/images/certifications/gptw-certificada-2026-2027.png', '2027-02-28', 0 WHERE NOT EXISTS (SELECT 1 FROM "certifications");
