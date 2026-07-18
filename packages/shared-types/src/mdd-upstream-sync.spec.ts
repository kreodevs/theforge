import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeMddUpstreamChanges,
  buildMddUpstreamBaseline,
  expandMddSectionsForSync,
  hashUpstreamDocumentBody,
} from "./mdd-upstream-sync.js";

describe("mdd-upstream-sync", () => {
  it("expandMddSectionsForSync añade §4 cuando cambia §3", () => {
    assert.deepEqual(expandMddSectionsForSync([3]), [3, 4]);
  });

  it("detecta cambio en BRD y recomienda §1", () => {
    const baseline = buildMddUpstreamBaseline({
      dbgaContent: "dbga v1",
      brdContent: "brd v1",
      benchmarkContent: "bench v1",
      mddContent: "# MDD\n\n## 1. Contexto\n\nx".repeat(30),
    });
    const analysis = analyzeMddUpstreamChanges({
      baseline,
      dbgaContent: "dbga v1",
      brdContent: "brd v2 con nuevo KPI de conversión",
      benchmarkContent: "bench v1",
      mddContent: "# MDD\n\n## 1. Contexto\n\nx".repeat(30),
    });
    assert.ok(analysis.changedSources.includes("brd"));
    assert.ok(analysis.recommendedSections.includes(1));
    assert.equal(analysis.pendingSync, true);
  });

  it("hash estable para mismo contenido", () => {
    assert.equal(hashUpstreamDocumentBody(" a \n"), hashUpstreamDocumentBody("a"));
  });
});
