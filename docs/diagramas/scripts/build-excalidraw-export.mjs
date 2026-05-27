#!/usr/bin/env node
/**
 * Convierte checkpoint MCP (elements con cameraUpdate) a .excalidraw importable.
 * Uso: node docs/diagramas/scripts/build-excalidraw-export.mjs <checkpoint.json>
 */
import fs from "node:fs";
import path from "node:path";

const inPath = process.argv[2];
if (!inPath) {
  console.error("Uso: node build-excalidraw-export.mjs <checkpoint.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));
const elements = raw.elements ?? raw;
const list = Array.isArray(elements) ? elements : [];
const drawable = list.filter(
  (e) => !["cameraUpdate", "restoreCheckpoint", "delete"].includes(e.type),
);

const doc = {
  type: "excalidraw",
  version: 2,
  source: "https://github.com/imjmedia/theforge",
  elements: drawable.map((el, i) => ({
    ...el,
    angle: el.angle ?? 0,
    strokeStyle: el.strokeStyle ?? "solid",
    roughness: el.roughness ?? 1,
    opacity: el.opacity ?? 100,
    groupIds: el.groupIds ?? [],
    frameId: el.frameId ?? null,
    index: el.index ?? `a${i}`,
    version: el.version ?? 1,
    isDeleted: false,
    boundElements: el.boundElements ?? null,
    updated: 1,
    link: null,
    locked: false,
  })),
  appState: { viewBackgroundColor: "#ffffff", gridSize: null },
  files: {},
};

const dir = path.dirname(path.resolve(inPath));
const base = path.join(dir, "the-forge-arquitectura-dokploy");
fs.writeFileSync(`${base}.excalidraw`, JSON.stringify(doc, null, 2));
console.log(`Wrote ${base}.excalidraw (${drawable.length} elements)`);
