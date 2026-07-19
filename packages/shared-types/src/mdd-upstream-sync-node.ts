import { createHash } from "node:crypto";
import {
  expandMddSectionsForSync,
  MDD_UPSTREAM_SOURCE_LABELS,
  normalizeBenchmarkDocumentBody,
  normalizeUpstreamDocumentBody,
  type MddUpstreamBaseline,
  type MddUpstreamChangeItem,
  type MddUpstreamSource,
  type MddUpstreamSyncAnalysis,
} from "./mdd-upstream-sync.js";

const SNAPSHOT_MAX = 32_000;

function normalizeUpstreamSourceBody(source: MddUpstreamSource, text: string | null | undefined): string {
  return source === "benchmark" ? normalizeBenchmarkDocumentBody(text) : normalizeUpstreamDocumentBody(text);
}

/** Evita falsos positivos cuando el hash del baseline es legacy pero el cuerpo no cambió. */
function upstreamSourceUnchanged(
  baseline: MddUpstreamBaseline,
  source: MddUpstreamSource,
  currentRaw: string | null | undefined,
  currentHash: string,
): boolean {
  const hashKey = `${source}ContentHash` as keyof MddUpstreamBaseline;
  if ((baseline[hashKey] as string) === currentHash) return true;

  const lenKey = `${source}Length` as keyof MddUpstreamBaseline;
  const snapKey = `${source}ContentSnapshot` as keyof MddUpstreamBaseline;
  const docLen = baseline[lenKey] as number;
  if (docLen > SNAPSHOT_MAX) return false;

  const beforeNorm = (baseline[snapKey] as string) ?? "";
  const afterNorm = normalizeUpstreamSourceBody(source, currentRaw);
  return beforeNorm.length > 0 && beforeNorm === afterNorm;
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
  const benchmark = normalizeBenchmarkDocumentBody(input.benchmarkContent);
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
      changedSources: [],
      changes: [],
      recommendedSections: [],
      expandedSections: [],
      canSync: false,
      needsFullRegen: false,
      pendingSync: false,
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
      after: normalizeBenchmarkDocumentBody(input.benchmarkContent),
      hashKey: "benchmarkContentHash",
      snapshotKey: "benchmarkContentSnapshot",
    },
  ];

  for (const p of pairs) {
    const currentHash = current[p.hashKey] as string;
    const baseHash = baseline[p.hashKey] as string;
    if (currentHash === baseHash) continue;
    const rawInput =
      p.source === "dbga"
        ? input.dbgaContent
        : p.source === "brd"
          ? input.brdContent
          : input.benchmarkContent;
    if (upstreamSourceUnchanged(baseline, p.source, rawInput, currentHash)) continue;
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
