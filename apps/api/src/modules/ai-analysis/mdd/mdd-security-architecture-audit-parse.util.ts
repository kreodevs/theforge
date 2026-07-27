import { extractFirstJsonObject } from "../utils/parse-json.js";
import {
  formatNoEvaluadoEntryForDisplay,
  formatSecurityAuditCoberturaUiLine,
  computeSecurityAuditCoberturaUiBreakdown,
  SERVER_FILLED_NO_EVALUADO_JUSTIFICATION,
} from "@theforge/shared-types/mdd-security-audit-display";
import {
  getCatalogIdsForFamily,
  MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_CHARS,
  MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_HALLAZGOS,
  MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE,
  SECURITY_ARCHITECTURE_AUDIT_FAMILIES,
  SECURITY_ARCHITECTURE_AUDIT_MIN_ACCOUNTED_RATIO,
} from "./mdd-security-architecture-audit-catalog.js";
import {
  securityArchitectureAuditStructuredSchema,
  type SecurityArchitectureAuditHallazgo,
  type SecurityArchitectureAuditStructured,
} from "./mdd-security-architecture-audit.types.js";

export {
  MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_CHARS,
  MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_HALLAZGOS,
  MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS,
  SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE,
  SECURITY_ARCHITECTURE_AUDIT_FAMILIES,
  SECURITY_ARCHITECTURE_AUDIT_MIN_ACCOUNTED_RATIO,
};

const SEVERITY_ORDER = ["BLOQUEANTE", "ALTO", "MEDIO", "BAJO"] as const;

/** Entradas `no_evaluado` generadas por chunks locales — no cuentan en merge ni cobertura. */
const FRAGMENT_NO_EVALUADO_PATTERNS = [
  /no hay contenido en este fragmento/i,
  /no se menciona .+ en este fragmento/i,
  /fuera de (este )?fragmento/i,
  /solo con este fragmento/i,
  /no evaluable(s)? solo con este fragmento/i,
  /no visible en (este )?fragmento/i,
  /sin evidencia en (este )?fragmento/i,
  /no aplica a este fragmento/i,
];

const NO_APLICA_PATTERNS = [
  /\bno[_\s-]?aplica\b/i,
  /\bNO_APLICA\b/,
  /\bN\/A\b/,
  /no corresponde al dominio/i,
  /sistema no maneja/i,
];

export interface MddSecurityAuditChunk {
  sectionTitle: string;
  content: string;
}

export interface ParsedSecurityArchitectureAudit {
  markdownReport: string;
  structured: SecurityArchitectureAuditStructured | null;
  veredicto?: string;
  ordenResolucion?: string;
}

export interface CoverageGateResult {
  ok: boolean;
  reason?: string;
}

export interface AnalyticalDepthGateResult {
  needsRetry: boolean;
  lowCoverageWarning: boolean;
  reason?: string;
}

/** Warning en response API cuando el modelo devolvió pocos hallazgos en MDD extenso. */
export const SECURITY_AUDIT_LOW_COVERAGE_WARNING = "cobertura_analitica_baja";

/** Extrae el bloque JSON §8.3, veredicto y §8.4 del informe markdown. */
export function parseSecurityArchitectureAuditResponse(raw: string): ParsedSecurityArchitectureAudit {
  const trimmed = raw.trim();
  const jsonText = extractFirstJsonObject(trimmed);
  let structured: SecurityArchitectureAuditStructured | null = null;

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      structured = securityArchitectureAuditStructuredSchema.parse(parsed);
    } catch {
      structured = null;
    }
  }

  const veredicto =
    structured?.veredicto?.trim() ||
    extractVeredictoFromMarkdown(trimmed) ||
    undefined;

  const ordenResolucion = extractOrdenResolucionFromMarkdown(trimmed);

  return {
    markdownReport: trimmed,
    structured,
    veredicto,
    ordenResolucion,
  };
}

/** Parte el MDD por encabezados `##` de nivel superior. */
export function splitMddForSecurityAudit(mddContent: string): MddSecurityAuditChunk[] {
  const trimmed = mddContent.trim();
  if (!trimmed) return [];

  const headingRe = /^##\s+(.+)$/gm;
  const matches = [...trimmed.matchAll(headingRe)];
  if (matches.length === 0) {
    return [{ sectionTitle: "Documento completo", content: trimmed }];
  }

  const chunks: MddSecurityAuditChunk[] = [];
  const preambleEnd = matches[0].index ?? 0;
  if (preambleEnd > 0) {
    const preamble = trimmed.slice(0, preambleEnd).trim();
    if (preamble.length > 0) {
      chunks.push({ sectionTitle: "Preámbulo", content: preamble });
    }
  }

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = match.index ?? 0;
    const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? trimmed.length) : trimmed.length;
    const block = trimmed.slice(start, nextStart).trim();
    const title = match[1]?.trim() || `Sección ${i + 1}`;
    if (block.length > 0) {
      chunks.push({ sectionTitle: title, content: block });
    }
  }

  return chunks.length > 0 ? chunks : [{ sectionTitle: "Documento completo", content: trimmed }];
}

export function isFragmentScopedNoEvaluadoEntry(entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return true;
  return FRAGMENT_NO_EVALUADO_PATTERNS.some((re) => re.test(trimmed));
}

export function isNoAplicaNoEvaluadoEntry(entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  return NO_APLICA_PATTERNS.some((re) => re.test(trimmed));
}

export function filterGlobalNoEvaluadoEntries(entries: string[]): string[] {
  return entries
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && !isFragmentScopedNoEvaluadoEntry(e));
}

