/** Extrae cuerpo de una sección MDD (desde heading hasta el siguiente ##). */
export function extractMddSectionBody(
  draft: string,
  heading: string,
): { body: string; start: number; end: number } | null {
  const idx = draft.indexOf(heading);
  if (idx === -1) return null;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const end = nextH2 !== -1 ? sectionStart + nextH2 : draft.length;
  return { body, start: sectionStart, end };
}
