/**
 * Repara §4 Flujos Principales en documentos Fase 0 cuando el LLM emite pasos como
 * `## 1. …` (H2) o notas sueltas como `### La cola…` en lugar de listas ordenadas.
 */

const FLOWS_SECTION_HEADING = /^##\s+\d+\.\s+Flujos Principales\s*$/i;
const H2_NUMBERED_STEP = /^##\s+(\d+)\.\s+(.+)$/;
const ORDERED_STEP = /^\d+\.\s+/;
/** Notas de continuación mal promovidas a H3 (p. ej. «La cola es gestionada…»). */
const CONTINUATION_H3 = /^###\s+((?:La|El|Los|Las|Un|Una)\s.+)$/i;

/** Encabezados canónicos de Fase 0 (§1–§8); distingue pasos `## 5. …` de `## 5. Roles`. */
const PHASE0_TOP_SECTION =
  /^##\s+\d+\.\s+(?:Propósito y Alcance|Entidades del Dominio|Reglas de Negocio|Flujos Principales|Roles y Permisos|Integraciones Externas|Edge Cases y Supuestos|Preguntas Pendientes)\s*$/i;

function isPhase0TopSection(line: string): boolean {
  return PHASE0_TOP_SECTION.test(line.trim());
}

function findFlowsSectionRange(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex((l) => FLOWS_SECTION_HEADING.test(l.trim()));
  if (start < 0) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i]!.trim();
    if (isPhase0TopSection(trimmed) && !FLOWS_SECTION_HEADING.test(trimmed)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

/** Normaliza pasos y notas dentro de `## 4. Flujos Principales`. */
export function repairPhase0FlowFormat(text: string): string {
  if (!text?.trim()) return text ?? "";

  const lines = text.split("\n");
  const range = findFlowsSectionRange(lines);
  if (!range) return text;

  let prevWasNumberedStep = false;

  for (let i = range.start + 1; i < range.end; i += 1) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const h2Step = trimmed.match(H2_NUMBERED_STEP);
    if (h2Step) {
      const indent = raw.match(/^(\s*)/)?.[1] ?? "";
      lines[i] = `${indent}${h2Step[1]}. ${h2Step[2]}`;
      prevWasNumberedStep = true;
      continue;
    }

    if (ORDERED_STEP.test(trimmed)) {
      prevWasNumberedStep = true;
      continue;
    }

    const continuation = trimmed.match(CONTINUATION_H3);
    if (continuation && prevWasNumberedStep) {
      const indent = raw.match(/^(\s*)/)?.[1] ?? "";
      lines[i] = `${indent}- ${continuation[1]}`;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      prevWasNumberedStep = false;
      continue;
    }

    prevWasNumberedStep = false;
  }

  return lines.join("\n");
}
