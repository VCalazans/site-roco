/**
 * Dados de TESTE para validar o portal num banco LOCAL:
 *   - conta de representante APROVADA (e-mail/senha do `.env.local`);
 *   - imagens de teste em 2 produtos publicados: uma "só no portal" em alta
 *     resolução (valida o download sem perda de qualidade) e uma visível no
 *     site (valida a galeria e a capa);
 *   - 2 materiais de apoio publicados (um PDF e um PNG).
 *
 * Tudo é marcado com o prefixo `qa-teste-` (nomes de arquivo e chaves do R2),
 * então rodar de novo não duplica nada e `--remover` apaga exatamente o que o
 * script criou — no R2 e no banco.
 *
 * Uso:
 *   npm run db:seed:qa                # cria o que faltar
 *   npm run db:seed:qa -- --remover   # remove os dados de teste
 *
 * Env (`.env.local`): DATABASE_URL, R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
 * R2_SECRET_ACCESS_KEY/R2_BUCKET e QA_REPRESENTATIVE_EMAIL /
 * QA_REPRESENTATIVE_PASSWORD (mín. 12 caracteres — nunca há senha no código).
 * Recusa rodar contra um banco que não seja local (proteção contra produção).
 *
 * Roda fora do Next (`tsx`): importa o schema por caminho relativo, como o
 * `seed.ts`. O site lê o catálogo com cache de até 5 min — a imagem de teste
 * visível aparece lá nesse prazo (ou ao reiniciar o container).
 */
import crypto from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createCanvas } from "@napi-rs/canvas";
import bcrypt from "bcryptjs";
import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { isValidCNPJ } from "../shared/components/contact-form/cnpj";
import { users } from "./schema/auth";
import { productImages, products } from "./schema/catalog";
import { materials } from "./schema/materials";
import { representativeTerritories } from "./schema/representative-territories";
import { representatives } from "./schema/representatives";
import { roles, userRoles } from "./schema/rbac";
import { loadEnvFiles, requireEnv } from "./script-env";

const QA_PREFIX = "qa-teste-";
const QA_DEFAULT_EMAIL = "representante.teste@roco.local";
const QA_CNPJ = "11.222.333/0001-81";
/**
 * Área de atuação da conta de teste (códigos da base do IBGE): uma região e uma
 * cidade de estados diferentes — mostra os chips e o filtro por estado do admin.
 */
const QA_TERRITORY = [
  { kind: "region", code: "4204", uf: "SC" },
  { kind: "city", code: "4106902", uf: "PR" },
] as const;
const QA_TERRITORY_SUMMARY = "Vale do Itajaí — SC · Curitiba — PR";
const QA_PRODUCT_COUNT = 2;
const MIN_PASSWORD_LENGTH = 12;
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

type Database = ReturnType<typeof drizzle>;
type Storage = { s3: S3Client; bucket: string };

// ---------------------------------------------------------------------------
// Arquivos de teste
// ---------------------------------------------------------------------------

/** Imagem com a marca "TESTE" bem visível — ninguém confunde com foto de produto. */
async function renderTestImage(options: {
  width: number;
  height: number;
  title: string;
  lines: string[];
  format: "jpeg" | "png";
}): Promise<Buffer> {
  const { width, height } = options;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#062a3a");
  background.addColorStop(1, "#3a2206");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const border = Math.max(8, Math.round(width * 0.012));
  context.strokeStyle = "#3ec6f0";
  context.lineWidth = border;
  context.strokeRect(border, border, width - border * 2, height - border * 2);

  context.textAlign = "center";
  context.fillStyle = "#ffffff";
  context.font = `bold ${Math.round(width * 0.075)}px sans-serif`;
  context.fillText(options.title, width / 2, height * 0.42);

  context.fillStyle = "#f5a33c";
  context.font = `${Math.round(width * 0.034)}px sans-serif`;
  options.lines.forEach((line, index) => {
    context.fillText(line, width / 2, height * (0.55 + index * 0.08));
  });

  return options.format === "jpeg" ? canvas.encode("jpeg", 92) : canvas.encode("png");
}

/** PDF de uma página (fonte padrão Helvetica, sem dependências) — o arquivo do material de teste. */
function renderTestPdf(lines: string[]): Buffer {
  const escape = (text: string) => text.replace(/[\\()]/g, (char) => `\\${char}`);
  const content = [
    "BT",
    "/F1 22 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -30 Td",
      index === 1 ? "/F1 13 Tf" : "",
      `(${escape(line)}) Tj`,
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function upload(storage: Storage, key: string, body: Buffer, contentType: string) {
  await storage.s3.send(
    new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: body, ContentType: contentType })
  );
}

