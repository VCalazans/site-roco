/**
 * Gera os assets de marca do site a partir dos ORIGINAIS entregues pelo
 * stakeholder (spec 001, 2026-09-29). Reprodutível: rode de novo sempre que a
 * ROCO mandar uma versão nova das logos.
 *
 *   node scripts/build-brand-assets.mjs
 *
 * Entrada (docs/marca/logos-originais/, não servidos pelo site):
 *   Logo-Roco_branco.png   — logotipo 2D branco (com ~50% de margem transparente)
 *   LOGO-ROCO_SLOGAN.png   — assinatura com "onde tudo se conecta"
 *   LOGO-ROCO-3D_001.png   — logotipo 3D azul/branco
 *
 * Saída:
 *   public/images/logos/roco-logo-white.png        header, portal (tema escuro)
 *   public/images/logos/roco-logo-blue.png         portal (tema claro)
 *   public/images/logos/roco-logo-slogan-white.png rodapé
 *   public/images/logos/roco-logo-slogan-blue.png  superfícies claras
 *   public/images/logos/roco-logo-3d.png           peça central do hero
 *   src/app/icon.png (512) / src/app/apple-icon.png (180) — monograma "R"
 *   public/images/home/fachada-roco.jpg            recorte do galpão no render do hero
 *
 * Tudo é RECORTADO na bbox real do alfa: com a margem original, o `next/image`
 * reservaria a caixa errada e o logo ficaria menor que o espaço da barra.
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "docs/marca/logos-originais";
const OUT = "public/images/logos";
/** Azul da marca amostrado das faces laterais do logo 3D (≈ #084888), um tom
 *  acima para contraste em fundo branco (~8,9:1). */
const BLUE = { r: 0x0a, g: 0x4a, b: 0x94 };

mkdirSync(OUT, { recursive: true });

async function trimmed(file) {
  return sharp(`${SRC}/${file}`).trim({ threshold: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function toPng({ data, info }) {
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({
    compressionLevel: 9,
    adaptiveFiltering: true,
  });
}

/** Recolore mantendo o alfa (logo branca → cor sólida). */
function recolor({ data, info }, { r, g, b }) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return { data: out, info };
}

/** Ícone quadrado: navy da marca + brilhos ciano/âmbar + monograma "R" branco. */
async function icon(glyph, size, rounded) {
  const glyphPng = await sharp(glyph).resize({ height: Math.round(size * 0.62), kernel: "lanczos3" }).png().toBuffer();
  const meta = await sharp(glyphPng).metadata();
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="c" cx="18%" cy="12%" r="70%"><stop offset="0" stop-color="#35d9ff" stop-opacity="0.38"/><stop offset="1" stop-color="#35d9ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="a" cx="88%" cy="95%" r="65%"><stop offset="0" stop-color="#ffb454" stop-opacity="0.30"/><stop offset="1" stop-color="#ffb454" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="#071225"/>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#c)"/>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#a)"/>
  </svg>`);
  return sharp(background).composite([
    { input: glyphPng, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) },
  ]);
}

const white = await trimmed("Logo-Roco_branco.png");
await toPng(white).toFile(`${OUT}/roco-logo-white.png`);
await toPng(recolor(white, BLUE)).toFile(`${OUT}/roco-logo-blue.png`);

const slogan = await trimmed("LOGO-ROCO_SLOGAN.png");
await toPng(slogan).toFile(`${OUT}/roco-logo-slogan-white.png`);
await toPng(recolor(slogan, BLUE)).toFile(`${OUT}/roco-logo-slogan-blue.png`);

await toPng(await trimmed("LOGO-ROCO-3D_001.png")).toFile(`${OUT}/roco-logo-3d.png`);

// Monograma: a primeira corrida contínua de colunas com alfa é o "R" (com a barra).
const { data, info } = white;
let glyphEnd = 0;
columns: for (; glyphEnd < info.width; glyphEnd += 1) {
  for (let y = 0; y < info.height; y += 1) {
    if (data[(y * info.width + glyphEnd) * 4 + 3] > 20) continue columns;
  }
  break;
}
const glyph = await sharp(await toPng(white).toBuffer())
  .extract({ left: 0, top: 0, width: glyphEnd, height: info.height })
  .trim({ threshold: 1 })
  .png()
  .toBuffer();
await (await icon(glyph, 512, true)).png({ compressionLevel: 9 }).toFile("src/app/icon.png");
await (await icon(glyph, 180, false)).png({ compressionLevel: 9 }).toFile("src/app/apple-icon.png");

// Fachada: o galpão com a marca no render oficial do hero (terço esquerdo).
await sharp("public/images/hero/hero-stage.jpg")
  .extract({ left: 250, top: 640, width: 880, height: 500 })
  .resize({ width: 1800, kernel: "lanczos3" })
  .sharpen({ sigma: 0.8 })
  .jpeg({ quality: 84, mozjpeg: true, progressive: true })
  .toFile("public/images/home/fachada-roco.jpg");

console.log("[brand] assets gerados em", OUT, "+ src/app/icon.png, apple-icon.png, fachada-roco.jpg");
