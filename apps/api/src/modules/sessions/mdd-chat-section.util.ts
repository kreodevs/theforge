/** Alineado con `REGENERATE_SECTION_N_PATTERN` en frontend `mddSectionRegen.ts`. */
const REGENERATE_SECTION_N_PATTERN =
  /\b(?:regenera(?:r)?|rehacer|actualiza(?:r)?|genera(?:r)?\s+de\s+nuevo)\s+(?:solo\s+)?(?:la\s+)?(?:secci[oó]n|paso)\s*([1-7])\b/i;

const MDD_SECTION_SLUGS: Array<{ slug: string; section: number }> = [
  { slug: "contexto", section: 1 },
  { slug: "arquitectura", section: 2 },
  { slug: "modelo-datos", section: 3 },
  { slug: "contratos-api", section: 4 },
  { slug: "logica", section: 5 },
  { slug: "seguridad", section: 6 },
  { slug: "infraestructura", section: 7 },
];

const SECTION_KEYWORD_RULES: Array<{ pattern: RegExp; section: number }> = [
  { pattern: /\b(?:§|secci[oó]n)\s*1\b|contexto|alcance|constituci/i, section: 1 },
  { pattern: /\b(?:§|secci[oó]n)\s*2\b|arquitectura\s+y\s+stack|stack\s+tecnol/i, section: 2 },
  {
    pattern:
      /\b(?:§|secci[oó]n)\s*3\b|modelo\s+de\s+datos|erdiagram|diagrama\s+er|tablas?\s+sql|entidad(?:es)?\b/i,
    section: 3,
  },
  {
    pattern: /\b(?:§|secci[oó]n)\s*4\b|contratos?\s+(?:de\s+)?api|endpoints?|payloads?|openapi/i,
    section: 4,
  },
  { pattern: /\b(?:§|secci[oó]n)\s*5\b|l[oó]gica|edge\s*case|casos?\s+borde/i, section: 5 },
  { pattern: /\b(?:§|secci[oó]n)\s*6\b|seguridad|authn|authz|mfa|rbac|totp|oauth/i, section: 6 },
  {
    pattern: /\b(?:§|secci[oó]n)\s*7\b|infra(?:estructura)?|docker|kubernetes|despliegue|ci\/cd/i,
    section: 7,
  },
  { pattern: /\bsql\b|mermaid\b|api\b|contrato\b|endpoint\b|tabla\b/i, section: 3 },
];

/** Default § para `software_architect` cuando el mensaje no menciona una sección explícita. */
export const MDD_CHAT_SECTION_DEFAULT = 3;

const SECTION_SHORT_LABELS: Record<number, string> = {
  1: "Contexto",
  2: "Arquitectura y Stack",
  3: "Modelo de Datos",
  4: "Contratos de API",
  5: "Lógica y Edge Cases",
  6: "Seguridad",
  7: "Infraestructura",
};

function sectionFromSlashCommand(msg: string): number | null {
  const t = msg.trim().toLowerCase();
  if (!t.startsWith("/") || t.includes(" ")) return null;
  const slug = t.slice(1);
  if (!slug) return null;
  const cmd = MDD_SECTION_SLUGS.find((c) => c.slug === slug || String(c.section) === slug);
  return cmd?.section ?? null;
}

function sectionFromExplicitNumber(msg: string): number | null {
  const m = msg.trim().match(REGENERATE_SECTION_N_PATTERN);
  if (!m) return null;
  const section = parseInt(m[1]!, 10);
  return section >= 1 && section <= 7 ? section : null;
}

function sectionFromKeywords(msg: string): number | null {
  for (const { pattern, section } of SECTION_KEYWORD_RULES) {
    if (pattern.test(msg)) return section;
  }
  return null;
}

/** Infiere §1–§7 desde el mensaje de edición; default software_architect → §3. */
export function inferMddSectionFromEditMessage(msg: string): number {
  return (
    sectionFromSlashCommand(msg) ??
    sectionFromExplicitNumber(msg) ??
    sectionFromKeywords(msg) ??
    MDD_CHAT_SECTION_DEFAULT
  );
}

export function mddSectionShortLabel(section: number): string {
  return SECTION_SHORT_LABELS[section] ?? `§${section}`;
}

/** Respuesta tier C en chat cuando se delega a job de sección. */
export function buildMddSectionDelegateAssistantMessage(section: number, jobId: string): string {
  const label = mddSectionShortLabel(section);
  return `Regenerando §${section} (${label})…\n\n<!--mdd-job:${jobId}-->`;
}

export function extractMddJobIdFromAssistantMessage(content: string): string | null {
  const m = content.match(/<!--mdd-job:([a-f0-9-]+)-->/i);
  return m?.[1] ?? null;
}