const E06_HEDGING_PATTERNS = [
  /\bpodr[ií]an\b/i,
  /\bpodr[ií]a\b/i,
  /\bsi se (usa|utiliza|emplea)\b/i,
  /\bhipot[eé]tic/i,
  /\bcontrafactual/i,
  /\basumiendo\b/i,
  /\ben caso de\b/i,
  /\bser[ií]a posible\b/i,
];

const E06_POSITIVE_HS256_PATTERNS = [
  /\bHS256\b/i,
  /\bHMAC\b/i,
  /firma\s+sim[eé]trica/i,
  /algoritmo\s+sim[eé]trico/i,
  /\busa(?:r)?\s+HS256\b/i,
  /\bcon\s+HS256\b/i,
  /\bemplea\s+HS256\b/i,
];

const E06_ASYMMETRIC_DECLARED_PATTERNS = [
  /\bRS256\b/i,
  /\bRS384\b/i,
  /\bRS512\b/i,
  /\bES256\b/i,
  /\bES384\b/i,
  /\basim[eé]tric/i,
  /clave\s+p[uú]blica/i,
  /par\s+de\s+claves/i,
];

type E06HypotheticalAction = "keep" | "drop" | "downgrade";

const E06_AFFIRMATIVE_HS256_PATTERNS = [
  /\b(?:especifica|declara|define|implementa|usa|utiliza|emplea)\b[^.]{0,60}\bHS256\b/i,
  /\bHS256\b[^.]{0,50}\b(?:compartido|entre\s+\d+|réplicas|instancias|verificador)/i,
  /\balgoritmo\s+HS256\b/i,
  /\bHMAC\b[^.]{0,40}\b(?:secreto|compartido|réplicas)/i,
];

function mentionsHs256OrHmac(blob: string): boolean {
  return (
    /\bHS256\b/i.test(blob) ||
    /\bHMAC\b/i.test(blob) ||
    /firma\s+sim[eé]trica/i.test(blob)
  );
}

function hasAffirmativeHs256Evidence(blob: string): boolean {
  const segments = blob.split(/[.;]\s*/).map((s) => s.trim()).filter(Boolean);
  for (const segment of segments) {
    if (!mentionsHs256OrHmac(segment)) continue;
    if (E06_HEDGING_PATTERNS.some((re) => re.test(segment))) continue;
    if (
      E06_AFFIRMATIVE_HS256_PATTERNS.some((re) => re.test(segment)) ||
      E06_POSITIVE_HS256_PATTERNS.some((re) => re.test(segment))
    ) {
      return true;
    }
  }
  return false;
}

function evaluateE06HypotheticalAction(h: SecurityArchitectureAuditHallazgo): E06HypotheticalAction {
  if (h.verificacion?.trim().toUpperCase() !== "E06") return "keep";

  const blob = [h.titulo, h.evidencia, h.consecuencia, h.criterio_cierre]
    .filter(Boolean)
    .join(" ");
  const hasHedging = E06_HEDGING_PATTERNS.some((re) => re.test(blob));
  if (!hasHedging) return "keep";

  const hasPositiveHs256 = hasAffirmativeHs256Evidence(blob);
  const declaresAsymmetric = E06_ASYMMETRIC_DECLARED_PATTERNS.some((re) => re.test(blob));
  const mentionsHs256 = mentionsHs256OrHmac(blob);

  if (declaresAsymmetric && !hasPositiveHs256) return "drop";
  if (!mentionsHs256) return "drop";
  if (!hasPositiveHs256) return "downgrade";
  return "keep";
}

/**
 * Elimina o degrada hallazgos E06 basados en hipótesis (p. ej. HS256 cuando el doc declara RS256).
 */
export function filterHypotheticalE06Hallazgos(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): SecurityArchitectureAuditHallazgo[] {
  return hallazgos.flatMap((h) => {
    const action = evaluateE06HypotheticalAction(h);
    if (action === "drop") return [];
    if (action === "downgrade") {
      const sev = (h.severidad ?? "").toUpperCase();
      if (sev === "BLOQUEANTE") {
        return [{ ...h, severidad: "ALTO" }];
      }
    }
    return [h];
  });
}

/** C03 inmutabilidad sin mecanismo de motor → BLOQUEANTE (catálogo §C). */
export function applySecurityArchitectureSeverityUpgrades(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): SecurityArchitectureAuditHallazgo[] {
  return hallazgos.map((h) => {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver !== "C03") return h;
    const sev = (h.severidad ?? "").toUpperCase();
    if (sev === "BLOQUEANTE") return h;
    const blob = [h.titulo, h.evidencia, h.consecuencia, h.criterio_cierre]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const aboutImmutability = /inmutab|immutable|append.?only|auditor[ií]a/.test(blob);
    const lacksMotor =
      /sin mecanismo|no.*motor|solo convenci|no fuerza|ausente.*revoke|ausente.*trigger|ausente.*rule/i.test(
        blob,
      ) || aboutImmutability;
    if (lacksMotor) {
      return { ...h, severidad: "BLOQUEANTE" };
    }
    return h;
  });
}

export function buildMddTableOfContents(mddContent: string): string {
  const titles = splitMddForSecurityAudit(mddContent).map(
    (c) => `- ${c.sectionTitle} (${c.content.length} chars)`,
  );
  return titles.length > 0 ? titles.join("\n") : "- Documento sin secciones ## detectadas";
}

export function collectIdsVistosFromStructured(
  structured: Pick<SecurityArchitectureAuditStructured, "ids_vistos" | "hallazgos">,
): Set<string> {
  const out = new Set<string>();
  for (const id of structured.ids_vistos ?? []) {
    const normalized = id.trim().toUpperCase();
    if (SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(normalized)) {
      out.add(normalized);
    }
  }
  for (const h of structured.hallazgos ?? []) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
      out.add(ver);
    }
  }
  return out;
}

