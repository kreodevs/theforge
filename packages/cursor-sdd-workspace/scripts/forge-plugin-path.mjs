import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEMO_WORKSPACE_ROOT = join(__dirname, "..");
export const MONOREPO_ROOT = join(DEMO_WORKSPACE_ROOT, "../..");

/** @returns {string} Root of theforge-plugin-cursor (publish target). */
export function resolvePluginRoot() {
  if (process.env.FORGE_PLUGIN_ROOT) {
    return resolve(process.env.FORGE_PLUGIN_ROOT);
  }
  const sibling = join(MONOREPO_ROOT, "../theforge-plugin-cursor");
  if (existsSync(join(sibling, ".cursor-plugin", "plugin.json"))) {
    return sibling;
  }
  const homeClone = join(
    process.env.HOME ?? "",
    "Documents/GitHub/theforge-plugin-cursor",
  );
  if (existsSync(join(homeClone, ".cursor-plugin", "plugin.json"))) {
    return homeClone;
  }
  return DEMO_WORKSPACE_ROOT;
}

export function resolvePromptsSourceDir() {
  if (process.env.FORGE_PROMPTS_SOURCE) {
    return resolve(process.env.FORGE_PROMPTS_SOURCE);
  }
  return join(
    MONOREPO_ROOT,
    "apps/api/src/modules/ai-analysis/prompts/mdd",
  );
}
