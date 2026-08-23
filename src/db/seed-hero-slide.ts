/**
 * Seed do slide inicial do hero da home — espelha o que estava hard-coded
 * em `home-hero.tsx` antes da refatoração (YouTube `rqn-okkh0ww`, copy
 * bilíngue do dicionário). Idempotente: se já existir uma linha com o slug
 * `hero-inicial-youtube`, não insere de novo. Roda FORA do bundle do Next
 * (mesmo padrão de `seed.ts` e `import-product-images.ts`).
 *
 * Uso:
 *   npm run db:seed-hero-slide
 *
 * Por que um script separado (e não parte do `db:seed`)? O `db:seed` é
 * RBAC puro (roles/permissions) e roda toda vez que o esquema muda; misturar
 * conteúdo editorial (hero) com RBAC amarra o deploy a uma aprovação humana
 * da copy. Mantê-los separados respeita o runbook: `db:migrate` → `db:seed`
 * → (opcional) `db:seed-hero-slide`.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { heroSlides } from "./schema/hero-slides";

const INITIAL_SLUG = "hero-inicial-youtube";
const INITIAL_YOUTUBE_ID = "rqn-okkh0ww";

function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.resolve(__dirname, "..", "..", file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const [, name, rawValue] = match;
      if (process.env[name] !== undefined) continue;
      process.env[name] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

async function main(): Promise<void> {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
  }
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const [existing] = await db
      .select({ id: heroSlides.id })
      .from(heroSlides)
      .where(eq(heroSlides.slug, INITIAL_SLUG))
      .limit(1);

    if (existing) {
      console.log(`[seed-hero-slide] slide "${INITIAL_SLUG}" já existe — pulando.`);
      return;
    }

    await db.insert(heroSlides).values({
      slug: INITIAL_SLUG,
      kind: "youtube",
      youtubeId: INITIAL_YOUTUBE_ID,
      r2Key: null,
      r2PosterKey: "/images/hero/hero-stage.jpg",
      eyebrowPt: "Soluções Industriais",
      eyebrowEn: "Industrial Solutions",
      headlinePt: "Hidrossanitários e Hidráulica com Qualidade",
      headlineEn: "Quality Plumbing & Hydraulic Solutions",
      descriptionPt:
        "Conheça a linha completa de produtos ROCO. Desenvolvidos para atender às demandas mais exigentes do mercado industrial brasileiro.",
      descriptionEn:
        "Explore ROCO's complete product line — engineered to meet the most demanding Brazilian industrial market requirements.",
      primaryCtaLabelPt: "Conheça nossos Produtos",
      primaryCtaLabelEn: "Explore Our Products",
      primaryCtaHref: "/produtos",
      secondaryCtaLabelPt: "Baixar Catálogo",
      secondaryCtaLabelEn: "Download Catalog",
      secondaryCtaHref: "#catalogo",
      loopWindowStartSeconds: null,
      loopWindowEndSeconds: null,
      muted: true,
      sortOrder: 0,
      published: true,
      startsAt: null,
      endsAt: null,
    });

    console.log(`[seed-hero-slide] slide "${INITIAL_SLUG}" inserido (kind=youtube, id=${INITIAL_YOUTUBE_ID}).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[seed-hero-slide] Falhou:", error);
  process.exit(1);
});