export function computeUnaccountedCatalogIds(
  hallazgos: SecurityArchitectureAuditHallazgo[],
  idsVistos: Iterable<string>,
): string[] {
  const accounted = new Set<string>(idsVistos);
  for (const h of hallazgos) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
      accounted.add(ver);
    }
  }
  return SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter((id) => !accounted.has(id));
}

export {
  SERVER_FILLED_NO_EVALUADO_JUSTIFICATION,
} from "@theforge/shared-types/mdd-security-audit-display";

/**
 * IDs del catálogo A–G ausentes en hallazgos y no_evaluado.
 * Nunca infiere PASS: omisión = hueco a rellenar.
 */
export function computeMissingCatalogIds(
  structured: Pick<SecurityArchitectureAuditStructured, "hallazgos" | "no_evaluado">,
): string[] {
  const accounted = new Set<string>();

  for (const h of structured.hallazgos ?? []) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
      accounted.add(ver);
    }
  }

  for (const entry of filterGlobalNoEvaluadoEntries(structured.no_evaluado ?? [])) {
    const id = extractCatalogIdFromNoEvaluado(entry);
    if (id) accounted.add(id);
  }

  return SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.filter((id) => !accounted.has(id));
}

/** Entradas no_evaluado para IDs faltantes (N/A conservador, nunca PASS automático). */
export function fillMissingCatalogCoverage(
  structured: Pick<SecurityArchitectureAuditStructured, "hallazgos" | "no_evaluado">,
): string[] {
  return computeMissingCatalogIds(structured).map(
    (id) => `${id} — ${SERVER_FILLED_NO_EVALUADO_JUSTIFICATION}`,
  );
}

export function buildSecurityArchitectureCatalogUserSection(): string {
  return [
    "## Catálogo obligatorio A–G (88 verificaciones)",
    "Todo ID debe aparecer en `hallazgos[].verificacion` (brecha) O en `no_evaluado` con formato `ID — razón`.",
    "No omitas ninguno; prohibido cerrar el informe sin contabilizar los 88 IDs.",
    "",
    SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.join(", "),
  ].join("\n");
}

export const SECURITY_ARCHITECTURE_AUDIT_FAMILY_USER_INSTRUCTIONS = [
  "Modo EXTRACCIÓN POR FAMILIA — no emitas informe §8 completo ni veredicto global.",
  "Solo reporta hallazgos y no_evaluado de la familia indicada en este mensaje.",
  "Reglas:",
  "1. `hallazgos`: brechas con evidencia literal del documento; `verificacion` = ID de catálogo de ESTA familia.",
  "2. `no_evaluado`: cada ID de esta familia sin brecha debe aparecer como `ID — razón` (PASA o NO_APLICA con justificación).",
  "3. Un hallazgo por verificación — PROHIBIDO mezclar IDs (p. ej. no citar C03 dentro de un hallazgo A01).",
  "4. PROHIBIDO declarar IDs de otras familias.",
  "5. PROHIBIDO emitir `veredicto`, `cobertura` global, `resumen` global u `orden_resolucion`.",
  "",
  "Devuelve un bloque JSON §8.3 mínimo con: documento, version_auditada, hallazgos, no_evaluado, supuestos (opcional).",
].join("\n");

export function buildFamilySecurityAuditUserMessage(input: {
  family: string;
  mddContent: string;
  auditedAt: string;
  reinforcement?: boolean;
  priorReason?: string;
  depthReinforcement?: boolean;
}): string {
  const family = input.family.trim().toUpperCase();
  const familyIds = getCatalogIdsForFamily(family);
  const firstId = familyIds[0] ?? `${family}01`;
  const lastId = familyIds[familyIds.length - 1] ?? `${family}99`;

  const parts = [
    SECURITY_ARCHITECTURE_AUDIT_FAMILY_USER_INSTRUCTIONS,
    "",
    `## Familia ${family} — verificaciones ${firstId}–${lastId} (${familyIds.length} IDs)`,
    "Evalúa TODOS estos IDs contra el documento completo:",
    familyIds.join(", "),
    "",
    buildMddTableOfContents(input.mddContent),
    "",
    "Documento a auditar (Master Design Document):",
    "",
    input.mddContent,
    "",
    `Usa exactamente esta fecha_auditoria si la incluyes: "${input.auditedAt}" (la consolidación final fijará la fecha).`,
  ];

  if (input.reinforcement) {
    parts.push(SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX);
    if (input.priorReason?.trim()) {
      parts.push("", `Motivo del reintento: ${input.priorReason.trim()}`);
    }
  }

  if (input.depthReinforcement) {
    parts.push(SECURITY_ARCHITECTURE_AUDIT_DEPTH_REINFORCEMENT_USER_SUFFIX);
  }

  return parts.join("\n");
}

export function buildSingleShotSecurityAuditUserMessage(input: {
  mddContent: string;
  auditedAt: string;
  reinforcement?: boolean;
  priorReason?: string;
  depthReinforcement?: boolean;
}): string {
  const parts = [
    buildSecurityArchitectureCatalogUserSection(),
    "",
    "Documento a auditar (Master Design Document):",
    "",
    input.mddContent,
    "",
    `Usa exactamente esta fecha_auditoria en el JSON §8.3: "${input.auditedAt}" (no inventes otras fechas).`,
  ];

  if (input.reinforcement) {
    parts.push(SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX);
    if (input.priorReason?.trim()) {
      parts.push("", `Motivo del reintento: ${input.priorReason.trim()}`);
    }
  }

  if (input.depthReinforcement) {
    parts.push(SECURITY_ARCHITECTURE_AUDIT_DEPTH_REINFORCEMENT_USER_SUFFIX);
  }

  return parts.join("\n");
}

