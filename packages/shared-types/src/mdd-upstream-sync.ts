import { createHash } from "node:crypto";

/** Documentos upstream que alimentan el MDD greenfield. */
export type MddUpstreamSource = "dbga" | "brd" | "benchmark";

export const MDD_UPSTREAM_SOURCE_LABELS: Record<MddUpstreamSource, string> = {
  dbga: "Fase 0 (DBGA)",
  brd: "BRD",
  benchmark: "Benchmark (Deep Research)",
};

/** Baseline persistido al finalizar un MDD (hashes + snapshots truncados para diff). */
export type MddUpstreamBaseline = {
  capturedAt: string;
  dbgaContentHash: string;
  brdContentHash: string;
  benchmarkContentHash: string;
  mddContentHash: string;
  dbgaLength: number;
  brdLength: number;
  benchmarkLength: number;
  mddLength: number;
  dbgaContentSnapshot: string;
  brdContentSnapshot: string;
  benchmarkContentSnapshot: string;
};

const SNAPSHOT_MAX = 32_000;

export type MddUpstreamChangeItem = {
  source: MddUpstreamSource;
  label: string;
  summary: string;
  /** Líneas añadidas vs baseline (aprox.). */
  linesAdded: number;
  linesRemoved: number;
};

export type MddUpstreamSyncAnalysis = {
  hasBaseline: boolean;
  hasMdd: boolean;
  baselineCapturedAt: string | null;
  changedSources: MddUpstreamSource[];
  changes: MddUpstreamChangeItem[];
  /** Secciones MDD 1–7 recomendadas por reglas de impacto. */
  recommendedSections: number[];
  /** Secciones tras expandir dependencias (§3⇒§4, §2⇒§7, …). */
  expandedSections: number[];
  canSync: boolean;
  /** true si no hay MDD o el usuario debe usar pipeline completo. */
  needsFullRegen: boolean;
  pendingSync: boolean;
};

export const MDD_SECTION_TITLES: Record<number, string> = {
  1: "§1 Contexto y alcance",
  2: "§2 Arquitectura y stack",
  3: "§3 Modelo de datos",
  4: "§4 Contratos de API",
  5: "§5 Lógica y edge cases",
  6: "§6 Seguridad",
  7: "§7 Infraestructura",
};

/** Normaliza texto para hashing estable (trim, finales de línea). */
export function normalizeUpstreamDocumentBody(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim();
}

