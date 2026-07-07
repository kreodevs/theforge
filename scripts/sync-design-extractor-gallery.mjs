#!/usr/bin/env node
/**
 * DEV ONLY — Mantenimiento opcional de la biblioteca local (no CI, no producción).
 *
 * Congela/actualiza DESIGN.md desde design-extractor.com vía API pública de galería.
 * En runtime The Forge lee solo `design-extractor-imports/*.md` del repo/build.
 *
 * Uso:
 *   node scripts/sync-design-extractor-gallery.mjs
 *   node scripts/sync-design-extractor-gallery.mjs stripe klarna
 *
 * Salida: apps/api/src/modules/design-ref/data/design-extractor-imports/
 *
 * Ver NOTICE (raíz del repo) y design-ref/README.md para atribución e inspiración.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  "../apps/api/src/modules/design-ref/data/design-extractor-imports",
);

/** Slugs URL en https://www.design-extractor.com/gallery (26 sitios, jul 2026). */
const DEFAULT_SLUGS = [
  "airbnb",
  "anthropic",
  "apple",
  "dribbble",
  "duolingo",
  "figma",
  "harvey-2cd5a19d5b",
  "ikea-ae3b91b472",
  "klarna",
  "lassie",
  "linear-638bvy",
  "lovable",
  "neon",
  "notion-3b6ysb",
  "paperclip",
  "paypal",
  "railway",
  "shopify",
  "snapchat",
  "stripe",
  "supabase",
  "theonion",
  "uber",
  "vercel",
  "wired",
  "x",
];

const slugs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_SLUGS;

const FORMAT_PRIORITY = ["design-system-extended", "design-system-compact", "stitch-design-md"];

function pickDesignMd(formats) {
  if (!Array.isArray(formats)) return null;
  for (const id of FORMAT_PRIORITY) {
    const hit = formats.find((f) => f?.id === id && typeof f.content === "string");
    if (hit?.content?.trim()) return hit.content.trim();
  }
  return null;
}

async function fetchGallerySlug(slug) {
  const url = `https://www.design-extractor.com/api/gallery/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "TheForge-DesignSync/1.0 (+https://github.com/kreodevs/theforge)" },
  });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  const json = await res.json();
  const md = pickDesignMd(json?.result?.formats);
  if (!md) throw new Error(`${slug}: DESIGN.md not found in API formats`);
  return { url: `https://www.design-extractor.com/gallery/${slug}`, md, brand: json.brandName ?? slug };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const slug of slugs) {
    try {
      const { url, md, brand } = await fetchGallerySlug(slug);
      const outPath = path.join(OUT_DIR, `${slug}.md`);
      await writeFile(outPath, md, "utf8");
      manifest.push({ slug, brand, url, file: `${slug}.md`, bytes: md.length });
      console.log(`OK ${slug} (${brand}) → ${outPath} (${md.length} bytes)`);
    } catch (err) {
      console.error(`FAIL ${slug}:`, err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${manifest.length}/${slugs.length} entries → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
