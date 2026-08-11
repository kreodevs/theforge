#!/usr/bin/env node
/**
 * Sincroniza prompts MDD desde apps/api hacia el repo del plugin Cursor.
 * Uso (monorepo): cd packages/cursor-sdd-workspace && npm run sync:plugin
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  resolvePluginRoot,
  resolvePromptsSourceDir,
} from "./forge-plugin-path.mjs";

const DEST_DIR = join(resolvePluginRoot(), "prompts/mdd");

function copyMdRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      count += copyMdRecursive(srcPath, destPath);
    } else if (entry.endsWith(".md")) {
      cpSync(srcPath, destPath);
      count += 1;
    }
  }
  return count;
}

function main() {
  const sourceDir = resolvePromptsSourceDir();
  if (!existsSync(sourceDir)) {
    console.error(`Error: no existe el directorio fuente: ${sourceDir}`);
    console.error(
      "Ejecuta desde el monorepo The Forge o define FORGE_PROMPTS_SOURCE.",
    );
    process.exit(1);
  }

  const pluginRoot = resolvePluginRoot();
  const count = copyMdRecursive(sourceDir, DEST_DIR);
  console.log(
    `✓ ${count} archivos .md → ${join(pluginRoot, "prompts/mdd/")}`,
  );
}

main();
