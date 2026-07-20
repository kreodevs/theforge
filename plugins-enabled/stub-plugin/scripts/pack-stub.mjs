#!/usr/bin/env node
/**
 * Empaqueta stub-plugin como .tfplugin de prueba (sin build — usa fuentes .ts vía index.ts).
 * Para plugins de producción usar: pnpm run build && tsx scripts/pack-theforge-plugin.ts ...
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "plugins-enabled/stub-plugin/dist/dev.theforge.stub-plugin.tfplugin");

execSync(
  `pnpm exec tsx scripts/pack-theforge-plugin.ts --dir plugins-enabled/stub-plugin --out ${out} --id dev.theforge.stub-plugin`,
  { cwd: root, stdio: "inherit" },
);

console.log(`Stub package: ${out}`);
