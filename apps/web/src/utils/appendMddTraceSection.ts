import type { MddTraceTargetSection } from "@theforge/shared-types";

const SECTION_HEADING: Record<MddTraceTargetSection, RegExp> = {
  s1: /^##\s*(?:1\.\s*)?(?:contexto\s+y\s+alcance|contexto\b)/im,
  s4: /^##\s*(?:4\.\s*)?(?:contratos\s+de\s+api|contratos\s+api|api\b)/im,
  s5: /^##\s*(?:5\.\s*)?(?:l[oó]gica|logic)/im,
};

const SECTION_DEFAULT_HEADING: Record<MddTraceTargetSection, string> = {
  s1: "## 1. Contexto y alcance",
  s4: "## 4. Contratos de API",
  s5: "## 5. Lógica y edge cases",
};

const SECTION_NUMBER: Record<MddTraceTargetSection, number> = {
  s1: 1,
  s4: 4,
  s5: 5,
};

function findSectionBounds(md: string, section: MddTraceTargetSection): { start: number; end: number } | null {
  const re = SECTION_HEADING[section];
  const m = re.exec(md);
  if (!m || m.index == null) return null;

  const start = m.index;
  const afterHeading = md.slice(start + m[0].length);
  const nextSection = afterHeading.search(/\n##\s+\d+\./m);
  const end = nextSection >= 0 ? start + m[0].length + nextSection : md.length;
  return { start, end };
}

/**
 * Añade markdown al final de §1, §4 o §5 sin reemplazar el cuerpo existente.
 * Si la sección no existe, la crea al final del documento.
 */
export function appendMddTraceSection(
  mddContent: string,
  targetSection: MddTraceTargetSection,
  suggestion: string,
): string {
  const md = (mddContent ?? "").trim();
  const patch = (suggestion ?? "").trim();
  if (!patch) return md;

  const bounds = findSectionBounds(md, targetSection);
  if (!bounds) {
    const heading = SECTION_DEFAULT_HEADING[targetSection];
    const suffix = md.length > 0 ? `\n\n${heading}\n\n${patch}` : `${heading}\n\n${patch}`;
    return `${md}${suffix}`.trim();
  }

  const before = md.slice(0, bounds.end).replace(/\s+$/, "");
  const after = md.slice(bounds.end);
  const sectionNum = SECTION_NUMBER[targetSection];
  const merged = `${before}\n\n<!-- trazabilidad BRD→MDD §${sectionNum} -->\n${patch}${after.startsWith("\n") ? "" : "\n"}${after}`;
  return merged.trim();
}
