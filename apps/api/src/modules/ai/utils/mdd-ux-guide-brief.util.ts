/** Presupuesto máximo del resumen MDD enviado al LLM de Design System. */
export const UX_GUIDE_MDD_BRIEF_MAX = 8_000;

const SECTION_S1 = /^##\s*(?:1\.\s*)?contexto/im;
const SECTION_S2 = /^##\s*(?:2\.\s*)?(?:arquitectura(?:\s+y\s+stack)?|stack)/im;
const SECTION_S3 = /^##\s*(?:3\.\s*)?(?:modelo\s+de\s+datos|datos)/im;
const SECTION_S5 =
  /^##\s*(?:5\.\s*)?(?:l[oó]gica\s+y\s+edge\s+cases|l[oó]gica\b|edge\s+cases)/im;
const SECTION_S6 = /^##\s*(?:6\.\s*)?seguridad/im;

const UI_STACK_LINE =
  /react|vue|angular|svelte|next\.?js|vite|tailwind|shadcn|mui|chakra|radix|mobile|responsive|pwa|spa|frontend|flutter|ionic|design\s*system|componente/i;

const SKIP_ENTITY = new Set([
  "id",
  "uuid",
  "created_at",
  "updated_at",
  "deleted_at",
  "string",
  "number",
  "boolean",
  "json",
  "text",
  "int",
  "varchar",
]);

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…`;
}

/** Extrae el cuerpo de la primera sección cuyo título coincide con pattern (hasta el siguiente ##). */
function extractSection(md: string, pattern: RegExp): string {
  const content = (md || "").trim();
  const m = content.match(pattern);
  if (!m) return "";
  const start = m.index ?? 0;
  const afterTitle = start + (m[0]?.length ?? 0);
  const rest = content.slice(afterTitle);
  const nextH2 = rest.match(/\n##\s/m);
  const end = nextH2 ? nextH2.index! + 1 : rest.length;
  return rest.slice(0, end).trim();
}

function extractUiStackLines(section2: string): string {
  const lines = section2.split("\n").map((l) => l.trim()).filter(Boolean);
  const matched = lines.filter((l) => UI_STACK_LINE.test(l));
  if (matched.length >= 2) return matched.join("\n");
  return truncate(section2, 1_200);
}

function extractEntityNames(section3: string): string[] {
  const names = new Set<string>();
  const patterns: RegExp[] = [
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi,
    /^###\s+(\w[\w-]*)/gim,
    /^\s*[-*]\s+\*\*(\w[\w-]*)\*\*/gim,
    /^\s*[-*]\s+`(\w[\w-]*)`/gim,
    /\b(\w+)\s*\{\s*$/gim,
  ];
  for (const re of patterns) {
    for (const m of section3.matchAll(re)) {
      const n = (m[1] ?? "").trim();
      if (n.length < 2 || SKIP_ENTITY.has(n.toLowerCase())) continue;
      names.add(n);
    }
  }
  return [...names].slice(0, 40);
}

function scanDesignSignals(mdd: string): string {
  const lines: string[] = [];
  const lower = mdd.toLowerCase();

  if (/\bb2b\b/.test(lower)) lines.push("- Público: B2B (empresas / profesionales)");
  else if (/\bb2c\b/.test(lower)) lines.push("- Público: B2C (consumidor final)");

  if (/wcag|accesibilidad|a11y|contraste\s*(?:aa|aaa)/i.test(mdd)) {
    lines.push("- Accesibilidad: requisitos explícitos (WCAG / contraste)");
  }
  if (/móvil|mobile|responsive|tablet|pwa/i.test(mdd)) {
    lines.push("- Plataforma: web responsive / móvil mencionado");
  }
  if (/dashboard|tabla|dense|densidad|analytics|reporte/i.test(mdd)) {
    lines.push("- Complejidad de datos: vistas densas / dashboards");
  }
  if (/marca|brand|identidad\s+visual|paleta|tipograf/i.test(mdd)) {
    lines.push("- Marca: menciones explícitas de identidad visual");
  }

  const hexColors = [...mdd.matchAll(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)]
    .map((m) => `#${m[1]}`)
    .slice(0, 6);
  if (hexColors.length) {
    lines.push(`- Colores hex en MDD: ${hexColors.join(", ")}`);
  }

  return lines.join("\n");
}

export interface MddUxGuideBriefOptions {
  maxChars?: number;
}

/**
 * Resumen del MDD con señales suficientes para inferir un design system (personalidad,
 * dominio, stack UI, entidades, flujos UX) sin enviar el documento íntegro al LLM.
 */
export function buildMddContextForUxGuide(
  mddContent: string,
  options?: MddUxGuideBriefOptions,
): string {
  const mdd = (mddContent ?? "").trim();
  if (!mdd) return "";

  const max = options?.maxChars ?? UX_GUIDE_MDD_BRIEF_MAX;
  if (mdd.length <= max && mdd.startsWith("# Resumen MDD para inferencia de Design System")) {
    return mdd;
  }

  const s1 = extractSection(mdd, SECTION_S1);
  const s2 = extractSection(mdd, SECTION_S2);
  const s3 = extractSection(mdd, SECTION_S3);
  const s5 = extractSection(mdd, SECTION_S5);
  const s6 = extractSection(mdd, SECTION_S6);

  const parts: string[] = [
    "# Resumen MDD para inferencia de Design System",
    "Extraído del MDD completo. Usa Blueprint y documentos SDD del system prompt para inventario de pantallas y flujos detallados.",
  ];

  if (s1) {
    parts.push(`## Producto, dominio y usuarios (MDD §1)\n${truncate(s1, 2_800)}`);
  } else {
    parts.push(`## Producto y dominio (extracto inicial)\n${truncate(mdd, 1_500)}`);
  }

  if (s2) {
    parts.push(
      `## Stack y arquitectura UI-relevante (MDD §2)\n${extractUiStackLines(s2)}`,
    );
  }

  const entities = extractEntityNames(s3);
  if (entities.length) {
    parts.push(
      `## Entidades de dominio (MDD §3 — nombres)\n${entities.map((e) => `- ${e}`).join("\n")}`,
    );
  } else if (s3) {
    parts.push(`## Modelo de datos (extracto §3)\n${truncate(s3, 800)}`);
  }

  if (s5) {
    parts.push(
      `## Flujos, estados y reglas UX-relevantes (MDD §5)\n${truncate(s5, 2_000)}`,
    );
  }

  if (s6 && /mfa|login|auth|rol|permiso|sesión|session|oauth/i.test(s6)) {
    parts.push(`## Seguridad con impacto UI (MDD §6)\n${truncate(s6, 600)}`);
  }

  const signals = scanDesignSignals(mdd);
  if (signals) {
    parts.push(`## Señales explícitas detectadas\n${signals}`);
  }

  let brief = parts.join("\n\n").trim();
  if (brief.length > max) brief = `${brief.slice(0, max)}\n…`;
  return brief;
}