async function removeObject(storage: Storage, key: string) {
  try {
    await storage.s3.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
  } catch (error) {
    console.warn(`[seed-qa] Não removi ${key} do R2 (segue sem ele).`, error);
  }
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

/**
 * O e-mail de teste precisa ser de domínio reservado (`.local`): o script
 * troca a senha dessa conta e o `--remover` a apaga — nunca pode ser a conta
 * de uma pessoa real. Variável vazia vale o padrão.
 */
function qaRepresentativeEmail(): string {
  const email = (process.env.QA_REPRESENTATIVE_EMAIL || QA_DEFAULT_EMAIL).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.local$/.test(email)) {
    throw new Error(`Recusado: QA_REPRESENTATIVE_EMAIL precisa ser de um domínio ".local" (recebido: ${email}).`);
  }
  return email;
}

async function seedRepresentative(db: Database) {
  const email = qaRepresentativeEmail();
  const password = requireEnv("QA_REPRESENTATIVE_PASSWORD");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`QA_REPRESENTATIVE_PASSWORD precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!isValidCNPJ(QA_CNPJ)) throw new Error("CNPJ de teste inválido.");

  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  const userId =
    existing?.id ??
    (
      await db
        .insert(users)
        .values({ email, name: "Representante Teste (QA)", passwordHash, active: true, emailVerified: new Date() })
        .returning({ id: users.id })
    )[0].id;
  if (existing) {
    await db.update(users).set({ passwordHash, active: true }).where(eq(users.id, userId));
  }

  const now = new Date();
  const profile = {
    status: "approved" as const,
    onboardingStep: 5,
    companyName: "Empresa Teste QA Ltda",
    phone: "(47) 99999-0000",
    region: QA_TERRITORY_SUMMARY,
    submittedAt: now,
    reviewedAt: now,
    reviewNotes: "Conta de teste criada por npm run db:seed:qa.",
    updatedAt: now,
  };
  const [representative] = await db
    .select({ id: representatives.id })
    .from(representatives)
    .where(eq(representatives.userId, userId))
    .limit(1);
  if (representative) {
    await db.update(representatives).set(profile).where(eq(representatives.id, representative.id));
  } else {
    // O CNPJ de teste só entra se nenhum outro cadastro já o usa.
    const [cnpjInUse] = await db
      .select({ id: representatives.id })
      .from(representatives)
      .where(eq(representatives.cnpj, QA_CNPJ))
      .limit(1);
    await db.insert(representatives).values({ ...profile, userId, cnpj: cnpjInUse ? null : QA_CNPJ });
  }

  const [saved] = await db
    .select({ id: representatives.id })
    .from(representatives)
    .where(eq(representatives.userId, userId))
    .limit(1);
  await db.delete(representativeTerritories).where(eq(representativeTerritories.representativeId, saved.id));
  await db
    .insert(representativeTerritories)
    .values(QA_TERRITORY.map((entry) => ({ representativeId: saved.id, ...entry })));

  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, "representative")).limit(1);
  if (!role) throw new Error("Perfil 'representative' não existe — rode `npm run db:seed` antes.");
  await db.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();

  console.log(`[seed-qa] Representante aprovado: ${email} (senha: QA_REPRESENTATIVE_PASSWORD do .env.local)`);
}

async function seedProductImages(db: Database, storage: Storage) {
  const existing = await db
    .selectDistinct({ productId: productImages.productId })
    .from(productImages)
    .where(like(productImages.filename, `${QA_PREFIX}%`));
  if (existing.length > 0) {
    console.log(`[seed-qa] Imagens de teste já existem em ${existing.length} produto(s) — nada a fazer.`);
    return;
  }

  // Publicados com exatamente uma imagem: a foto real segue como capa, e as de
  // teste entram DEPOIS dela na ordem de exibição.
  const candidates = await db
    .select({ id: products.id, sku: products.sku, namePt: products.namePt })
    .from(products)
    .innerJoin(productImages, eq(productImages.productId, products.id))
    .where(and(eq(products.published, true), eq(products.active, true)))
    .groupBy(products.id, products.sku, products.namePt)
    .having(sql`count(*) = 1`)
    .orderBy(asc(products.sku))
    .limit(QA_PRODUCT_COUNT);

  for (const product of candidates) {
    const [position] = await db
      .select({ next: sql<number>`coalesce(max(${productImages.sortOrder}) + 1, 0)::int` })
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    let sortOrder = position?.next ?? 0;

    const variants = [
      {
        filename: `${QA_PREFIX}visivel-no-site.jpg`,
        showOnSite: true,
        altPt: `Imagem de teste visível no site — ${product.namePt}`,
        image: { width: 1200, height: 1200, title: "IMAGEM DE TESTE", lines: ["Visível no site", `SKU ${product.sku}`] },
      },
      {
        filename: `${QA_PREFIX}so-no-portal-alta-resolucao.jpg`,
        showOnSite: false,
        altPt: `Imagem de teste só no portal — ${product.namePt}`,
        image: {
          width: 3000,
          height: 3000,
          title: "IMAGEM DE TESTE",
          lines: ["Só no portal · alta resolução", `SKU ${product.sku} · 3000 × 3000 px`],
        },
      },
    ];

    for (const variant of variants) {
      const body = await renderTestImage({ ...variant.image, format: "jpeg" });
      const key = `products/${product.sku}/${QA_PREFIX}${crypto.randomUUID()}.jpg`;
      await upload(storage, key, body, "image/jpeg");
      await db.insert(productImages).values({
        productId: product.id,
        r2Key: key,
        filename: variant.filename,
        contentType: "image/jpeg",
        sizeBytes: body.length,
        altPt: variant.altPt,
        sortOrder: sortOrder++,
        showOnSite: variant.showOnSite,
      });
    }
    console.log(`[seed-qa] 2 imagens de teste em ${product.sku} — ${product.namePt}`);
  }
}

async function seedMaterials(db: Database, storage: Storage) {
  const [existing] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(materials)
    .where(like(materials.r2Key, `materials/${QA_PREFIX}%`));
  if ((existing?.total ?? 0) > 0) {
    console.log("[seed-qa] Materiais de teste já existem — nada a fazer.");
    return;
  }

  const now = new Date();
  const files = [
    {
      extension: "pdf",
      contentType: "application/pdf",
      filename: `${QA_PREFIX}tabela-de-precos.pdf`,
      category: "commercial_policy",
      titlePt: "Tabela de preços (TESTE)",
      titleEn: "Price list (TEST)",
      body: renderTestPdf([
        "MATERIAL DE TESTE - ROCO",
        "Criado por npm run db:seed:qa para validar a biblioteca de materiais.",
        "Pode apagar com: npm run db:seed:qa -- --remover",
      ]),
    },
    {
      extension: "png",
      contentType: "image/png",
      filename: `${QA_PREFIX}banner-whatsapp.png`,
      category: "training",
      titlePt: "Banner para WhatsApp (TESTE)",
      titleEn: "WhatsApp banner (TEST)",
      body: await renderTestImage({
        width: 1080,
        height: 1080,
        title: "MATERIAL DE TESTE",
        lines: ["Banner para WhatsApp", "npm run db:seed:qa"],
        format: "png",
      }),
    },
  ];

  for (const file of files) {
    const key = `materials/${QA_PREFIX}${crypto.randomUUID()}.${file.extension}`;
    await upload(storage, key, file.body, file.contentType);
    await db.insert(materials).values({
      titlePt: file.titlePt,
      titleEn: file.titleEn,
      descriptionPt: "Material de teste criado por npm run db:seed:qa — pode apagar.",
      descriptionEn: "Test material created by npm run db:seed:qa — safe to delete.",
      category: file.category,
      r2Key: key,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.body.length,
      published: true,
      publishedAt: now,
    });
  }
  console.log(`[seed-qa] ${files.length} materiais de teste publicados.`);
}

async function removeQaData(db: Database, storage: Storage) {
  const images = await db
    .select({ id: productImages.id, r2Key: productImages.r2Key })
    .from(productImages)
    .where(like(productImages.filename, `${QA_PREFIX}%`));
  for (const image of images) await removeObject(storage, image.r2Key);
  if (images.length > 0) {
    await db.delete(productImages).where(inArray(productImages.id, images.map((image) => image.id)));
  }

  const qaMaterials = await db
    .select({ id: materials.id, r2Key: materials.r2Key })
    .from(materials)
    .where(like(materials.r2Key, `materials/${QA_PREFIX}%`));
  for (const material of qaMaterials) await removeObject(storage, material.r2Key);
  if (qaMaterials.length > 0) {
    await db.delete(materials).where(inArray(materials.id, qaMaterials.map((material) => material.id)));
  }

  // Cascata: cadastro de representante, perfis e sessões saem junto.
  const email = qaRepresentativeEmail();
  const removedUsers = await db.delete(users).where(eq(users.email, email)).returning({ id: users.id });

  console.log(
    `[seed-qa] Removidos: ${images.length} imagem(ns), ${qaMaterials.length} material(is), ${removedUsers.length} conta(s).`
  );
}

// ---------------------------------------------------------------------------

/**
 * Proteção contra produção: só roda em banco local. `host`/`hostaddr` na
 * querystring são recusados — o driver `pg` os usa no lugar do host da URL,
 * então `postgres://localhost/db?host=prod.exemplo.com` iria para outro lugar.
 * (O bucket do R2 é o do `.env.local`: confira que é o de teste.)
 */
function assertLocalDatabase(connectionString: string) {
  const url = new URL(connectionString);
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) {
    throw new Error("Recusado: DATABASE_URL com host na querystring. Dados de teste só em banco local.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(`Recusado: DATABASE_URL aponta para "${host}". Dados de teste só em banco local.`);
  }
}

async function main() {
  loadEnvFiles();
  const connectionString = requireEnv("DATABASE_URL");
  assertLocalDatabase(connectionString);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  const storage: Storage = {
    s3: new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    }),
    bucket: requireEnv("R2_BUCKET"),
  };

  try {
    if (process.argv.includes("--remover")) {
      await removeQaData(db, storage);
      return;
    }
    await seedRepresentative(db);
    await seedProductImages(db, storage);
    await seedMaterials(db, storage);
    console.log("[seed-qa] Pronto.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed-qa] Falhou:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
