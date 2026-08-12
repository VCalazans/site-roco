#!/usr/bin/env node
/**
 * PSD reconnaissance/extraction helper for the ROCO "Produtos" pages.
 *
 * Reads a (large) .psd with `ag-psd`, using `@napi-rs/canvas` as the Node
 * canvas backend (same pairing used in the 2026-07-13 hero extraction —
 * see memory-bank/decisionLog.md). It NEVER writes back to the .psd.
 *
 * For a given input PSD it produces:
 *   1. A JSON dump of the full layer tree (name, kind, geometry, and the
 *      literal text of every text layer) — the primary artifact, since the
 *      goal of this pass is to capture the pt-BR copy and the layout map.
 *   2. A full-canvas flattened preview (scaled down), so the whole document
 *      can be inspected with the Read tool even though the source PSD is
 *      tens of MB / thousands of px tall.
 *   3. Optional cropped slices of that preview (top/mid/bottom) for closer
 *      inspection of long pages.
 *   4. Optional per-layer PNG exports for layers whose name matches a
 *      "decorative" heuristic (frames/backgrounds/textures) — never product
 *      photography, which comes from R2/DB instead.
 *
 * Usage:
 *   node scripts/psd-extract.mjs <input.psd> <outputPrefix> [options]
 *
 * Options:
 *   --scale-width=1600       Target width (px) for the full-page preview.
 *   --slices                 Also emit top/mid/bottom crops of the preview.
 *   --export-decor           Export layers matching the decorative-name
 *                             heuristic as standalone PNGs.
 *   --export-regex=<pattern> Override the decorative-name heuristic regex
 *                             (case-insensitive, matched against layer name).
 *   --assets-dir=<dir>       Where decorative PNGs go (default:
 *                             public/images/produtos).
 *
 * Example:
 *   node scripts/psd-extract.mjs \
 *     "docs/Layout pag Produtos_OK_01.psd" \
 *     "C:/.../scratchpad/produtos-listagem" \
 *     --slices --export-decor
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPsd, initializeCanvas, getLayerCanvas } from "ag-psd";
import { createCanvas } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

initializeCanvas(createCanvas);

function parseArgs(argv) {
  const [input, outputPrefix, ...rest] = argv;
  const opts = {
    scaleWidth: 1600,
    slices: false,
    exportDecor: false,
    exportRegex: /(moldura|frame|glow|neon|fundo|background|bg[_\s-]|textura|texture|losang|diamond|gradient|gradiente|overlay|piso|floor|circuit|linha|line[_\s-]|halo|vinheta|vignette)/i,
    assetsDir: path.join(repoRoot, "public", "images", "produtos"),
    jpeg: false,
    jpegQuality: 82,
    exportMaxWidth: 0,
  };
  for (const arg of rest) {
    if (arg.startsWith("--scale-width=")) {
      opts.scaleWidth = Number(arg.split("=")[1]);
    } else if (arg === "--slices") {
      opts.slices = true;
    } else if (arg === "--export-decor") {
      opts.exportDecor = true;
    } else if (arg.startsWith("--export-regex=")) {
      opts.exportRegex = new RegExp(arg.slice("--export-regex=".length), "i");
    } else if (arg.startsWith("--assets-dir=")) {
      opts.assetsDir = path.resolve(arg.split("=")[1]);
    } else if (arg === "--jpeg") {
      opts.jpeg = true;
    } else if (arg.startsWith("--jpeg-quality=")) {
      opts.jpegQuality = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--export-max-width=")) {
      opts.exportMaxWidth = Number(arg.split("=")[1]);
    }
  }
  if (!input || !outputPrefix) {
    console.error(
      "Usage: node scripts/psd-extract.mjs <input.psd> <outputPrefix> [--scale-width=1600] [--slices] [--export-decor] [--export-regex=<pattern>] [--assets-dir=<dir>]"
    );
    process.exit(1);
  }
  return { input: path.resolve(input), outputPrefix: path.resolve(outputPrefix), ...opts };
}

function slugify(name) {
  return (name || "layer")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "layer";
}

function layerKind(layer) {
  if (layer.children) return "group";
  if (layer.text) return "text";
  if (layer.canvas || layer.imageData) return "image";
  return "layer";
}

function geometry(layer) {
  const left = layer.left ?? 0;
  const top = layer.top ?? 0;
  const right = layer.right ?? left;
  const bottom = layer.bottom ?? top;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function extractTextInfo(layer) {
  if (!layer.text) return null;
  const t = layer.text;
  let fontSize;
  let fontName;
  let colorHex;
  try {
    const firstRun = t.style;
    if (firstRun) {
      fontSize = firstRun.fontSize;
      fontName = firstRun.font && firstRun.font.name;
      if (firstRun.fillColor) {
        const { r, g, b } = firstRun.fillColor;
        colorHex =
          "#" +
          [r, g, b]
            .map((v) => Math.round(v).toString(16).padStart(2, "0"))
            .join("");
      }
    }
  } catch {
    // best effort only
  }
  return {
    value: t.text ?? "",
    fontSize,
    fontName,
    colorHex,
    justification: t.style?.justification,
  };
}

function walkLayers(layers, depth, results) {
  if (!layers) return;
  for (const layer of layers) {
    if (!layer) continue;
    const kind = layerKind(layer);
    const entry = {
      name: layer.name || "(sem nome)",
      kind,
      depth,
      hidden: layer.hidden === true,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      geometry: geometry(layer),
    };
    if (kind === "text") {
      entry.text = extractTextInfo(layer);
    }
    results.push(entry);
    if (layer.children) {
      walkLayers(layer.children, depth + 1, results);
    }
  }
}

function collectAllTextCopy(entries) {
  return entries
    .filter((e) => e.kind === "text" && e.text && e.text.value)
    .map((e) => ({ layer: e.name, text: e.text.value.trim() }))
    .filter((e) => e.text.length > 0);
}

async function saveCanvasScaled(canvas, outPath, targetWidth) {
  const srcW = canvas.width;
  const srcH = canvas.height;
  const scale = targetWidth ? Math.min(1, targetWidth / srcW) : 1;
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const outCanvas = createCanvas(outW, outH);
  const ctx = outCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0, srcW, srcH, 0, 0, outW, outH);

  const buffer = await outCanvas.encode("png");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return { width: outW, height: outH };
}

async function saveCanvasSlice(canvas, outPath, targetWidth, yFrac, hFrac) {
  const srcW = canvas.width;
  const srcH = canvas.height;
  const scale = targetWidth ? Math.min(1, targetWidth / srcW) : 1;
  const outW = Math.max(1, Math.round(srcW * scale));

  const sliceSrcY = Math.round(srcH * yFrac);
  const sliceSrcH = Math.round(srcH * hFrac);
  const sliceOutH = Math.max(1, Math.round(sliceSrcH * scale));

  const outCanvas = createCanvas(outW, sliceOutH);
  const ctx = outCanvas.getContext("2d");
  ctx.drawImage(
    canvas,
    0,
    sliceSrcY,
    srcW,
    sliceSrcH,
    0,
    0,
    outW,
    sliceOutH
  );

  const buffer = await outCanvas.encode("png");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
}

/**
 * Crops a (possibly document-relative, possibly larger-than-canvas) layer
 * canvas down to the intersection with the document bounds, so bleed
 * outside the visible page (common for background/scene layers, which are
 * often painted wider than the canvas) is not shipped to `public/`.
 */
