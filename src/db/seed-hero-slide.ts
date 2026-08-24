/**
 * Seed do slide inicial do hero da home.
 *
 * Usa o vídeo institucional hospedado no R2 (`kind: "upload"`), NÃO o embed
 * do YouTube. O motivo é o requisito original do stakeholder: "não deve ser
 * renderizado um player com botão de pause e etc". O embed do YouTube arrasta
 * o chrome do player (título, legendas, marca-d'água, controles) e nenhum
 * parâmetro de embed desliga isso de forma confiável — a mitigação era um
 * overscan de 35% cortando as bordas para fora da tela. Já a tag `<video>`
 * nativa, como o `HeroSlider` a renderiza (`loop`, `muted`, `playsinline`,
 * `pointer-events-none`, sem `controls`), não tem chrome nenhum.
 *
 * Idempotente em dois níveis:
 *  - se o slide novo já existe, não faz nada;
 *  - se existe o slide LEGADO do YouTube (`hero-inicial-youtube`, criado
 *    antes de o MP4 estar no bucket), ele é CONVERTIDO no lugar em vez de
 *    inserir um segundo — do contrário o carrossel passaria a alternar entre
 *    o vídeo e o embed antigo.
 *
 * Roda FORA do bundle do Next (mesmo padrão de `seed.ts` e
 * `import-product-images.ts`).
 *
 * Uso:
 *   npm run db:seed-hero-slide
 *
 * A chave do objeto pode ser trocada por env quando o bucket de produção for
 * outro:
 *   HERO_VIDEO_R2_KEY=hero/outro-arquivo.mp4 npm run db:seed-hero-slide
 *
 * Por que um script separado (e não parte do `db:seed`)? O `db:seed` é
 * RBAC puro (roles/permissions) e roda toda vez que o esquema muda; misturar
 * conteúdo editorial (hero) com RBAC amarra o deploy a uma aprovação humana
 * da copy. Mantê-los separados respeita o runbook: `db:migrate` → `db:seed`
 * → `db:seed-hero-slide`.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { heroSlides } from "./schema/hero-slides";

const SLUG = "hero-institucional";
/** Slug do slide YouTube criado antes de o MP4 existir no bucket. */
const LEGACY_SLUG = "hero-inicial-youtube";
const DEFAULT_VIDEO_KEY = "hero/rocoinstitucional.mp4";

/**
 * `r2PosterKey` fica NULO de propósito.
 *
 * O campo é uma chave de objeto no R2 e `getPublicUrl` sempre a prefixa com
 * `R2_PUBLIC_URL`. A versão anterior deste seed gravava
 * `/images/hero/hero-stage.jpg`, que é um caminho do `public/` local — o
 * resultado virava `https://<bucket>.r2.dev/images/hero/hero-stage.jpg`, que
 * não existe (404). E como a URL saía não-nula, o fallback do slider
 * (`posterUrl ?? posterFallbackSrc`) nunca era acionado. Com `null`, o
 * slider usa corretamente o pôster local que já vem do dicionário.
 */
const POSTER_R2_KEY = null;

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
  const videoKey = process.env.HERO_VIDEO_R2_KEY?.trim() || DEFAULT_VIDEO_KEY;

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const midia = {
    kind: "upload" as const,
    youtubeId: null,
    r2Key: videoKey,
    r2PosterKey: POSTER_R2_KEY,
  };

  const conteudo = {
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
  };

  try {
    const [atual] = await db
      .select({ id: heroSlides.id })
      .from(heroSlides)
      .where(eq(heroSlides.slug, SLUG))
      .limit(1);

    if (atual) {
      console.log(`[seed-hero-slide] slide "${SLUG}" já existe — pulando.`);
      return;
    }

    const [legado] = await db
      .select({ id: heroSlides.id })
      .from(heroSlides)
      .where(eq(heroSlides.slug, LEGACY_SLUG))
      .limit(1);

    if (legado) {
      await db
        .update(heroSlides)
        .set({ slug: SLUG, ...midia, updatedAt: new Date() })
        .where(eq(heroSlides.id, legado.id));
      console.log(
        `[seed-hero-slide] slide legado "${LEGACY_SLUG}" convertido para "${SLUG}" (kind=upload, r2Key=${videoKey}).`
      );
      return;
    }

    await db.insert(heroSlides).values({ slug: SLUG, ...midia, ...conteudo });
    console.log(
      `[seed-hero-slide] slide "${SLUG}" inserido (kind=upload, r2Key=${videoKey}).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[seed-hero-slide] Falhou:", error);
  process.exit(1);
});
