#!/usr/bin/env tsx
/**
 * Empaqueta un plugin The Forge como `.tfplugin` (ZIP + manifest).
 *
 * Uso:
 *   pnpm exec tsx scripts/pack-theforge-plugin.ts --dir plugins-enabled/stub-plugin --out dist/stub.tfplugin
 *
 * Opciones:
 *   --dir       Directorio del plugin (debe tener index.js o dist/)
 *   --out       Ruta del .tfplugin de salida
 *   --id        Override manifest id
 *   --sign      Firmar manifest con PLUGINS_SIGNING_SECRET
 */

import { createHmac, createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import JSZip from "jszip";
import {
  THEFORGE_PLUGIN_MANIFEST_FILENAME,
  THEFORGE_PLUGIN_MANIFEST_VERSION,
  type TheForgePluginManifest,
} from "@theforge/shared-types";

interface CliArgs {
  dir: string;
  out: string;
  id?: string;
  sign: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let dir = "";
  let out = "";
  let id: string | undefined;
  let sign = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir" && argv[i + 1]) dir = argv[++i];
    else if (arg === "--out" && argv[i + 1]) out = argv[++i];
    else if (arg === "--id" && argv[i + 1]) id = argv[++i];
    else if (arg === "--sign") sign = true;
  }

  if (!dir || !out) {
    console.error(
      "Uso: tsx scripts/pack-theforge-plugin.ts --dir <plugin-dir> --out <file.tfplugin> [--id com.example.plugin] [--sign]",
    );
    process.exit(1);
  }

  return { dir: resolve(dir), out: resolve(out), id, sign };
}

function readCoreVersion(): string {
  const pkgPath = resolve(process.cwd(), "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function collectFiles(root: string, base: string): Array<{ rel: string; abs: string }> {
  const out: Array<{ rel: string; abs: string }> = [];
  for (const name of readdirSync(base)) {
    const abs = join(base, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      out.push(...collectFiles(root, abs));
    } else {
      out.push({ rel: relative(root, abs), abs });
    }
  }
  return out;
}

function computePayloadSha256(
  files: Array<{ rel: string; content: Buffer }>,
): string {
  const hash = createHash("sha256");
  const sorted = [...files]
    .filter((f) => f.rel !== THEFORGE_PLUGIN_MANIFEST_FILENAME)
    .sort((a, b) => a.rel.localeCompare(b.rel));
  for (const f of sorted) {
    hash.update(f.rel);
    hash.update("\0");
    hash.update(f.content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function signManifest(manifest: TheForgePluginManifest, secret: string): string {
  const { signature: _sig, ...unsigned } = manifest;
  void _sig;
  const canonical = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(args.dir)) {
    console.error(`Directorio no encontrado: ${args.dir}`);
    process.exit(1);
  }

  const pkgPath = join(args.dir, "package.json");
  let pkgMeta: { name?: string; version?: string; description?: string } = {};
  if (existsSync(pkgPath)) {
    pkgMeta = JSON.parse(readFileSync(pkgPath, "utf8")) as typeof pkgMeta;
  }

  const sourceRoot = existsSync(join(args.dir, "dist"))
    ? join(args.dir, "dist")
    : args.dir;

  if (!existsSync(join(sourceRoot, "index.js")) && !existsSync(join(args.dir, "index.js"))) {
    console.error(
      "No se encontró index.js. Ejecuta `pnpm run build` en el plugin o empaqueta desde dist/.",
    );
    process.exit(1);
  }

  const packRoot = existsSync(join(args.dir, "index.js")) ? args.dir : sourceRoot;
  const rawFiles = collectFiles(packRoot, packRoot);
  const fileBuffers = rawFiles.map((f) => ({
    rel: f.rel.replace(/\\/g, "/"),
    content: readFileSync(f.abs),
  }));

  const pluginId =
    args.id ??
    (pkgMeta.name?.includes(".") ? pkgMeta.name : `dev.${basename(args.dir)}.plugin`);
  const version = pkgMeta.version ?? "1.0.0";
  const name =
    pkgMeta.name?.split("/").pop()?.replace(/-/g, " ") ??
    basename(args.dir);

  const payloadSha256 = computePayloadSha256(fileBuffers);

  let manifest: TheForgePluginManifest = {
    manifestVersion: THEFORGE_PLUGIN_MANIFEST_VERSION,
    id: pluginId,
    version,
    name,
    description: pkgMeta.description,
    entry: "index.js",
    minCoreVersion: readCoreVersion(),
    builtAt: new Date().toISOString(),
    publisher: "theforge",
    payloadSha256,
  };

  if (args.sign) {
    const secret = process.env.PLUGINS_SIGNING_SECRET?.trim();
    if (!secret) {
      console.error("--sign requiere PLUGINS_SIGNING_SECRET en el entorno");
      process.exit(1);
    }
    manifest = { ...manifest, signature: signManifest(manifest, secret) };
  }

  const zip = new JSZip();
  zip.file(
    THEFORGE_PLUGIN_MANIFEST_FILENAME,
    JSON.stringify(manifest, null, 2),
  );
  for (const f of fileBuffers) {
    zip.file(f.rel, f.content);
  }

  mkdirSync(dirname(args.out), { recursive: true });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(args.out, buffer);

  console.log(`✅ Paquete creado: ${args.out}`);
  console.log(`   id: ${manifest.id}@${manifest.version}`);
  console.log(`   payloadSha256: ${payloadSha256}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