export interface ChunkExtractionMerge {
  hallazgos: SecurityArchitectureAuditHallazgo[];
  idsVistos: string[];
  supuestos: string[];
  documento?: string;
  versionAuditada?: string;
}

/** Fusiona extracciones parciales de chunks (sin veredicto/cobertura/no_evaluado/orden). */
export function mergeSecurityArchitectureChunkExtractions(
  partials: SecurityArchitectureAuditStructured[],
): ChunkExtractionMerge {
  const allHallazgos: SecurityArchitectureAuditHallazgo[] = [];
  const idsVistos = new Set<string>();
  const supuestos: string[] = [];
  let documento = "";
  let versionAuditada = "";

  for (const p of partials) {
    allHallazgos.push(...(p.hallazgos ?? []));
    for (const id of collectIdsVistosFromStructured(p)) {
      idsVistos.add(id);
    }
    supuestos.push(...(p.supuestos ?? []));
    if (!documento && p.documento?.trim()) documento = p.documento.trim();
    if (!versionAuditada && p.version_auditada?.trim()) {
      versionAuditada = p.version_auditada.trim();
    }
  }

  const hallazgos = applySecurityArchitectureSeverityUpgrades(
    dedupeSecurityArchitectureHallazgos(
      filterHypotheticalE06Hallazgos(allHallazgos),
    ),
  );

  return {
    hallazgos,
    idsVistos: [...idsVistos].sort(),
    supuestos: [...new Set(supuestos.map((s) => s.trim()).filter(Boolean))],
    documento: documento || undefined,
    versionAuditada: versionAuditada || undefined,
  };
}

export function shouldUseChunkedSecurityAudit(mddContent: string): boolean {
  return mddContent.trim().length > MDD_SECURITY_AUDIT_SINGLE_SHOT_MAX_CHARS;
}

export const SECURITY_ARCHITECTURE_AUDIT_CHUNK_USER_INSTRUCTIONS = [
  "Modo EXTRACCIÓN POR FRAGMENTO — no emitas informe §8 completo ni veredicto global.",
  "Solo reporta:",
  "1. `hallazgos`: brechas con evidencia literal EN este fragmento (campo `verificacion` = ID catálogo si aplica).",
  "2. `ids_vistos`: lista de IDs A01–G08 para los que este fragmento aporta evidencia suficiente para evaluar (pase o falla).",
  "3. `supuestos` opcionales locales.",
  "PROHIBIDO:",
  "- Declarar `no_evaluado` por IDs ausentes en este fragmento.",
  "- Emitir `veredicto`, `cobertura`, `resumen` global u `orden_resolucion`.",
  "- Inventar hallazgos sin cita en el fragmento.",
  "",
  "Devuelve un bloque JSON §8.3 mínimo con: documento, version_auditada, hallazgos, ids_vistos, supuestos.",
].join("\n");

export function buildSecurityArchitectureSynthesisUserMessage(input: {
  mddContent: string;
  auditedAt: string;
  extraction: ChunkExtractionMerge;
  reinforcement?: boolean;
  priorReason?: string;
}): string {
  const unaccounted = computeUnaccountedCatalogIds(
    input.extraction.hallazgos,
    input.extraction.idsVistos,
  );
  const toc = buildMddTableOfContents(input.mddContent);
  const parts = [
    buildSecurityArchitectureCatalogUserSection(),
    "",
    "Consolida la auditoría de seguridad y arquitectura a partir de hallazgos extraídos por fragmentos.",
    "Produce el informe final §8 completo (veredicto, cobertura real, hallazgos deduplicados, no_evaluado global, orden_resolucion único).",
    "Evalúa los IDs faltantes contra el documento completo. Prohibido `no_evaluado` con excusas de fragmento.",
    "Invariante cobertura: ejecutadas = pasa + falla + no_aplica (= 88 cuando el catálogo está completo).",
    "",
    `Usa exactamente esta fecha_auditoria en el JSON §8.3: "${input.auditedAt}" (no inventes otras fechas).`,
    "",
    "## Hallazgos candidatos (merge determinístico)",
    "```json",
    JSON.stringify(
      {
        documento: input.extraction.documento,
        version_auditada: input.extraction.versionAuditada,
        hallazgos: input.extraction.hallazgos,
        ids_vistos: input.extraction.idsVistos,
        supuestos: input.extraction.supuestos,
      },
      null,
      2,
    ),
    "```",
    "",
    `## IDs del catálogo A–G sin evidencia en ningún fragmento (${unaccounted.length})`,
    unaccounted.length > 0 ? unaccounted.join(", ") : "_ninguno_",
    "",
    "## Índice del MDD (secciones)",
    toc,
    "",
    "## Documento completo (referencia para evaluar IDs faltantes y no_evaluado global)",
    "",
    input.mddContent,
  ];

  if (input.reinforcement) {
    parts.push(SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX);
    if (input.priorReason?.trim()) {
      parts.push("", `Motivo del reintento: ${input.priorReason.trim()}`);
    }
  }

  return parts.join("\n");
}

function hallazgoDedupeKey(h: SecurityArchitectureAuditHallazgo): string {
  const ver = h.verificacion?.trim().toUpperCase();
  if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
    return `ver:${ver}`;
  }
  const id = h.id?.trim();
  if (id) return `id:${id.toUpperCase()}`;
  const titulo = h.titulo?.trim().toLowerCase() ?? "";
  const ubic = h.ubicacion?.trim().toLowerCase() ?? "";
  return `fallback:${titulo}|${ubic}`;
}

