import { test } from "node:test";
import assert from "node:assert/strict";
import { countMddCodePathReferences, extractCandidatePathsFromMcpText } from "./theforge-evidence-context.util.js";

test("extractCandidatePathsFromMcpText: backticks", () => {
  const text = "Ver `apps/api/src/main.ts` y `packages/foo/bar.tsx`.";
  assert.deepEqual(
    extractCandidatePathsFromMcpText(text).sort(),
    ["apps/api/src/main.ts", "packages/foo/bar.tsx"].sort(),
  );
});

test("extractCandidatePathsFromMcpText: slash path", () => {
  const text = "En src/modules/ai/service.ts está la lógica.";
  assert.ok(extractCandidatePathsFromMcpText(text).includes("src/modules/ai/service.ts"));
});

test("extractCandidatePathsFromMcpText: ignora ..", () => {
  assert.deepEqual(extractCandidatePathsFromMcpText("`../../../etc/passwd`"), []);
});

test("countMddCodePathReferences", () => {
  const mdd = "Editar `src/a.ts` y `src/b.tsx`.\nTambién apps/web/src/c.ts";
  assert.ok(countMddCodePathReferences(mdd) >= 3);
});
