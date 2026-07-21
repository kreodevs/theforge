/**
 * Delta de cascada tras cambio de MDD: qué entregables regenerar según secciones afectadas.
 */

import type { DeliverableWaveStep } from "./deliverables-matrix.js";

export type MddSectionChange = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "unknown";

export type MddCascadeDelta = {
  changedSections: MddSectionChange[];
  affectedDeliverables: DeliverableWaveStep[];
  summary: string;
};

const SECTION_TO_DELIVERABLES: Record<MddSectionChange, DeliverableWaveStep[]> = {
  "1": ["spec", "architecture", "use_cases", "user_stories"],
  "2": ["architecture", "blueprint", "infra"],
  "3": ["blueprint", "api_contracts", "tasks", "logic_flows"],
  "4": ["api_contracts", "logic_flows", "tasks"],
  "5": ["logic_flows", "use_cases", "user_stories", "tasks"],
  "6": ["architecture", "infra", "agent_governance"],
  "7": ["infra", "agent_governance"],
  unknown: ["blueprint", "api_contracts", "logic_flows", "tasks", "infra"],
};

function extractSectionHashes(markdown: string): Map<MddSectionChange, string> {
  const map = new Map<MddSectionChange, string>();
  let current: MddSectionChange | null = null;
  let buf = "";

  const flush = () => {
    if (current) map.set(current, buf.trim());
    buf = "";
  };

  const titleToSection = (title: string): MddSectionChange | null => {
    const t = title.toLowerCase();
    if (/contexto|alcance|visi[oó]n/.test(t)) return "1";
    if (/stack|arquitectura|componentes|§2/.test(t)) return "2";
    if (/modelo|datos|entidades|§3/.test(t)) return "3";
    if (/contratos|api|§4/.test(t)) return "4";
    if (/l[oó]gica|flujos|§5/.test(t)) return "5";
    if (/seguridad|§6/.test(t)) return "6";
    if (/infra|despliegue|§7/.test(t)) return "7";
    return null;
  };

  for (const line of markdown.split("\n")) {
    const m = line.match(/^##\s*(?:\d+\.\s*)?(.+)$/);
    if (m) {
      flush();
      current = titleToSection(m[1] ?? "") ?? "unknown";
      buf = line + "\n";
    } else {
      buf += line + "\n";
    }
  }
  flush();
  return map;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

/** Compara MDD anterior vs nuevo y devuelve pasos de cascada mínimos. */
export function computeMddCascadeDelta(
  previousMdd: string | null | undefined,
  nextMdd: string | null | undefined,
): MddCascadeDelta {
  const prev = (previousMdd ?? "").trim();
  const next = (nextMdd ?? "").trim();

  if (!prev || prev.length < 80) {
    return {
      changedSections: ["unknown"],
      affectedDeliverables: SECTION_TO_DELIVERABLES.unknown,
      summary: "MDD nuevo o vacío — cascada completa recomendada",
    };
  }
  if (!next || next.length < 80) {
    return { changedSections: [], affectedDeliverables: [], summary: "MDD vacío — sin delta" };
  }

  const prevSections = extractSectionHashes(prev);
  const nextSections = extractSectionHashes(next);
  const allKeys = new Set([...prevSections.keys(), ...nextSections.keys()]);
  const changedSections: MddSectionChange[] = [];

  for (const key of allKeys) {
    const a = prevSections.get(key) ?? "";
    const b = nextSections.get(key) ?? "";
    if (simpleHash(a) !== simpleHash(b)) changedSections.push(key);
  }

  if (changedSections.length === 0) {
    return {
      changedSections: [],
      affectedDeliverables: [],
      summary: "Sin cambios detectados en secciones MDD",
    };
  }

  const deliverableSet = new Set<DeliverableWaveStep>();
  for (const sec of changedSections) {
    for (const d of SECTION_TO_DELIVERABLES[sec] ?? []) deliverableSet.add(d);
  }

  return {
    changedSections,
    affectedDeliverables: [...deliverableSet],
    summary: `Secciones MDD modificadas: ${changedSections.join(", ")}`,
  };
}
