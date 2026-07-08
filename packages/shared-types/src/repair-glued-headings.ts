/**
 * Despega encabezados markdown pegados a prosa u otros headings (§1 MDD, BRD, handoff).
 * SSOT compartido entre `formatDocumentMarkdown` (Workshop /formatear), `mdd-sanitize` y `MddViewer`.
 */

const MDD_TOP_SECTION_TITLE =
  /^(?:Contexto|Arquitectura y Stack|Modelo de Datos|Contratos de API|Lógica y Edge Cases|Seguridad|Integración y DevOps|Testing|UI\/UX|Manifest)\b/i;

/** `1. Contexto y Alcance ### Propósito` (sin `##`) → H2 + ### en líneas separadas. */
function fixBareNumberedSectionGluedSubheadings(draft: string): string {
  return draft.replace(/^(\d+\.\s+[^\n#]+?)\s+(#{2,4}\s+)/gm, "## $1\n\n$2");
}

/** Promueve `1. Contexto y Alcance` suelto a `## 1. Contexto y Alcance`. */
function promoteBareNumberedMddSectionLine(draft: string): string {
  return draft.replace(/^(?!\s*#)(\d+\.\s+[^\n#]+)$/gm, (line) => {
    const title = line.trim().replace(/^\d+\.\s+/, "");
    if (!MDD_TOP_SECTION_TITLE.test(title)) return line;
    return `## ${line.trim()}`;
  });
}

/** Normaliza `### 1. Contexto` → `## 1. Contexto` (secciones canónicas del MDD). */
function normalizeMddTopLevelSectionHeadings(draft: string): string {
  return draft.replace(
    /^#{1,6}\s+(\d+\.\s+(?:Contexto|Arquitectura y Stack|Modelo de Datos|Contratos de API|Lógica y Edge Cases|Seguridad|Integración y DevOps|Testing|UI\/UX|Manifest)[^\n]*)$/gim,
    "## $1",
  );
}

/** Despega `## 3. Foo### 3.1 Bar` o `## 3. Foo### SQL` → H2 + ### en líneas separadas. */
function fixGluedSubsectionHeadings(draft: string): string {
  return draft
    .replace(/^(##\s+\d+\.\s+[^\n#]+?)\s*(#{1,3}\s+\S+)/gm, "$1\n\n$2")
    .replace(/^(#{3,4}\s+[^\n#]+?)\s*(#{3,4}\s+\S+)/gm, "$1\n\n$2")
    .replace(/^\s+(#{3,4}\s+)/gm, "$1");
}

/** Asegura espacio tras `#` en headings (`###Foo` → `### Foo`). */
function normalizeMarkdownHeadingHashSpacing(draft: string): string {
  return draft.replace(/^(#{1,6})([^\s#\n])/gm, "$1 $2");
}

/** Parte subtítulos ### / #### incrustados en prosa (típico del Clarifier/Architect en §1). */
function fixInlineMarkdownSubheadings(draft: string): string {
  return draft
    .replace(
      /([^\n#])(\s+#{3,4}\s+(?=[A-Za-zÁÉÍÓÚÑ0-9]))/g,
      (_m, before: string, heading: string) => `${before}\n\n${heading.trim()}`,
    )
    .replace(/([.!?])\s+(#{3,4}\s+)/g, "$1\n\n$2")
    .replace(/([)\]])\s+(#{2,4}\s+)/g, "$1\n\n$2")
    .replace(
      /([a-záéíóúñA-ZÁÉÍÓÚÑ0-9])\s+(#{2,4}\s+(?=[A-ZÁÉÍÓÚÑ]))/g,
      "$1\n\n$2",
    );
}

/** Separa corridas de etiquetas en negrita en la misma línea (escenarios UAT, riesgos). */
function splitInlineBoldLabelRuns(draft: string): string {
  return draft
    .replace(/(\*\*[^*\n]+\*\*)\s+(\*\*[^*\n]+\*\*)/g, "$1\n\n$2")
    .replace(/([^\n#])(\s+\*\*(?:Escenario|Riesgo)\s+\d+)/gi, "$1\n\n$2");
}

/** Despega cuerpo en **negrita** pegado a la línea de un encabezado. */
function fixGluedHeadingBoldBody(draft: string): string {
  return draft.replace(/^(#{2,6}\s+[^\n*]+?)\s+(\*\*[^\n]+)$/gm, "$1\n\n$2");
}

/** Despega H2/H3 de fences (ej. `## 3. Modelo de Datos```sql`). */
function fixGluedHeadingToCodeFence(draft: string): string {
  return draft.replace(
    /^(##\s+\d+\.\s+[^\n`]+?)```(sql|json|mermaid|TechnicalMetadata)\b/gim,
    "$1\n\n```$2",
  );
}

/** Despega prosa pegada al título en la misma línea (`### Título Este sistema…`). */
function splitHeadingTitleFromInlineProse(draft: string): string {
  return draft
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!/^#{2,4}\s+/.test(trimmed)) return line;
      const m = trimmed.match(/^(#{2,4}\s+)(.+)$/);
      if (!m) return line;
      const [, prefix, rest = ""] = m;
      const body = rest.match(
        /^(.+?)\s+((?:Este|Esta|El|La|Los|Las|Un|Una|Desarrolladores)\b[\s\S].*)$/u,
      );
      if (!body || body[1]!.trim().length < 8) return line;
      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      return `${indent}${prefix}${body[1]!.trim()}\n\n${indent}${body[2]!.trim()}`;
    })
    .join("\n");
}

/** Reparación genérica de headings pegados (iteración a punto fijo). */
export function repairGluedMarkdownHeadings(draft: string): string {
  if (!draft?.trim()) return draft ?? "";
  let out = fixBareNumberedSectionGluedSubheadings(draft);
  out = fixGluedHeadingToCodeFence(out);
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = fixGluedSubsectionHeadings(out);
    out = fixInlineMarkdownSubheadings(out);
    out = fixBareNumberedSectionGluedSubheadings(out);
  }
  out = normalizeMarkdownHeadingHashSpacing(out);
  out = promoteBareNumberedMddSectionLine(out);
  out = normalizeMddTopLevelSectionHeadings(out);
  out = fixGluedHeadingBoldBody(out);
  out = splitInlineBoldLabelRuns(out);
  out = out.replace(/^(##\s+\d+\.\s+[^\n#]+?)\s+(#{2,4}\s+)/gm, "$1\n\n$2");
  out = splitHeadingTitleFromInlineProse(out);
  return out.replace(/\n{3,}/g, "\n\n");
}
