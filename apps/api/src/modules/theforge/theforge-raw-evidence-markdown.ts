/**
 * Convierte el JSON de `ask_codebase` + `responseMode: raw_evidence` (Ariadne ingest)
 * en markdown compacto para prompts Nest (evita volcar `gatheredContext` como un solo JSON escapado).
 */

function rawEvidenceGatheredMaxChars(): number {
  const n = parseInt(process.env.RAW_EVIDENCE_GATHERED_MAX_CHARS ?? "48000", 10);
  return Number.isFinite(n) && n > 0 ? n : 48000;
}

function rawEvidenceChunkTailMax(): number {
  const n = parseInt(process.env.RAW_EVIDENCE_CHUNK_TAIL_MAX ?? "6000", 10);
  return Number.isFinite(n) && n > 0 ? n : 6000;
}

function rawEvidenceMuestrasPerKey(): number {
  const n = parseInt(process.env.RAW_EVIDENCE_MUESTRAS_PER_KEY ?? "25", 10);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

function rawEvidenceCollectedMaxRows(): number {
  const n = parseInt(process.env.RAW_EVIDENCE_COLLECTED_MAX_ROWS ?? "120", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/** Cierra el objeto JSON que empieza en `openBraceIndex` (primer carácter `{`). */
export function indexOfMatchingJsonObjectEnd(s: string, openBraceIndex: number): number {
  if (s[openBraceIndex] !== "{") return -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openBraceIndex; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseFlatConteosObject(s: string): Record<string, number> | null {
  const m = /Conteos:\s*(\{[^}]+\})/.exec(s);
  if (!m) return null;
  try {
    const o = JSON.parse(m[1]) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function tryParseMuestrasObject(s: string): Record<string, unknown[]> | null {
  const idx = s.search(/\bMuestras:\s*\{/);
  if (idx < 0) return null;
  const braceStart = s.indexOf("{", idx);
  if (braceStart < 0) return null;
  const end = indexOfMatchingJsonObjectEnd(s, braceStart);
  if (end < braceStart) return null;
  try {
    const parsed = JSON.parse(s.slice(braceStart, end + 1)) as Record<string, unknown>;
    const out: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function formatMuestrasMarkdown(muestras: Record<string, unknown[]>): string {
  const perKey = rawEvidenceMuestrasPerKey();
  const lines: string[] = [];
  for (const [label, arr] of Object.entries(muestras)) {
    const take = Math.min(arr.length, perKey);
    lines.push(`##### ${label} (${take} de ${arr.length})`);
    lines.push("");
    for (let i = 0; i < take; i++) {
      const row = arr[i];
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const o = row as Record<string, unknown>;
        const p = o.path != null ? String(o.path) : "";
        const n = o.name != null ? String(o.name) : "";
        const method = o.method != null ? String(o.method) : "";
        const pathTemplate = o.pathTemplate != null ? String(o.pathTemplate) : "";
        if (p && n) lines.push(`- \`${p}\` — ${n}`);
        else if (pathTemplate && method) lines.push(`- \`${method} ${pathTemplate}\``);
        else if (p) lines.push(`- \`${p}\``);
        else if (n) lines.push(`- ${n}`);
        else lines.push(`- ${JSON.stringify(row).slice(0, 160)}`);
      } else {
        lines.push(`- ${String(row).slice(0, 200)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function formatGatheredChunk(chunk: string): string {
  const trimmed = chunk.trim();
  if (!trimmed) return "";
  const det = /^\[deterministic:[^\]]+\]/.exec(trimmed);
  const heading = det ? `#### ${det[0]}` : "#### Bloque";
  const inner = det ? trimmed.slice(det[0].length).trim() : trimmed;

  const parts: string[] = [heading, ""];

  const conteos = tryParseFlatConteosObject(inner);
  if (conteos) {
    parts.push("**Conteos (nodos por etiqueta)**");
    parts.push("");
    parts.push("| Etiqueta | Cantidad |");
    parts.push("| --- | ---: |");
    for (const [k, v] of Object.entries(conteos)) {
      parts.push(`| ${k} | ${v} |`);
    }
    parts.push("");
  }

  const muestras = tryParseMuestrasObject(inner);
  if (muestras) {
    parts.push("**Muestras**");
    parts.push("");
    parts.push(formatMuestrasMarkdown(muestras));
    parts.push("");
  }

  if (!conteos && !muestras) {
    const max = rawEvidenceChunkTailMax();
    parts.push(
      inner.length > max
        ? `${inner.slice(0, max)}\n\n_… recorte local (${inner.length} caracteres); sube RAW_EVIDENCE_CHUNK_TAIL_MAX si hace falta._`
        : inner,
    );
  } else {
    const tailMax = rawEvidenceChunkTailMax();
    const muestrasIdx = inner.search(/\bMuestras:\s*\{/);
    if (muestrasIdx >= 0) {
      const braceStart = inner.indexOf("{", muestrasIdx);
      if (braceStart >= 0) {
        const end = indexOfMatchingJsonObjectEnd(inner, braceStart);
        if (end > braceStart) {
          const after = inner.slice(end + 1).trim();
          if (after.length > 120) {
            parts.push("**Resto del bloque (recortado)**");
            parts.push("");
            parts.push(after.slice(0, tailMax) + (after.length > tailMax ? "\n\n_…_" : ""));
          }
        }
      }
    }
  }

  return parts.join("\n").trim();
}

/**
 * `gatheredContext` de Ariadne: mezcla de bloques `[deterministic:…]`, conteos planos y JSON "Muestras".
 */
export function formatGatheredContextForMarkdown(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const chunks = t.split(/\n---\s*\n/).map((c) => c.trim()).filter(Boolean);
  const body = chunks.map(formatGatheredChunk).filter(Boolean).join("\n\n---\n\n");
  const max = rawEvidenceGatheredMaxChars();
  if (body.length <= max) return body;
  return `${body.slice(0, max)}\n\n_… recorte global gatheredContext (${body.length} caracteres); RAW_EVIDENCE_GATHERED_MAX_CHARS._`;
}

/**
 * `collectedResults`: lista compacta en tabla markdown.
 */
export function formatCollectedResultsForMarkdown(v: unknown): string {
  if (!Array.isArray(v)) {
    return "```json\n" + JSON.stringify(v, null, 2).slice(0, 12000) + "\n```";
  }
  const maxRows = rawEvidenceCollectedMaxRows();
  const rows = v.slice(0, maxRows) as Record<string, unknown>[];
  const lines = [
    "| tipo | path | name | repoId |",
    "| --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const tipo = String(r.tipo ?? r.type ?? "");
    const path = String(r.path ?? "").slice(0, 160);
    const name = String(r.name ?? "").slice(0, 120);
    const repo = String(r.repoId ?? "").slice(0, 12);
    lines.push(`| ${tipo.replace(/\|/g, "\\|")} | \`${path.replace(/`/g, "'")}\` | ${name.replace(/\|/g, "\\|")} | \`${repo}\` |`);
  }
  if (v.length > maxRows) {
    lines.push("");
    lines.push(`_… +${v.length - maxRows} filas (RAW_EVIDENCE_COLLECTED_MAX_ROWS)._`);
  }
  return lines.join("\n");
}
