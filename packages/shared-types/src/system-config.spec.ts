import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_CONFIG_DEFINITIONS,
  getSystemConfigDefinition,
  isTruthyPlatformFlag,
  normalizePlatformBooleanInput,
} from "./system-config.js";

test("SYSTEM_CONFIG_DEFINITIONS — claves únicas", () => {
  const keys = SYSTEM_CONFIG_DEFINITIONS.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("getSystemConfigDefinition — resuelve llm_max_tokens", () => {
  const def = getSystemConfigDefinition("llm_max_tokens");
  assert.ok(def);
  assert.equal(def.envKey, "LLM_MAX_TOKENS");
  assert.equal(def.defaultValue, "131072");
});

test("isTruthyPlatformFlag — valores activos", () => {
  assert.equal(isTruthyPlatformFlag("1"), true);
  assert.equal(isTruthyPlatformFlag("true"), true);
  assert.equal(isTruthyPlatformFlag("off"), false);
  assert.equal(isTruthyPlatformFlag(""), false);
});

test("normalizePlatformBooleanInput — coerción", () => {
  assert.equal(normalizePlatformBooleanInput(true), "1");
  assert.equal(normalizePlatformBooleanInput("yes"), "1");
  assert.equal(normalizePlatformBooleanInput(false), "0");
});