function cropCanvasToDocument(canvas, layerX, layerY, docWidth, docHeight) {
  const srcX = Math.max(0, -layerX);
  const srcY = Math.max(0, -layerY);
  const dstX = Math.max(0, layerX);
  const dstY = Math.max(0, layerY);
  const w = Math.min(canvas.width - srcX, docWidth - dstX);
  const h = Math.min(canvas.height - srcY, docHeight - dstY);
  if (w <= 0 || h <= 0) return canvas;
  if (srcX === 0 && srcY === 0 && w === canvas.width && h === canvas.height) {
    return canvas;
  }
  const out = createCanvas(w, h);
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, srcX, srcY, w, h, 0, 0, w, h);
  return out;
}

async function exportDecorativeLayers(layers, depth, opts, exported, docWidth, docHeight) {
  if (!layers) return;
  for (const layer of layers) {
    if (!layer) continue;
    const kind = layerKind(layer);
    if (
      (kind === "image" || kind === "layer") &&
      layer.name &&
      opts.exportRegex.test(layer.name) &&
      !layer.hidden
    ) {
      try {
        // `layer.canvas` is already populated directly at read time when
        // the top-level `useImageData: false` option is used (see
        // ag-psd's `setImageDataOrCanvas`); `getLayerCanvas(layer)` re-reads
        // from raw layer data instead and returned undefined here, so we
        // prefer the already-decoded canvas and only fall back to the
        // re-read helper if it is somehow missing.
        let canvas = layer.canvas || getLayerCanvas(layer);
        if (canvas && canvas.width > 4 && canvas.height > 4) {
          const geo = geometry(layer);
          canvas = cropCanvasToDocument(canvas, geo.x, geo.y, docWidth, docHeight);

          const useJpeg = opts.jpeg;
          const ext = useJpeg ? "jpg" : "png";
          const fileName = `${slugify(layer.name)}.${ext}`;
          const outPath = path.join(opts.assetsDir, fileName);
          let outCanvas = canvas;
          if (opts.exportMaxWidth && canvas.width > opts.exportMaxWidth) {
            const scale = opts.exportMaxWidth / canvas.width;
            outCanvas = createCanvas(
              Math.round(canvas.width * scale),
              Math.round(canvas.height * scale)
            );
            outCanvas
              .getContext("2d")
              .drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outCanvas.width, outCanvas.height);
          }
          const buffer = useJpeg
            ? await outCanvas.encode("jpeg", opts.jpegQuality)
            : await outCanvas.encode("png");
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, buffer);
          exported.push({
            layer: layer.name,
            file: path.relative(repoRoot, outPath),
            width: outCanvas.width,
            height: outCanvas.height,
            bytes: buffer.length,
          });
        }
      } catch (err) {
        exported.push({ layer: layer.name, error: String(err && err.message) });
      }
    }
    if (layer.children) {
      await exportDecorativeLayers(layer.children, depth + 1, opts, exported, docWidth, docHeight);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`[psd-extract] reading ${opts.input} ...`);

  const buffer = fs.readFileSync(opts.input);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );

  const t0 = Date.now();
  const psd = readPsd(arrayBuffer, {
    skipLayerImageData: false,
    skipCompositeImageData: false,
    skipThumbnail: true,
    // NOTE: `useImageData: true` makes ag-psd store raw `psd.imageData`
    // instead of building `psd.canvas` (see psdReader.js) — we want the
    // canvas so the composite can be flattened/scaled/cropped below.
    useImageData: false,
  });
  console.log(`[psd-extract] parsed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${psd.width}x${psd.height}px, ${psd.children?.length ?? 0} top-level layers`);

  // --- 1. Layer tree + text copy -------------------------------------
  const entries = [];
  walkLayers(psd.children, 0, entries);
  const textCopy = collectAllTextCopy(entries);

  const dump = {
    source: path.relative(repoRoot, opts.input),
    documentWidth: psd.width,
    documentHeight: psd.height,
    layerCount: entries.length,
    layers: entries,
    textCopy,
  };

  const jsonPath = `${opts.outputPrefix}.layers.json`;
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(dump, null, 2), "utf8");
  console.log(`[psd-extract] layer tree + text copy -> ${jsonPath}`);

  // --- 2. Full composite preview (scaled) -----------------------------
  if (!psd.canvas) {
    console.warn("[psd-extract] WARNING: psd.canvas is empty — no composite raster available.");
  } else {
    const previewPath = `${opts.outputPrefix}.preview.png`;
    const { width, height } = await saveCanvasScaled(psd.canvas, previewPath, opts.scaleWidth);
    console.log(`[psd-extract] full preview (${width}x${height}) -> ${previewPath}`);

    if (opts.slices) {
      const slices = [
        ["top", 0, 0.34],
        ["mid", 0.33, 0.34],
        ["bottom", 0.66, 0.34],
      ];
      for (const [label, yFrac, hFrac] of slices) {
        const slicePath = `${opts.outputPrefix}.preview.${label}.png`;
        await saveCanvasSlice(psd.canvas, slicePath, opts.scaleWidth, yFrac, hFrac);
        console.log(`[psd-extract] slice "${label}" -> ${slicePath}`);
      }
    }
  }

  // --- 3. Decorative layer exports ------------------------------------
  if (opts.exportDecor) {
    const exported = [];
    await exportDecorativeLayers(psd.children, 0, opts, exported, psd.width, psd.height);
    const exportLogPath = `${opts.outputPrefix}.exported-assets.json`;
    fs.writeFileSync(exportLogPath, JSON.stringify(exported, null, 2), "utf8");
    console.log(`[psd-extract] exported ${exported.filter((e) => !e.error).length} decorative layer(s) -> ${opts.assetsDir}`);
    console.log(`[psd-extract] export log -> ${exportLogPath}`);
  }

  console.log("[psd-extract] done.");
}

main().catch((err) => {
  console.error("[psd-extract] FAILED:", err);
  process.exit(1);
});