function hallazgoEvidenceScore(h: SecurityArchitectureAuditHallazgo): number {
  return [h.titulo, h.evidencia, h.consecuencia, h.criterio_cierre, h.ubicacion]
    .filter(Boolean)
    .join(" ").length;
}

function shouldPreferHallazgo(
  candidate: SecurityArchitectureAuditHallazgo,
  existing: SecurityArchitectureAuditHallazgo,
): boolean {
  const candRank = severityRank(candidate.severidad);
  const existRank = severityRank(existing.severidad);
  if (candRank !== existRank) return candRank > existRank;
  return hallazgoEvidenceScore(candidate) > hallazgoEvidenceScore(existing);
}

/** Dedupe hallazgos por verificacion de catálogo (un ID → un hallazgo), luego por id GAP. */
export function dedupeSecurityArchitectureHallazgos(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): SecurityArchitectureAuditHallazgo[] {
  const byKey = new Map<string, SecurityArchitectureAuditHallazgo>();
  for (const h of hallazgos) {
    const key = hallazgoDedupeKey(h);
    const existing = byKey.get(key);
    if (!existing || shouldPreferHallazgo(h, existing)) {
      byKey.set(key, h);
    }
  }
  return sortHallazgosBySeverity([...byKey.values()]);
}

function severityRank(sev: string | undefined): number {
  const idx = SEVERITY_ORDER.indexOf(
    (sev ?? "").toUpperCase() as (typeof SEVERITY_ORDER)[number],
  );
  return idx >= 0 ? SEVERITY_ORDER.length - idx : 0;
}

function sortHallazgosBySeverity(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): SecurityArchitectureAuditHallazgo[] {
  return [...hallazgos].sort((a, b) => severityRank(b.severidad) - severityRank(a.severidad));
}

export function recalcSecurityArchitectureResumen(
  hallazgos: SecurityArchitectureAuditHallazgo[],
): NonNullable<SecurityArchitectureAuditStructured["resumen"]> {
  const resumen = { bloqueante: 0, alto: 0, medio: 0, bajo: 0 };
  for (const h of hallazgos) {
    const sev = (h.severidad ?? "").toUpperCase();
    if (sev === "BLOQUEANTE") resumen.bloqueante += 1;
    else if (sev === "ALTO") resumen.alto += 1;
    else if (sev === "MEDIO") resumen.medio += 1;
    else if (sev === "BAJO") resumen.bajo += 1;
  }
  return resumen;
}

/**
 * Cobertura del catálogo (88 IDs). Semántica conservadora:
 * - FAIL → ID en hallazgos con verificacion de catálogo
 * - N/A → ID en no_evaluado (incluye relleno server-side)
 * - PASS → solo IDs restantes tras contabilizar FAIL + N/A (nunca por omisión del modelo)
 * Invariante: ejecutadas = pasa + falla + no_aplica (= 88 cuando el catálogo está completo).
 */
export function recalcSecurityArchitectureCobertura(
  structured: Pick<SecurityArchitectureAuditStructured, "hallazgos" | "no_evaluado">,
): NonNullable<SecurityArchitectureAuditStructured["cobertura"]> {
  const fallaIds = new Set<string>();
  for (const h of structured.hallazgos ?? []) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
      fallaIds.add(ver);
    }
  }

  const noAplicaIds = new Set<string>();
  for (const entry of filterGlobalNoEvaluadoEntries(structured.no_evaluado ?? [])) {
    const id = extractCatalogIdFromNoEvaluado(entry);
    if (!id || fallaIds.has(id)) continue;
    noAplicaIds.add(id);
  }

  const falla = fallaIds.size;
  const no_aplica = noAplicaIds.size;
  const accountedIds = new Set([...fallaIds, ...noAplicaIds]);
  const catalogComplete = accountedIds.size === SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE;
  const pasa = catalogComplete
    ? Math.max(0, SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE - falla - no_aplica)
    : 0;
  const ejecutadas = catalogComplete
    ? SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE
    : falla + no_aplica;

  return {
    ejecutadas,
    pasa,
    falla,
    no_aplica,
  };
}

export function isSecurityArchitectureCoberturaCoherent(
  cobertura: NonNullable<SecurityArchitectureAuditStructured["cobertura"]>,
): boolean {
  const ejecutadas = cobertura.ejecutadas ?? 0;
  const pasa = cobertura.pasa ?? 0;
  const falla = cobertura.falla ?? 0;
  const no_aplica = cobertura.no_aplica ?? 0;
  return ejecutadas === pasa + falla + no_aplica;
}

export function countAccountedCatalogVerifications(
  structured: Pick<SecurityArchitectureAuditStructured, "hallazgos" | "no_evaluado">,
): number {
  const accounted = new Set<string>();

  for (const h of structured.hallazgos ?? []) {
    const ver = h.verificacion?.trim().toUpperCase();
    if (ver && SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(ver)) {
      accounted.add(ver);
    }
  }

  for (const entry of filterGlobalNoEvaluadoEntries(structured.no_evaluado ?? [])) {
    const id = extractCatalogIdFromNoEvaluado(entry);
    if (id) accounted.add(id);
  }

  return accounted.size;
}

function extractCatalogIdFromNoEvaluado(entry: string): string | null {
  const match = entry.trim().match(/^([A-G]\d{2})\b/i);
  if (!match?.[1]) return null;
  const id = match[1].toUpperCase();
  return SECURITY_ARCHITECTURE_AUDIT_CATALOG_IDS.includes(id) ? id : null;
}

export function computeSecurityArchitectureVeredicto(
  resumen: NonNullable<SecurityArchitectureAuditStructured["resumen"]>,
): string {
  if ((resumen.bloqueante ?? 0) > 0) return "NO_APTO";
  if ((resumen.alto ?? 0) > 0) return "APTO_CON_CONDICIONES";
  return "APTO";
}

