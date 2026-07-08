/**
 * Despega encabezados markdown pegados a prosa u otros headings (§1 MDD, BRD, handoff).
 * SSOT compartido entre `formatDocumentMarkdown` (Workshop /formatear) y `mdd-sanitize`.
 */

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

/** Reparación genérica de headings pegados (iteración a punto fijo). */
export function repairGluedMarkdownHeadings(draft: string): string {
  if (!draft?.trim()) return draft ?? "";
  let out = fixGluedHeadingToCodeFence(draft);
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = fixGluedSubsectionHeadings(out);
    out = fixInlineMarkdownSubheadings(out);
  }
  out = normalizeMarkdownHeadingHashSpacing(out);
  out = fixGluedHeadingBoldBody(out);
  out = splitInlineBoldLabelRuns(out);
  out = out.replace(/^(##\s+\d+\.\s+[^\n#]+?)\s+(#{2,4}\s+)/gm, "$1\n\n$2");
  return out.replace(/\n{3,}/g, "\n\n");
}
