/**
 * Deduplica secciones repetidas en DBGA / Fase 0 cuando el orquestador concatenó
 * bloques en lugar de reemplazar (varios `# Domain Benchmark & Gap Analysis`).
 */

import {
  DOCUMENT_CHANGELOG_HEADING,
  DOCUMENT_CHANGELOG_TABLE_HEADER,
  type DocumentChangelogEntry,
} from "./document-changelog.js";

const DBGA_TITLE = "# Domain Benchmark & Gap Analysis";
const FASE0_TITLE = "# Fase 0 — Especificación Inicial";

const SECTION_ORDER: Array<{ key: string; pattern: RegExp }> = [
  { key: "referencia", pattern: /^##\s+Referencia de Industria\b/i },
  { key: "s1", pattern: /^##\s+1\.\s+Prop[oó]sito/i },
  { key: "s2", pattern: /^##\s+2\.\s+Entidades/i },
  { key: "s3", pattern: /^##\s+3\.\s+Reglas de Negocio/i },
  { key: "s4", pattern: /^##\s+4\.\s+Flujos/i },
  { key: "s5", pattern: /^##\s+5\.\s+Roles/i },
  { key: "s6", pattern: /^##\s+6\.\s+Integraciones/i },
  { key: "s7", pattern: /^##\s+7\.\s+Edge Cases/i },
  { key: "s8", pattern: /^##\s+8\.\s+Interfaz/i },
  { key: "s9", pattern: /^##\s+9\.\s+Salidas/i },
  { key: "s10", pattern: /^##\s+10\.\s+Preguntas/i },
  { key: "s11", pattern: /^##\s+11\.\s+(?:API|Integraci)/i },
  { key: "s8_pendientes", pattern: /^##\s+8\.\s+Preguntas Pendientes/i },
  { key: "s9_glosario", pattern: /^##\s+9\.\s+Glosario/i },
  { key: "s10_stack", pattern: /^##\s+10\.\s+Stack declarado/i },
  { key: "s11_riesgos", pattern: /^##\s+11\.\s+Riesgos/i },
  { key: "s12_uat", pattern: /^##\s+12\.\s+(?:Criterios de Aceptaci[oó]n|UAT)/i },
  { key: "changelog", pattern: /^##\s+Registro de cambios del documento\b/i },
];

type MarkdownSection = {
  heading: string;
  body: string;
  key: string | null;
};

const VERSION_ROW_RE =
  /^\|\s*(\d+(?:\.\d+)?)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*$/gm;

function isDbgaShapedDocument(content: string): boolean {
  return (
    /^#\s+Domain Benchmark/im.test(content) ||
    /^#\s+Fase 0\s*[—-]/im.test(content) ||
    /^##\s+Referencia de Industria/im.test(content)
  );
}

function countHeadingMatches(content: string, pattern: RegExp): number {
  return (content.match(pattern) ?? []).length;
}

/** True cuando un DBGA/Fase 0 tiene secciones o títulos repetidos (concatenación del orquestador). */
export function hasDuplicateDbgaBlocks(content: string): boolean {
  const trimmed = (content ?? "").trim();
  if (!trimmed || !isDbgaShapedDocument(trimmed)) return false;

  if (countHeadingMatches(trimmed, /^# Domain Benchmark & Gap Analysis\s*$/gm) > 1) return true;
  if (countHeadingMatches(trimmed, /^# Fase 0\s*[—-]\s*Especificaci[oó]n Inicial\s*$/gm) > 1) {
    return true;
  }
  if (countHeadingMatches(trimmed, /^##\s+1\.\s+Prop[oó]sito/gim) > 1) return true;
  if (countHeadingMatches(trimmed, /^##\s+2\.\s+Entidades del Dominio/gim) > 1) return true;
  if (countHeadingMatches(trimmed, /^##\s+Registro de cambios del documento\s*$/gm) > 1) {
    return true;
  }

  return false;
}

function resolveSectionKey(heading: string): string | null {
  const h = heading.trim();
  if (/^#\s+Domain Benchmark/i.test(h) || /^#\s+Fase 0/i.test(h)) return "title";
  for (const { key, pattern } of SECTION_ORDER) {
    if (pattern.test(h)) return key;
  }
  return null;
}

function splitMarkdownSections(content: string): MarkdownSection[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const re = /^(#{1,2}\s+[^\n]+)$/gm;
  const matches = [...trimmed.matchAll(re)];
  if (matches.length === 0) return [];

  const sections: MarkdownSection[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const heading = match?.[1] ?? "";
    const start = match?.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]?.index ?? trimmed.length) : trimmed.length;
    const bodyStart = start + heading.length;
    const body = trimmed.slice(bodyStart, end).trim();
    sections.push({
      heading,
      body,
      key: resolveSectionKey(heading),
    });
  }
  return sections;
}

function looksTruncated(body: string): boolean {
  const t = body.trimEnd();
  if (!t) return true;

  const fenceCount = (t.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) return true;

  const lastLine = t.split("\n").pop()?.trim() ?? "";
  if (/^#{1,6}\s/.test(lastLine)) return true;
  if (/^-\s+\S/.test(lastLine) && !/[.!?)]$/.test(lastLine)) return true;
  if (lastLine.startsWith("|") && !lastLine.endsWith("|")) return true;

  if (
    lastLine.length > 48 &&
    /[a-záéíóúñA-ZÁÉÍÓÚÑ,]$/.test(lastLine) &&
    !lastLine.startsWith("|") &&
    !lastLine.startsWith("```")
  ) {
    const lastWord = lastLine.split(/\s+/).pop() ?? "";
    if (lastWord.length > 4 && !/[.!?;:)]$/.test(lastWord)) return true;
  }

  return false;
}

function structureBonus(key: string, body: string): number {
  const subsections = (body.match(/^###\s+/gm) ?? []).length;
  const bullets = (body.match(/^- /gm) ?? []).length;
  if (key === "s2") return subsections * 800;
  if (key === "s3") return bullets * 25;
  if (key === "s4") return subsections * 400;
  if (key === "s1" && body.includes("**Arquitectura Multi-Agente:**")) return 1_500;
  if (key === "s11_riesgos") return bullets * 50;
  if (key === "s12_uat") return bullets * 50;
  if (key === "s9_glosario") return bullets * 30;
  if (key === "s10_stack") return bullets * 20;
  return subsections * 100;
}

function sectionScore(key: string, body: string): number {
  let score = body.trim().length + structureBonus(key, body);
  if (looksTruncated(body)) score -= 100_000;
  return score;
}

function pickBestSection(key: string, candidates: MarkdownSection[]): MarkdownSection {
  return candidates.reduce((best, cur) =>
    sectionScore(key, cur.body) > sectionScore(key, best.body) ? cur : best,
  );
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [major = "0", minor = "0"] = v.split(".");
    return {
      major: Number.parseInt(major, 10) || 0,
      minor: Number.parseInt(minor, 10) || 0,
    };
  };
  const av = parse(a);
  const bv = parse(b);
  if (av.major !== bv.major) return av.major - bv.major;
  return av.minor - bv.minor;
}

function parseChangelogEntries(body: string): DocumentChangelogEntry[] {
  const byVersion = new Map<string, DocumentChangelogEntry>();
  for (const match of body.matchAll(VERSION_ROW_RE)) {
    const version = (match[1] ?? "").trim();
    if (!version || version === "---") continue;
    const date = (match[2] ?? "").trim();
    const description = (match[3] ?? "").trim();
    const prev = byVersion.get(version);
    if (!prev || description.length > prev.description.length) {
      byVersion.set(version, { version, date, description });
    }
  }
  return [...byVersion.values()].sort((a, b) => compareVersions(a.version, b.version));
}

function buildChangelogSection(entries: DocumentChangelogEntry[]): string {
  if (entries.length === 0) {
    return `${DOCUMENT_CHANGELOG_HEADING}\n\n${DOCUMENT_CHANGELOG_TABLE_HEADER}\n| 1.0 | Julio 2026 | Creación inicial del DBGA |`;
  }
  const rows = entries
    .map((e) => `| ${e.version} | ${e.date} | ${e.description} |`)
    .join("\n");
  return `${DOCUMENT_CHANGELOG_HEADING}\n\n${DOCUMENT_CHANGELOG_TABLE_HEADER}\n${rows}`;
}

function collectChangelogEntries(sections: MarkdownSection[]): DocumentChangelogEntry[] {
  const merged = new Map<string, DocumentChangelogEntry>();
  for (const section of sections) {
    if (section.key !== "changelog") continue;
    for (const entry of parseChangelogEntries(section.body)) {
      const prev = merged.get(entry.version);
      if (!prev || entry.description.length > prev.description.length) {
        merged.set(entry.version, entry);
      }
    }
  }
  // También buscar filas de changelog incrustadas en cuerpos contaminados (tabla + ## 2. Entidades…)
  for (const section of sections) {
    for (const entry of parseChangelogEntries(section.body)) {
      const prev = merged.get(entry.version);
      if (!prev || entry.description.length > prev.description.length) {
        merged.set(entry.version, entry);
      }
    }
  }
  return [...merged.values()].sort((a, b) => compareVersions(a.version, b.version));
}

function detectTitle(sections: MarkdownSection[]): string {
  const titleSection = sections.find((s) => s.key === "title");
  if (titleSection?.heading.startsWith("# Fase 0")) return FASE0_TITLE;
  return DBGA_TITLE;
}

/**
 * Reconstruye un único DBGA tomando, por cada sección canónica, la copia más completa
 * (más larga y no truncada). Fusiona tablas de changelog por número de versión.
 */
export function deduplicateDbgaDocument(content: string): string {
  const trimmed = (content ?? "").trim();
  if (!trimmed || !hasDuplicateDbgaBlocks(trimmed)) return trimmed;

  const sections = splitMarkdownSections(trimmed);
  if (sections.length === 0) return trimmed;

  const grouped = new Map<string, MarkdownSection[]>();
  for (const section of sections) {
    if (!section.key || section.key === "title") continue;
    const list = grouped.get(section.key) ?? [];
    list.push(section);
    grouped.set(section.key, list);
  }

  const title = detectTitle(sections);
  const changelogEntries = collectChangelogEntries(sections);

  const parts: string[] = [title, ""];
  for (const { key } of SECTION_ORDER) {
    if (key === "changelog") continue;
    const candidates = grouped.get(key);
    if (!candidates?.length) continue;
    const best = pickBestSection(key, candidates);
    parts.push(best.heading, "", best.body, "");
  }

  parts.push(buildChangelogSection(changelogEntries));
  return parts.join("\n").trim();
}
