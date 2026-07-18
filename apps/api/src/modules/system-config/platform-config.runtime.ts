/**
 * Resolución runtime de configuración de plataforma: BD (AppConfig) → env → default del catálogo.
 */
import {
  SYSTEM_CONFIG_DEFINITIONS,
  getSystemConfigDefinition,
  isTruthyPlatformFlag,
  type SystemConfigDefinition,
} from "@theforge/shared-types";

let dbOverrides = new Map<string, string>();

export function setPlatformConfigOverrides(
  overrides: ReadonlyMap<string, string> | Record<string, string>,
): void {
  dbOverrides = new Map(Object.entries(overrides));
}

export function getPlatformConfigDbOverrides(): ReadonlyMap<string, string> {
  return dbOverrides;
}

export function resolvePlatformConfigValue(
  def: Pick<SystemConfigDefinition, "key" | "envKey" | "defaultValue">,
): string {
  const db = dbOverrides.get(def.key)?.trim();
  if (db !== undefined && db !== "") return db;
  const env = def.envKey ? process.env[def.envKey]?.trim() : undefined;
  if (env !== undefined && env !== "") return env;
  return def.defaultValue;
}

export function resolvePlatformConfigSource(
  def: Pick<SystemConfigDefinition, "key" | "envKey">,
): "database" | "env" | "default" {
  const db = dbOverrides.get(def.key)?.trim();
  if (db !== undefined && db !== "") return "database";
  const env = def.envKey ? process.env[def.envKey]?.trim() : undefined;
  if (env !== undefined && env !== "") return "env";
  return "default";
}

export function resolvePlatformConfigByKey(key: string): string {
  const def = getSystemConfigDefinition(key);
  if (!def) throw new Error(`Unknown system config key: ${key}`);
  return resolvePlatformConfigValue(def);
}

export function resolvePlatformConfigNumber(key: string): number {
  const def = getSystemConfigDefinition(key);
  if (!def) throw new Error(`Unknown system config key: ${key}`);
  const raw = resolvePlatformConfigValue(def);
  const parsed = Number.parseInt(raw, 10);
  const fallback = Number.parseInt(def.defaultValue, 10);
  const min = def.min ?? Number.NEGATIVE_INFINITY;
  const max = def.max ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(parsed)) {
    return Number.isFinite(fallback) ? Math.min(Math.max(fallback, min), max) : 0;
  }
  if (parsed < min || parsed > max) {
    return Number.isFinite(fallback) ? Math.min(Math.max(fallback, min), max) : min;
  }
  return parsed;
}

export function resolvePlatformConfigBoolean(key: string): boolean {
  const def = getSystemConfigDefinition(key);
  if (!def) throw new Error(`Unknown system config key: ${key}`);
  return isTruthyPlatformFlag(resolvePlatformConfigValue(def));
}

export function resolvePlatformConfigString(key: string): string {
  return resolvePlatformConfigByKey(key);
}

/** Env keys gestionados por el catálogo (para documentación / migración). */
export function listManagedPlatformEnvKeys(): string[] {
  return SYSTEM_CONFIG_DEFINITIONS.map((d) => d.envKey);
}
