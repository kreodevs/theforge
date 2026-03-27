/**
 * Parsea el documento de infra (markdown) y suma las horas fijas.
 * Busca líneas con "+N h", "+N hrs", "N horas" o sección "Horas fijas" / "horas fijas".
 */
export function parseInfraFixedHours(infraContent: string | null): number {
  if (!infraContent?.trim()) return 0;
  const content = infraContent.trim();
  const sectionMatch = content.match(/(?:##?\s*Horas\s*fijas[\s\S]*?)(?=##|$)/i);
  const search = sectionMatch ? sectionMatch[0] : content;
  const regex = /(?:\+\s*)?(\d+)\s*(?:h|hrs?|horas?)\b/gi;
  let sum = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(search)) !== null) {
    sum += parseInt(m[1] ?? "0", 10);
  }
  return sum;
}