export function veredictoToGateLabel(veredicto: string): string {
  const v = veredicto.toUpperCase().replace(/\s+/g, "_");
  if (v.includes("NO_APTO")) return "NO APTO PARA IMPLEMENTACIÓN";
  if (v.includes("CONDICIONES")) return "APTO CON CONDICIONES";
  return "APTO";
}

/** Fusiona structured finales (p. ej. reintento) — no usar para chunks sin síntesis. */
export function mergeSecurityArchitectureAuditStructured(
  partials: SecurityArchitectureAuditStructured[],
): SecurityArchitectureAuditStructured {
  const extraction = mergeSecurityArchitectureChunkExtractions(partials);
  const noEvaluado = filterGlobalNoEvaluadoEntries(
    partials.flatMap((p) => p.no_evaluado ?? []),
  );
  const dedupedNoEvaluado = dedupeNoEvaluado(noEvaluado, extraction.hallazgos);
  const cobertura = recalcSecurityArchitectureCobertura({
    hallazgos: extraction.hallazgos,
    no_evaluado: dedupedNoEvaluado,
  });
  const resumen = recalcSecurityArchitectureResumen(extraction.hallazgos);
  const veredicto = computeSecurityArchitectureVeredicto(resumen);

  return finalizeSecurityArchitectureStructured({
    documento: extraction.documento,
    version_auditada: extraction.versionAuditada,
    veredicto,
    resumen,
    cobertura,
    hallazgos: extraction.hallazgos,
    no_evaluado: dedupedNoEvaluado,
    supuestos: extraction.supuestos,
  });
}

export function finalizeSecurityArchitectureStructured(
  structured: SecurityArchitectureAuditStructured,
): SecurityArchitectureAuditStructured {
  const filteredHallazgos = filterHypotheticalE06Hallazgos(structured.hallazgos ?? []);
  const hallazgos = applySecurityArchitectureSeverityUpgrades(
    dedupeSecurityArchitectureHallazgos(filteredHallazgos),
  );
  const modelNoEvaluado = filterGlobalNoEvaluadoEntries(structured.no_evaluado ?? []);
  const dedupedModelNoEvaluado = dedupeNoEvaluado(modelNoEvaluado, hallazgos);
  const serverFilled = fillMissingCatalogCoverage({
    hallazgos,
    no_evaluado: dedupedModelNoEvaluado,
  });
  const dedupedNoEvaluado = dedupeNoEvaluado(
    [...dedupedModelNoEvaluado, ...serverFilled],
    hallazgos,
  );
  const resumen = recalcSecurityArchitectureResumen(hallazgos);
  const cobertura = recalcSecurityArchitectureCobertura({
    hallazgos,
    no_evaluado: dedupedNoEvaluado,
  });
  const veredicto = structured.veredicto ?? computeSecurityArchitectureVeredicto(resumen);
  const { ids_vistos: _strip, ...rest } = structured;

  return {
    ...rest,
    veredicto,
    resumen,
    cobertura,
    hallazgos,
    no_evaluado: dedupedNoEvaluado,
    orden_resolucion: buildDefaultOrdenResolucion(hallazgos),
  };
}

