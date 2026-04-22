import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCollectedResultsForMarkdown,
  formatGatheredContextForMarkdown,
  indexOfMatchingJsonObjectEnd,
} from "./theforge-raw-evidence-markdown.js";

test("indexOfMatchingJsonObjectEnd cierra objeto con strings", () => {
  const s = 'xx {"a": "x}", "b": 1} yy';
  const i = s.indexOf("{");
  const end = indexOfMatchingJsonObjectEnd(s, i);
  assert.ok(end > i);
  assert.deepEqual(JSON.parse(s.slice(i, end + 1)), { a: "x}", b: 1 });
});

test("formatGatheredContextForMarkdown extrae conteos y muestras", () => {
  const raw = `[deterministic:get_graph_summary]
Conteos: {"File":3,"Model":2}. Muestras: {
  "File": [{"path": "src/a.ts"},{"path": "src/b.ts"}],
  "Model": [{"path": "src/m.ts", "name": "MMod"}]
}

---

[deterministic:semantic_search:abc]
Algo de texto sin conteos ni muestras pero largo.`;

  const md = formatGatheredContextForMarkdown(raw);
  assert.match(md, /\*\*Conteos \(nodos por etiqueta\)\*\*/);
  assert.match(md, /\| File \| 3 \|/);
  assert.match(md, /##### File \(2 de 2\)/);
  assert.match(md, /`src\/a\.ts`/);
  assert.match(md, /`src\/m\.ts` — MMod/);
  assert.match(md, /#### \[deterministic:semantic_search:abc\]/);
});

test("formatCollectedResultsForMarkdown tabla compacta", () => {
  const md = formatCollectedResultsForMarkdown([
    { tipo: "Model", path: "src/x.ts", name: "X", repoId: "008d1887-c414-40ab-a36a-cd06559864f4" },
    { path: "solo-path" },
  ]);
  assert.match(md, /\| tipo \| path \| name \| repoId \|/);
  assert.match(md, /\| Model \|/);
  assert.match(md, /solo-path/);
});
