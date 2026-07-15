/**
 * ESM-compatible __dirname and __filename equivalents.
 * Use instead of __dirname/__filename which are unavailable in ES modules.
 *
 * @example
 *   import { esmDirname } from "../../esm-helpers.js";
 *   const __dirname = esmDirname(import.meta.url);
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** ESM equivalent of __dirname */
export function esmDirname(metaUrl: string): string {
  return dirname(fileURLToPath(metaUrl));
}

/** ESM equivalent of __filename */
export function esmFilename(metaUrl: string): string {
  return fileURLToPath(metaUrl);
}