export function hashUpstreamDocumentBody(text: string | null | undefined): string {
  const body = normalizeUpstreamDocumentBody(text);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function buildMddUpstreamBaseline(input: {
  dbgaContent: string | null | undefined;
  brdContent: string | null | undefined;
  benchmarkContent: string | null | undefined;
  mddContent: string | null | undefined;
  capturedAt?: Date;
}): MddUpstreamBaseline {
  const dbga = normalizeUpstreamDocumentBody(input.dbgaContent);
  const brd = normalizeUpstreamDocumentBody(input.brdContent);
  const benchmark = normalizeUpstreamDocumentBody(input.benchmarkContent);
  const mdd = normalizeUpstreamDocumentBody(input.mddContent);
  return {
    capturedAt: (input.capturedAt ?? new Date()).toISOString(),
    dbgaContentHash: hashUpstreamDocumentBody(dbga),
    brdContentHash: hashUpstreamDocumentBody(brd),
    benchmarkContentHash: hashUpstreamDocumentBody(benchmark),
    mddContentHash: hashUpstreamDocumentBody(mdd),
    dbgaLength: dbga.length,
    brdLength: brd.length,
    benchmarkLength: benchmark.length,
    mddLength: mdd.length,
    dbgaContentSnapshot: dbga.slice(0, SNAPSHOT_MAX),
    brdContentSnapshot: brd.slice(0, SNAPSHOT_MAX),
    benchmarkContentSnapshot: benchmark.slice(0, SNAPSHOT_MAX),
  };
}

function diffLineStats(before: string, after: string): { added: number; removed: number; diffText: string } {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  let added = 0;
  let removed = 0;
  for (const line of b) {
    if (line.trim() && !setA.has(line)) added += 1;
  }
  for (const line of a) {
    if (line.trim() && !setB.has(line)) removed += 1;
  }
  const sampleAdded = b.filter((line) => line.trim() && !setA.has(line)).slice(0, 12);
  const sampleRemoved = a.filter((line) => line.trim() && !setB.has(line)).slice(0, 8);
  const diffText = [
    sampleAdded.length ? `+ ${sampleAdded.join("\n+ ")}` : "",
    sampleRemoved.length ? `- ${sampleRemoved.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { added, removed, diffText };
}

function inferSectionsFromDiff(source: MddUpstreamSource, diffText: string, summarySeed: string): number[] {
  const t = `${diffText}\n${summarySeed}`.toLowerCase();
  const sections = new Set<number>();

  if (source === "brd") {
    sections.add(1);
    if (/\b(uat|kpi|negocio|proceso|actor|rol|capacidad|alcance|requisito)\b/i.test(t)) sections.add(5);
  }

  if (source === "benchmark" || source === "dbga") {
    sections.add(1);
    if (/\b(stack|react|vue|angular|nestjs|node|postgres|kubernetes|docker|dokploy|arquitectura|frontend|backend)\b/i.test(t)) {
      sections.add(2);
      sections.add(7);
    }
    if (/\b(entidad|tabla|modelo\s+de\s+datos|sql|campo|columna|create\s+table|relaci[oó]n)\b/i.test(t)) {
      sections.add(3);
      sections.add(4);
    }
    if (/\b(api|endpoint|contrato|rest|graphql|webhook)\b/i.test(t)) {
      sections.add(4);
      sections.add(3);
    }
    if (/\b(seguridad|mfa|oauth|jwt|rbac|permiso|autenticaci[oó]n)\b/i.test(t)) sections.add(6);
    if (/\b(integraci[oó]n|infra|despliegue|ci\/cd|variable\s+de\s+entorno)\b/i.test(t)) sections.add(7);
    if (/\b(edge\s+case|flujo|regla\s+de\s+negocio|l[oó]gica)\b/i.test(t)) sections.add(5);
  }

  if (sections.size === 0) sections.add(1);
  return [...sections].sort((x, y) => x - y);
}

/** Expande dependencias entre secciones MDD antes de ejecutar agentes. */
export function expandMddSectionsForSync(sections: readonly number[]): number[] {
  const set = new Set(sections.filter((n) => n >= 1 && n <= 7));
  if (set.has(3)) set.add(4);
  if (set.has(4)) set.add(3);
  if (set.has(2)) set.add(7);
  if (set.has(6) && (set.has(3) || set.has(4))) {
    /* security often needs model/api alignment */
  }
  return [1, 2, 3, 4, 5, 6, 7].filter((n) => set.has(n));
}

export function analyzeMddUpstreamChanges(input: {
  baseline: MddUpstreamBaseline | null | undefined;
  dbgaContent: string | null | undefined;
  brdContent: string | null | undefined;
  benchmarkContent: string | null | undefined;
  mddContent: string | null | undefined;
}): MddUpstreamSyncAnalysis {
  const mddBody = normalizeUpstreamDocumentBody(input.mddContent);
  const hasMdd = mddBody.length >= 200;
  const current = buildMddUpstreamBaseline({
    dbgaContent: input.dbgaContent,
    brdContent: input.brdContent,
    benchmarkContent: input.benchmarkContent,
    mddContent: input.mddContent,
  });

  if (!hasMdd) {
    return {
      hasBaseline: Boolean(input.baseline),
      hasMdd: false,
      baselineCapturedAt: input.baseline?.capturedAt ?? null,
      changedSources: [],
      changes: [],
      recommendedSections: [],
      expandedSections: [],
      canSync: false,
      needsFullRegen: true,
      pendingSync: false,
    };
  }

  if (!input.baseline) {
    return {
      hasBaseline: false,
      hasMdd: true,
      baselineCapturedAt: null,
      changedSources: ["dbga", "brd", "benchmark"],
      changes: [
        {
          source: "dbga",
          label: MDD_UPSTREAM_SOURCE_LABELS.dbga,
          summary: "Sin baseline previo: se asume alineación pendiente con Fase 0.",
          linesAdded: 0,
          linesRemoved: 0,
        },
      ],
      recommendedSections: [1, 2, 3, 4, 5, 6, 7],
      expandedSections: expandMddSectionsForSync([1, 2, 3, 4, 5, 6, 7]),
      canSync: true,
      needsFullRegen: false,
      pendingSync: true,
    };
  }

  const baseline = input.baseline;
  const changedSources: MddUpstreamSource[] = [];
  const changes: MddUpstreamChangeItem[] = [];

  const pairs: Array<{
    source: MddUpstreamSource;
    before: string;
    after: string;
    hashKey: keyof MddUpstreamBaseline;
    snapshotKey: keyof MddUpstreamBaseline;
  }> = [
    {
      source: "dbga",
      before: baseline.dbgaContentSnapshot ?? "",
      after: normalizeUpstreamDocumentBody(input.dbgaContent),
      hashKey: "dbgaContentHash",
      snapshotKey: "dbgaContentSnapshot",
    },
    {
      source: "brd",
      before: baseline.brdContentSnapshot ?? "",
      after: normalizeUpstreamDocumentBody(input.brdContent),
      hashKey: "brdContentHash",
      snapshotKey: "brdContentSnapshot",
    },
    {
      source: "benchmark",
      before: baseline.benchmarkContentSnapshot ?? "",
      after: normalizeUpstreamDocumentBody(input.benchmarkContent),
      hashKey: "benchmarkContentHash",
      snapshotKey: "benchmarkContentSnapshot",
    },
  ];

  for (const p of pairs) {
    const currentHash = current[p.hashKey] as string;
    const baseHash = baseline[p.hashKey] as string;
    if (currentHash === baseHash) continue;
    changedSources.push(p.source);
    const stats = diffLineStats(p.before, p.after);
    const summary =
      stats.added + stats.removed > 0
        ? `${stats.added} líneas nuevas, ${stats.removed} eliminadas respecto al baseline.`
        : "Contenido modificado (hash distinto).";
    changes.push({
      source: p.source,
      label: MDD_UPSTREAM_SOURCE_LABELS[p.source],
      summary,
      linesAdded: stats.added,
      linesRemoved: stats.removed,
    });
  }

  let recommendedSections: number[] = [];
  for (const change of changes) {
    const pair = pairs.find((p) => p.source === change.source);
    const diffText = pair ? diffLineStats(pair.before, pair.after).diffText : change.summary;
    recommendedSections.push(...inferSectionsFromDiff(change.source, diffText, change.label));
  }
  recommendedSections = [...new Set(recommendedSections)].sort((a, b) => a - b);
  const expandedSections = expandMddSectionsForSync(recommendedSections);
  const pendingSync = changedSources.length > 0;

  return {
    hasBaseline: true,
    hasMdd: true,
    baselineCapturedAt: baseline.capturedAt,
    changedSources,
    changes,
    recommendedSections,
    expandedSections,
    canSync: hasMdd && expandedSections.length > 0,
    needsFullRegen: false,
    pendingSync,
  };
}

export function buildUpstreamChangeSummaryForPipeline(analysis: MddUpstreamSyncAnalysis): string {
  if (!analysis.changes.length) return "Sincronizar MDD con documentos upstream sin diff detectado.";
  const lines = analysis.changes.map(
    (c) => `- **${c.label}:** ${c.summary}`,
  );
  return [
    "Actualizar el MDD existente para reflejar cambios en documentos upstream (no reescribir secciones no afectadas).",
    "",
    "**Cambios detectados:**",
    ...lines,
    "",
    `**Secciones a actualizar:** ${analysis.expandedSections.map((n) => MDD_SECTION_TITLES[n] ?? `§${n}`).join(", ")}`,
  ].join("\n");
}