function dedupeNoEvaluado(
  entries: string[],
  hallazgos: SecurityArchitectureAuditHallazgo[],
): string[] {
  const evaluated = new Set(
    hallazgos
      .map((h) => h.verificacion?.trim().toUpperCase())
      .filter((v): v is string => Boolean(v)),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of filterGlobalNoEvaluadoEntries(entries)) {
    const id = extractCatalogIdFromNoEvaluado(entry);
    if (id && evaluated.has(id)) continue;
    const key = id ?? entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function mergeSecurityArchitectureAuditResponses(
  parsedChunks: ParsedSecurityArchitectureAudit[],
): ParsedSecurityArchitectureAudit {
  const structuredParts = parsedChunks
    .map((p) => p.structured)
    .filter((s): s is SecurityArchitectureAuditStructured => s !== null);

  if (structuredParts.length === 0) {
    const markdownReport = parsedChunks.map((p) => p.markdownReport).join("\n\n---\n\n");
    return { markdownReport, structured: null, veredicto: undefined };
  }

  const merged = finalizeSecurityArchitectureStructured(
    mergeSecurityArchitectureAuditStructured(structuredParts),
  );

  const markdownReport = buildSecurityArchitectureAuditMarkdown(merged);
  return {
    markdownReport,
    structured: merged,
    veredicto: merged.veredicto,
    ordenResolucion: merged.orden_resolucion,
  };
}

export function applyServerAuditTimestamp(
  structured: SecurityArchitectureAuditStructured,
  auditedAt: string,
): SecurityArchitectureAuditStructured {
  return {
    ...structured,
    fecha_auditoria: auditedAt,
    auditedAt,
  };
}

/** Gate post-parse: cobertura y coherencia resumen ↔ hallazgos. */
export function validateSecurityArchitectureCoverageGate(
  structured: SecurityArchitectureAuditStructured | null,
): CoverageGateResult {
  if (!structured) {
    return { ok: false, reason: "El informe no incluye bloque JSON §8.3 válido." };
  }

  const hallazgos = structured.hallazgos ?? [];
  const resumen = recalcSecurityArchitectureResumen(hallazgos);

  const fragmentGarbage = (structured.no_evaluado ?? []).filter(isFragmentScopedNoEvaluadoEntry);
  if (fragmentGarbage.length > 0) {
    return {
      ok: false,
      reason:
        `no_evaluado contiene ${fragmentGarbage.length} entradas de fragmento local ` +
        `(p. ej. «No hay contenido en este fragmento»). Usa síntesis global.`,
    };
  }

  const accounted = countAccountedCatalogVerifications(structured);
  const minAccounted = Math.floor(
    SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE * SECURITY_ARCHITECTURE_AUDIT_MIN_ACCOUNTED_RATIO,
  );

  if (accounted < minAccounted) {
    return {
      ok: false,
      reason:
        `Cobertura insuficiente del catálogo A–G: ${accounted}/${SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE} ` +
        `verificaciones contabilizadas (mínimo ${minAccounted}). ` +
        `Declara cada ID faltante en no_evaluado con justificación.`,
    };
  }

  const declaredTotal =
    (resumen.bloqueante ?? 0) +
    (resumen.alto ?? 0) +
    (resumen.medio ?? 0) +
    (resumen.bajo ?? 0);
  if (hallazgos.length > 0 && declaredTotal !== hallazgos.length) {
    return {
      ok: false,
      reason:
        `Resumen de severidades inconsistente con hallazgos (${declaredTotal} vs ${hallazgos.length}).`,
    };
  }

  const structuredResumen = structured.resumen;
  if (structuredResumen && hallazgos.length > 0) {
    const mismatch =
      (structuredResumen.bloqueante ?? 0) !== resumen.bloqueante ||
      (structuredResumen.alto ?? 0) !== resumen.alto ||
      (structuredResumen.medio ?? 0) !== resumen.medio ||
      (structuredResumen.bajo ?? 0) !== resumen.bajo;
    if (mismatch) {
      return {
        ok: false,
        reason: "El resumen JSON no coincide con los hallazgos declarados.",
      };
    }
  }

  const cobertura = recalcSecurityArchitectureCobertura(structured);
  if (!isSecurityArchitectureCoberturaCoherent(cobertura)) {
    return {
      ok: false,
      reason:
        `Cobertura incoherente: ejecutadas=${cobertura.ejecutadas ?? 0} ` +
        `pero pasa+falla+no_aplica=${(cobertura.pasa ?? 0) + (cobertura.falla ?? 0) + (cobertura.no_aplica ?? 0)}.`,
    };
  }

  const ejecutadas = cobertura.ejecutadas ?? 0;
  if (
    ejecutadas > 0 &&
    ejecutadas < minAccounted &&
    accounted < minAccounted
  ) {
    return {
      ok: false,
      reason:
        `Cobertura reportada demasiado baja (${ejecutadas}/${SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE}).`,
    };
  }

  return { ok: true };
}

export function buildSecurityArchitectureAuditMarkdown(
  structured: SecurityArchitectureAuditStructured,
): string {
  const finalized = finalizeSecurityArchitectureStructured(structured);
  const resumen = finalized.resumen ?? recalcSecurityArchitectureResumen(finalized.hallazgos ?? []);
  const cobertura =
    finalized.cobertura ??
    recalcSecurityArchitectureCobertura(finalized);
  const coberturaUi = computeSecurityAuditCoberturaUiBreakdown({
    hallazgos: finalized.hallazgos,
    no_evaluado: finalized.no_evaluado,
    cobertura,
  });
  const veredicto = finalized.veredicto ?? computeSecurityArchitectureVeredicto(resumen);
  const gateLabel = veredictoToGateLabel(veredicto);
  const hallazgos = sortHallazgosBySeverity(finalized.hallazgos ?? []);

  const jsonForExport = { ...finalized };
  delete (jsonForExport as { ids_vistos?: string[] }).ids_vistos;

  const lines: string[] = [
    "### 8.1 Veredicto",
    "",
    "| Severidad | Cantidad |",
    "| :-- | --: |",
    `| BLOQUEANTE | ${resumen.bloqueante ?? 0} |`,
    `| ALTO | ${resumen.alto ?? 0} |`,
    `| MEDIO | ${resumen.medio ?? 0} |`,
    `| BAJO | ${resumen.bajo ?? 0} |`,
    "",
    `Verificaciones: ${formatSecurityAuditCoberturaUiLine(coberturaUi)}`,
    "",
    `**Veredicto de puerta:** \`${gateLabel}\``,
    "",
    "### 8.2 Hallazgos",
    "",
  ];

  for (const h of hallazgos) {
    const sev = (h.severidad ?? "MEDIO").toUpperCase();
    const id = h.id ?? h.verificacion ?? "GAP";
    lines.push(`### [${sev}] ${id} — ${h.titulo ?? "Sin título"}`, "");
    if (h.familia) lines.push(`**Familia:** ${h.familia}`);
    if (h.verificacion) lines.push(`**Verificación:** ${h.verificacion}`);
    if (h.ubicacion) lines.push(`**Ubicación:** ${h.ubicacion}`);
    if (h.evidencia) lines.push(`**Evidencia:** ${h.evidencia}`);
    if (h.consecuencia) lines.push(`**Consecuencia:** ${h.consecuencia}`);
    if (h.criterio_cierre) lines.push(`**Criterio de cierre:** ${h.criterio_cierre}`);
    if (h.depende_de?.length) lines.push(`**Depende de:** ${h.depende_de.join(", ")}`);
    lines.push("");
  }

  if (hallazgos.length === 0) {
    lines.push("_Sin hallazgos._", "");
  }

  const noEvaluadoDisplay = (finalized.no_evaluado ?? []).map(formatNoEvaluadoEntryForDisplay);
  if (noEvaluadoDisplay.length > 0) {
    lines.push("### 8.2.1 Verificaciones no evaluadas (N/A o pendientes)", "");
    for (const entry of noEvaluadoDisplay) {
      lines.push(`- ${entry}`);
    }
    lines.push("");
  }

  lines.push("### 8.3 Bloque de datos estructurado", "", "```json");
  lines.push(JSON.stringify(jsonForExport, null, 2));
  lines.push("```", "");

  lines.push("### 8.4 Orden de resolución recomendado", "");
  lines.push(finalized.orden_resolucion?.trim() || buildDefaultOrdenResolucion(hallazgos));

  return lines.join("\n");
}

function buildDefaultOrdenResolucion(hallazgos: SecurityArchitectureAuditHallazgo[]): string {
  if (hallazgos.length === 0) return "_N/A — sin hallazgos pendientes._";
  return hallazgos
    .map((h, i) => {
      const id = h.id ?? h.verificacion ?? `GAP-${i + 1}`;
      return `${i + 1}. **${id}** — ${h.titulo ?? "Resolver hallazgo"} (${h.severidad ?? "?"})`;
    })
    .join("\n");
}

function extractVeredictoFromMarkdown(markdown: string): string | undefined {
  const gateMatch = markdown.match(
    /veredicto de puerta[^`\n]*[`']?(NO APTO PARA IMPLEMENTACIÓN|APTO CON CONDICIONES|APTO)[`']?/i,
  );
  if (gateMatch?.[1]) return gateMatch[1].trim();

  const structuredMatch = markdown.match(
    /`?(NO_APTO|APTO_CON_CONDICIONES|APTO)`?/,
  );
  if (structuredMatch?.[1]) {
    return structuredMatch[1].replace(/_/g, " ").trim();
  }

  return undefined;
}

function extractOrdenResolucionFromMarkdown(markdown: string): string | undefined {
  const match = markdown.match(
    /###\s*8\.4\s+Orden de resolución[^\n]*\n+([\s\S]*?)(?=\n###\s*8\.|\n##\s+|\n---\s*$|$)/i,
  );
  const body = match?.[1]?.trim();
  return body && body.length > 0 ? body : undefined;
}

export const SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX = [
  "",
  "---",
  "**REFUERZO — COBERTURA INCOMPLETA**",
  `El intento anterior no cubrió el catálogo completo A–G (${SECURITY_ARCHITECTURE_AUDIT_CATALOG_SIZE} verificaciones).`,
  "Debes:",
  "1. Evaluar TODAS las verificaciones A01–G08 o declararlas en `no_evaluado` con justificación por ID.",
  "2. No emitir veredicto APTO si faltan IDs sin declarar.",
  "3. Mantener evidencia citada por hallazgo.",
  "4. Usar `fecha_auditoria` exactamente como se indica en el mensaje (no inventar fechas).",
  "5. Un hallazgo por verificación — no mezclar IDs de familias distintas en un mismo hallazgo.",
].join("\n");

export const SECURITY_ARCHITECTURE_AUDIT_DEPTH_REINFORCEMENT_USER_SUFFIX = [
  "",
  "---",
  "**REFUERZO — PROFUNDIDAD ANALÍTICA**",
  "Documento extenso de seguridad/KMS; se esperan múltiples hallazgos BLOQUEANTE/ALTO en familias B, C y E.",
  "No omitas brechas por superficialidad. Si hay DDL, cifrado y autenticación, revisa B, C y E explícitamente.",
  "Lista hallazgos concretos con evidencia citada. Un hallazgo por verificación de catálogo.",
  "Declara en `no_evaluado` solo IDs genuinamente NO_APLICA, no como atajo por pereza.",
].join("\n");

/**
 * Gate post-finalize: MDD grande con pocos hallazgos → 1 reintento; si persiste → warning.
 * No altera veredicto (sigue por severidades de hallazgos).
 */
export function evaluateAnalyticalDepthGate(input: {
  mddContentLength: number;
  hallazgosCount: number;
  afterRetry: boolean;
}): AnalyticalDepthGateResult {
  const isLargeDoc = input.mddContentLength > MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_CHARS;
  const shallow = input.hallazgosCount < MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_HALLAZGOS;

  if (!isLargeDoc || !shallow) {
    return { needsRetry: false, lowCoverageWarning: false };
  }

  const reason =
    `Documento extenso (${input.mddContentLength} caracteres) con solo ` +
    `${input.hallazgosCount} hallazgos (mínimo esperado ${MDD_SECURITY_AUDIT_DEPTH_GATE_MIN_HALLAZGOS}). ` +
    "Se esperan múltiples hallazgos BLOQUEANTE/ALTO en familias B/C/E.";

  if (!input.afterRetry) {
    return { needsRetry: true, lowCoverageWarning: false, reason };
  }

  return { needsRetry: false, lowCoverageWarning: true, reason };
}

/** Fusiona extracciones por familia A–G (hallazgos + no_evaluado del modelo). */
export function mergeSecurityArchitectureFamilyExtractions(
  partials: SecurityArchitectureAuditStructured[],
): SecurityArchitectureAuditStructured {
  return mergeSecurityArchitectureAuditStructured(partials);
}

export type SecurityAuditPassMode = "single-shot" | "family-multi-pass" | "chunked";

/** Modo de auditoría: 1-shot (barato), multi-pase A–G (deepAudit) o chunk+síntesis (>100k). */
export function resolveSecurityAuditPassMode(
  mddContent: string,
  deepAudit?: boolean,
): SecurityAuditPassMode {
  if (shouldUseChunkedSecurityAudit(mddContent)) return "chunked";
  if (deepAudit) return "family-multi-pass";
  return "single-shot";
}

export function shouldUseFamilyMultiPassSecurityAudit(
  mddContent: string,
  deepAudit?: boolean,
): boolean {
  return resolveSecurityAuditPassMode(mddContent, deepAudit) === "family-multi-pass";
}
