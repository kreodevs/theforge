/**
 * Resuelve el borrador de Paso 0 desde las fuentes persistidas del proyecto.
 *
 * En el Workshop hay dos representaciones:
 * - dbgaContent: markdown visible en pestaña Fase 0 (puede ser DBGA libre o Fase 0 estructurado)
 * - phase0SummaryContent: JSON interno de la entrevista, o Deep Research en pestaña Benchmark
 */

import { isPhase0StructuredMarkdown, markdownToPhase0Document } from "./phase0-from-markdown.js";
import { mergePhase0Borrador, mergePhase0StringList, normalizePhase0Document } from "./phase0-normalize.util.js";
import type { Phase0Document, Phase0Flow, Phase0Role } from "./phase0.types.js";

export const MIN_DBGA_AUDIT_CHARS = 150;

export function hasBorradorContent(borrador: Phase0Document): boolean {
  const doc = normalizePhase0Document(borrador);
  return (
    doc.proposito.problema.trim().length > 0 ||
    doc.entidades.length > 0 ||
    doc.reglasNegocio.length > 0 ||
    doc.flujos.length > 0 ||
    doc.roles.length > 0
  );
}

/** Hay documento auditable en el Workshop (DBGA visible o borrador estructurado). */
export function hasAuditDocument(
  dbgaContent: string | null | undefined,
  phase0SummaryContent: string | null | undefined,
): boolean {
  const dbga = dbgaContent?.trim() ?? "";
  if (dbga.length >= MIN_DBGA_AUDIT_CHARS) return true;

  const borrador = loadProjectBorrador(dbgaContent, phase0SummaryContent);
  return hasBorradorContent(borrador);
}

/** dbgaContent con contenido pero sin plantilla Fase 0 canónica (DBGA libre). */
export function isFreeformDbgaContent(dbgaContent: string | null | undefined): boolean {
  const md = dbgaContent?.trim() ?? "";
  if (md.length < MIN_DBGA_AUDIT_CHARS) return false;
  return !isPhase0StructuredMarkdown(md);
}

function parseBorradorJson(raw: string | null | undefined): Phase0Document | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizePhase0Document(parsed);
  } catch {
    return null;
  }
}

export function loadProjectBorrador(
  dbgaContent: string | null | undefined,
  phase0SummaryContent: string | null | undefined,
): Phase0Document {
  const markdown = dbgaContent?.trim() ?? "";
  if (markdown && isPhase0StructuredMarkdown(markdown)) {
    return markdownToPhase0Document(markdown);
  }

  const fromJson = parseBorradorJson(phase0SummaryContent);
  if (fromJson && hasBorradorContent(fromJson)) {
    return fromJson;
  }

  if (markdown) {
    if (isPhase0StructuredMarkdown(markdown)) {
      return markdownToPhase0Document(markdown);
    }
    const heuristic = heuristicBorradorFromFreeformDbga(markdown);
    if (hasBorradorContent(heuristic)) return heuristic;
  }

  return (
    fromJson ?? {
      proposito: { problema: "", usuarios: [], outOfScope: [] },
      entidades: [],
      reglasNegocio: [],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    }
  );
}

/** Fallback sin LLM: infiere borrador desde DBGA libre (incl. numeración no canónica §5 Reglas, §6 Flujos). */
export function heuristicBorradorFromFreeformDbga(markdown: string): Phase0Document {
  let doc: Phase0Document = {
    proposito: { problema: "", usuarios: [], outOfScope: [] },
    entidades: [],
    reglasNegocio: [],
    flujos: [],
    roles: [],
    integraciones: [],
    edgeCases: [],
    preguntasPendientes: [],
  };

  const rawLines = markdown.split("\n");

  if (/##\s*1\.\s*Prop[oó]sito/i.test(markdown)) {
    doc = mergePhase0Borrador(doc, markdownToPhase0Document(markdown));
  } else {
    const lines = rawLines.map((l) => l.trim()).filter(Boolean);
    const h1 = lines.find((l) => l.startsWith("# "));
    doc.proposito.problema =
      (h1 ?? "").replace(/^#+\s*/, "").trim() || markdown.slice(0, 400).trim();
  }

  doc.reglasNegocio = mergePhase0StringList(
    doc.reglasNegocio,
    extractBulletsUnderHeading(rawLines, /##\s+\d+\.\s*Reglas de Negocio/i),
  );
  doc.integraciones = mergePhase0StringList(
    doc.integraciones,
    extractBulletsUnderHeading(rawLines, /##\s+\d+\.\s*Integraciones/i),
  );
  doc.edgeCases = mergePhase0StringList(
    doc.edgeCases,
    extractBulletsUnderHeading(rawLines, /##\s+\d+\.\s*Edge Cases/i),
  );

  const flujos = extractFlowsUnderHeading(rawLines, /##\s+\d+\.\s*Flujos/i);
  if (flujos.length > 0) {
    doc.flujos = flujos;
  }

  const roles = extractRolesUnderHeading(rawLines, /##\s+\d+\.\s*Roles/i);
  if (roles.length > 0) {
    doc.roles = roles;
  }

  if (doc.entidades.length === 0) {
    for (const line of rawLines) {
      const t = line.trim();
      if (t.startsWith("### ")) {
        const name = t.slice(4).trim();
        if (name.length > 1 && !name.toLowerCase().includes("índice")) {
          doc.entidades.push({
            nombre: name,
            descripcion: "Mencionado en el documento DBGA",
            atributosClave: [],
          });
        }
      }
    }
  }

  return normalizePhase0Document(doc);
}

function extractBulletsUnderHeading(lines: string[], headingRe: RegExp): string[] {
  const idx = lines.findIndex((l) => headingRe.test(l.trim()));
  if (idx < 0) return [];
  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (/^##\s+\d+\./.test(t)) break;
    if (t.startsWith("- ")) out.push(t.slice(2).trim());
    else if (/^\*\*R\d/.test(t)) out.push(t);
  }
  return out;
}

function extractFlowsUnderHeading(lines: string[], headingRe: RegExp): Phase0Flow[] {
  const idx = lines.findIndex((l) => headingRe.test(l.trim()));
  if (idx < 0) return [];
  const flows: Phase0Flow[] = [];
  let current: Phase0Flow | null = null;
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (/^##\s+\d+\./.test(t)) break;
    if (t.startsWith("### ")) {
      if (current?.nombre) flows.push(current);
      current = { nombre: t.slice(4).trim(), pasos: [] };
      continue;
    }
    const step = t.match(/^(?:##\s+)?(\d+)\.\s+(.+)$/);
    if (step && current) {
      current.pasos.push(step[2]!.trim());
    }
  }
  if (current?.nombre) flows.push(current);
  return flows;
}

function extractRolesUnderHeading(lines: string[], headingRe: RegExp): Phase0Role[] {
  const idx = lines.findIndex((l) => headingRe.test(l.trim()));
  if (idx < 0) return [];
  const roles: Phase0Role[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (/^##\s+\d+\./.test(t)) break;
    const row = t.match(/^\|\s*\*?\*?([^|*]+)\*?\*?\s*\|/);
    if (row && !/^:?-+:?$/.test(row[1]!.trim()) && !/^\s*Rol\s/i.test(row[1]!)) {
      const rol = row[1]!.trim();
      if (rol.length > 1) roles.push({ rol, permisos: [] });
      continue;
    }
    const bullet = t.match(/^-\s+\*\*(.+?):\*\*\s*(.+)$/);
    if (bullet) {
      roles.push({
        rol: bullet[1]!.trim(),
        permisos: bullet[2]!
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      });
    }
  }
  return roles;
}
