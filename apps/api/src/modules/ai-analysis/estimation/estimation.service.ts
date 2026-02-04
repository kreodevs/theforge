import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service.js";
import type {
  LiveMetricsResult,
  MDDContext,
  PrecisionBreakdown,
  SemaphoreStatusLive,
} from "./estimation.types.js";
import {
  INTERNAL_HOUR_RATE,
  MARKET_HOUR_RATE,
  PRECISION_GREEN_MIN,
  PRECISION_RED_MAX,
  RATIO_ARCHITECT,
  RATIO_BACK,
  RATIO_FRONT,
  RISK_FACTOR_LOW_PRECISION,
  RISK_PRECISION_THRESHOLD,
} from "./estimation.types.js";

/** Horas base por unidad (entidades, pantallas, endpoints) para derivar total. */
const HOURS_PER_ENTITY = 12;
const HOURS_PER_SCREEN = 16;
const HOURS_PER_ENDPOINT = 4;

/** Lookahead: siguiente ## (nivel 2) o fin del string. $(?!\n) evita que en modo "m" $ coincida con fin de línea. */
const SECTION_BOUNDARY = /(?=\n##\s|$(?!\n))/;

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

/**
 * Gaps de consistencia y completitud (agnóstico de dominio).
 * Alineado con "MDD Universal Audit Rules":
 * - Rule 1 Feature-Infrastructure: scopeDataGap (alcance → modelo/API).
 * - Rule 2 Data Integrity: dataIntegrityGap (UUID PKs, created_at/updated_at TIMESTAMPTZ, ON DELETE).
 * - Rule 3 API-Schema: no auto-check 1:1 (defer to agents); opcional apiErrorCodes en sección API.
 * - Rule 4 Inheritance: missingManifest + TechnicalMetadata/base template en proyectos derivados.
 * - Rule 5 Architectural: patrones y diagramas = SQL/API no se validan aquí (defer to agents/review).
 */
function computeConsistencyGaps(md: string): {
  scopeDataGap: number;
  contradictionGap: number;
  securityCompletenessGap: number;
  missingManifest: number;
  dataIntegrityGap: number;
} {
  const lower = (md || "").trim().toLowerCase();
  // Estructura canónica MDD: 1 Contexto, 2 Arquitectura y Stack, 3 Modelo de Datos, 4 Contratos de API, 5 Lógica y Edge Cases, 6 Seguridad, 7 Infraestructura
  const contextBlock = extractSection(
    md,
    /^#+\s*(?:1\.\s*)?(?:contexto\s+y\s+alcance|contexto\b)/im,
  ).toLowerCase();
  const dataModelBlock = extractSection(
    md,
    /^#+\s*(?:3\.\s*)?(?:modelo\s+de\s+datos|datos\s*\/\s*entidades)/im,
  ).toLowerCase();
  const integrationBlock = extractSection(
    md,
    /^#+\s*(?:7\.\s*)?(?:infraestructura|infra|integraci[oó]n)/im,
  ).toLowerCase();
  const securityBlock = extractSection(
    md,
    /^##\s+(?:\d+\.\s*)?(?:seguridad|security)/im,
  ).toLowerCase();

  const apiBlock = extractSection(
    md,
    /^#+\s*(?:4\.\s*)?(?:contratos\s+de\s+api|api\s+contracts|endpoints)/im,
  ).toLowerCase();
  const sqlBlock =
    (md.match(/```sql\s*([\s\S]*?)```/i)?.[1] ?? "") +
    (dataModelBlock || lower);
  const tablesAndColumns = sqlBlock;

  // --- Rule 1: Document–Model congruence (domain-agnostic) ---
  // Cualquier concepto que el documento describa y que exija persistencia debe tener reflejo en tablas/columnas.
  // Pares (documento menciona X → esquema debe contener Y). Cubren múltiples dominios (auth, catálogo, pedidos, etc.).
  const scopeText = [contextBlock, securityBlock, apiBlock].join(" ");
  const persistenceConceptPairs: Array<{ doc: RegExp; schema: RegExp }> = [
    { doc: /\b(credencial|password|contraseña|hash|login|autenticaci[oó]n|almacenamiento de credencial)\b/i, schema: /\b(password_hash|credential|hash|external_store|almac[eé]n|referencia)\b/i },
    { doc: /\b(mfa|totp|2fa|two[- ]?factor|segundo factor|secretos?|google\s+authenticator)\b/i, schema: /\bmfa_secrets\b|\btotp_secret\b|\bmfa_secret\b|\botp_secret\b|create\s+table\s+\w*secret/i },
    { doc: /\b(sesi[oó]n|session)s?\b/i, schema: /\b(session|sesion|sessions)\b/i },
    { doc: /\b(audit|auditoría|historial|history|log|registro)\b/i, schema: /\b(audit|history|log|created_at|updated_at)\b/i },
    { doc: /\b(roles?|rbac|permisos?|permiso)\b/i, schema: /\b(role|permission|rol|permiso)\b/i },
    { doc: /\b(pedido|order)s?\b/i, schema: /\b(order|pedido)\b/i },
    { doc: /\b(producto|product)s?\b/i, schema: /\b(product|producto)\b/i },
    { doc: /\b(catálogo|catalog)\b/i, schema: /\b(catalog|catálogo|category|product)\b/i },
    { doc: /\b(inventario|inventory|stock)\b/i, schema: /\b(inventory|inventario|stock)\b/i },
    { doc: /\b(pago|payment)\b/i, schema: /\b(payment|pago|transaction)\b/i },
    { doc: /\b(notificaci[oó]n|notification)\b/i, schema: /\b(notification|notificaci|alert)\b/i },
  ];
  let scopeDataGap = 0;
  for (const { doc: docRe, schema: schemaRe } of persistenceConceptPairs) {
    if (docRe.test(scopeText) && !schemaRe.test(tablesAndColumns)) {
      scopeDataGap = 1;
      break;
    }
  }

  let contradictionGap = 0;
  const negations = [
    { no: /no\s+(se\s+)?implementa(rá|rán|)\s+(oauth|oidc|saml|openid)/i, yes: /\b(oauth|oidc|saml|openid\s+connect)\b/i },
    { no: /no\s+habr[áa]\s+(oauth|oidc|saml)/i, yes: /\b(oauth|oidc|saml)\b/i },
    { no: /no\s+se\s+usar[áa]\s+(oauth|oidc|saml)/i, yes: /\b(oauth|oidc|saml)\b/i },
  ];
  for (const { no: noRe, yes: yesRe } of negations) {
    if (noRe.test(contextBlock) && yesRe.test(integrationBlock)) contradictionGap = 1;
  }

  let securityCompletenessGap = 0;
  const highSecurity = /\b(high_security|alta seguridad|seguridad crítica)\b/i.test(lower);
  const hasCredentials = /\b(credencial|password|contraseña|autenticaci[oó]n)\b/i.test(contextBlock) || /\b(credencial|password|autenticaci[oó]n)\b/i.test(securityBlock);
  // Solo exigir columnas de auditoría (ip/user_agent) cuando el doc marca alta seguridad explícita
  if (highSecurity) {
    const needsAudit = /\b(ip_address|user_agent|ip\b|user_agent)\b/i.test(tablesAndColumns);
    if (!needsAudit) securityCompletenessGap += 0.5;
  }
  if (hasCredentials) {
    const hasCredStorage = /\b(password_hash|credential|external_store|almac[eé]n\b|referencia)\b/i.test(tablesAndColumns);
    if (!hasCredStorage) securityCompletenessGap += 0.5;
  }
  securityCompletenessGap = Math.min(1, securityCompletenessGap);

  // --- Rule 2: Data Integrity & Scalability (UUID PKs, timestamps, ON DELETE) ---
  let dataIntegrityGap = 0;
  const hasTables = /\bcreate\s+table\b/i.test(sqlBlock);
  if (hasTables) {
    const hasUuidPk = /(?:gen_random_uuid|uuid_generate_v4|uuid\s+primary\s+key|default\s+gen_random_uuid)/i.test(sqlBlock);
    const hasTimestamps = /(?:created_at|updated_at)/i.test(sqlBlock) && /timestamptz/i.test(sqlBlock);
    const hasOnDelete = /on\s+delete\s+(cascade|set\s+null|restrict)/i.test(sqlBlock);
    if (!hasUuidPk) dataIntegrityGap += 0.35;
    if (!hasTimestamps) dataIntegrityGap += 0.35;
    if (!hasOnDelete) dataIntegrityGap += 0.3;
  }
  dataIntegrityGap = Math.min(1, dataIntegrityGap);

  // --- Rule 4: Inheritance (Manifest / TechnicalMetadata / Base Template) ---
  let missingManifest = 0;
  const hasInfraSection = /\b(infraestructura|infra|despliegue|integraci[oó]n)\b/i.test(md) && (integrationBlock.length > 80 || /##\s*(?:7\.\s*)?(?:infra|integraci[oó]n)/i.test(md));
  const hasManifestJson = /```json\s*[\s\S]*?(?:manifest|infra|services|stack)[\s\S]*?```/i.test(md);
  const hasTechnicalMetadata = /technicalmetadata|technical\s+metadata|base\s+template|plantilla\s+base/i.test(lower);
  const isDerivedOrMicro = /\b(microservice|microservicio|derived|hereda|plantilla\s+base)\b/i.test(lower);
  if (hasInfraSection && !hasManifestJson && !hasTechnicalMetadata) {
    missingManifest = isDerivedOrMicro ? 0.5 : 0.25;
  }

  return { scopeDataGap, contradictionGap, securityCompletenessGap, missingManifest, dataIntegrityGap };
}

/**
 * Desglose de precisión por sección/agente (0–100) para la tabla del chat.
 * Usa las mismas secciones y gaps que el semáforo; cada dimensión se penaliza según gaps que la afectan.
 */
function computePrecisionBreakdown(md: string): PrecisionBreakdown {
  const sections = detectReferenceSections(md);
  const gaps = computeConsistencyGaps(md);
  const contextBlock = extractSection(md, /^#+\s*(?:1\.\s*)?(?:contexto\s+y\s+alcance|contexto\b)/im);
  // Frontend está dentro de §2 Arquitectura y Stack (subsección ### Frontend)
  const frontendBlock = extractSection(md, /^#+\s*(?:2\.\s*)?(?:arquitectura\s+y\s+stack|arquitectura\s+frontend|frontend)/im);

  const contexto = Math.round(
    Math.max(0, Math.min(100, 100 - (gaps.contradictionGap ? 40 : 0) - (contextBlock.length < 80 ? 30 : 0))),
  );
  const modeloDatos = Math.round(
    Math.max(0, Math.min(100, sections.db * 100 - gaps.dataIntegrityGap * 35 - gaps.scopeDataGap * 40)),
  );
  const apiContracts = Math.round(
    Math.max(0, Math.min(100, sections.endpoints * 100 - (sections.endpointsWithPayloads ? 0 : 25))),
  );
  const frontend = Math.round(
    Math.max(0, Math.min(100, frontendBlock.length >= 80 ? 100 : frontendBlock.length >= 40 ? 50 : 0)),
  );
  const seguridad = Math.round(
    Math.max(0, Math.min(100, sections.security * 100 - gaps.securityCompletenessGap * 30)),
  );
  const integracion = Math.round(
    Math.max(0, Math.min(100, sections.infra * 100 - gaps.missingManifest * 40 - gaps.contradictionGap * 30)),
  );

  return { contexto, modeloDatos, apiContracts, frontend, seguridad, integracion };
}

/**
 * Detecta secciones de referencia del MDD en markdown (agnóstico de dominio).
 * Verde requiere: DB/entidades, Endpoints con payloads, Seguridad con contenido sustancial (decisiones documentadas).
 * Integración cuenta como infra (MDD estándar del proyecto incluye ## Integración).
 */
function detectReferenceSections(md: string): {
  db: number;
  endpoints: number;
  endpointsWithPayloads: boolean;
  security: number;
  securitySubstantive: boolean;
  infra: number;
} {
  const content = (md || "").trim().toLowerCase();
  const scores = {
    db: 0,
    endpoints: 0,
    endpointsWithPayloads: false,
    security: 0,
    securitySubstantive: false,
    infra: 0,
  };

  const hasSection = (patterns: RegExp[], minLength = 80) => {
    for (const p of patterns) {
      const m = content.match(p);
      if (m) {
        const block = (m[1] ?? m[0] ?? "").trim();
        return block.length >= minLength ? 1 : 0.5;
      }
    }
    return 0;
  };

  // §3 Modelo de Datos
  scores.db = hasSection(
    [new RegExp("(?:#+\\s*)?(?:modelo\\s+de\\s+datos|datos\\s*\\/\\s*entidades|db_entities)[\\s\\S]*?" + SECTION_BOUNDARY.source, "i")],
    60,
  );
  // §4 Contratos de API (no confundir con §7 Infraestructura)
  scores.endpoints = hasSection(
    [new RegExp("(?:#+\\s*)?(?:contratos\\s+de\\s+api|endpoints|api\\s+contracts)[\\s\\S]*?" + SECTION_BOUNDARY.source, "i")],
    60,
  );
  scores.endpointsWithPayloads =
    scores.endpoints > 0 &&
    (/\bpayload\b|\brequest\s*body\b|\bresponse\s*body\b|json\s*:\s*\{/i.test(content) ||
      /(?:post|put|patch).*\{[\s\S]*\}/i.test(content));

  const securityBlock =
    content.match(
      new RegExp("^##\\s+(?:\\d+\\.\\s*)?(?:seguridad|security)[\\s\\S]*?" + SECTION_BOUNDARY.source, "im"),
    )?.[0] ?? "";
  scores.security = securityBlock.length >= 40 ? 1 : securityBlock.length > 0 ? 0.5 : 0;
  scores.securitySubstantive =
    scores.security > 0 &&
    (/autenticación|autorización|permisos|cifrado|token|sesión|hash|rbac|roles|mfa|argon2|2fa|two\-factor/i.test(securityBlock) ||
      securityBlock.length >= 120);

  scores.infra = hasSection(
    [
      new RegExp("(?:#+\\s*)?(?:infraestructura|infra|despliegue|integración)[\\s\\S]*?" + SECTION_BOUNDARY.source, "i"),
    ],
    40,
  );

  return scores;
}

/**
 * Parsea entidades, pantallas y endpoints desde markdown para asignar horas base.
 * Estructura canónica MDD: §3 Modelo de Datos, §4 Contratos de API.
 */
function parseCountsFromMarkdown(md: string): {
  entityCount: number;
  screenCount: number;
  extraEndpointCount: number;
} {
  const lines = md.split(/\r?\n/);
  const entities = new Set<string>();
  let extraEndpointCount = 0;
  let inDataModel = false;
  let inApi = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^#+\s*(?:\d\.\s*)?.*modelo de datos/i.test(line) || (lower.includes("modelo de datos") && /^#+\s*/.test(line))) {
      inDataModel = true;
      inApi = false;
      continue;
    }
    if (/^#+\s*(?:\d\.\s*)?.*contratos de api|^#+\s*4\.|endpoints/i.test(line) || (lower.includes("contratos de api") && /^#+\s*/.test(line))) {
      inDataModel = false;
      inApi = true;
      continue;
    }
    if (inDataModel) {
      const m = line.match(/\*\*([A-Za-z][A-Za-z0-9_]*)\*\*|^-\s*\*\*([A-Za-z][A-Za-z0-9_]*)\*\*|^([A-Za-z][A-Za-z0-9_]*)\s*\(/);
      if (m) {
        const name = (m[1] ?? m[2] ?? m[3])?.trim();
        if (name) entities.add(name);
      }
      const createTable = line.match(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/i);
      if (createTable) entities.add(createTable[1].toLowerCase());
    }
    if (inApi && (/\/api\/|\/auth\//.test(line) || /\b(POST|GET|PUT|DELETE|PATCH)\s+(\/|https?)/i.test(line))) {
      extraEndpointCount += 1;
    }
  }

  const createTableGlobal = md.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/gi);
  for (const m of createTableGlobal) entities.add(m[1].toLowerCase());

  const entityCount = entities.size;
  const screenCount =
    extraEndpointCount > 0 ? 0 : entityCount > 0 ? Math.min(entityCount * 2, 20) : 0;
  return { entityCount, screenCount, extraEndpointCount };
}

/**
 * Servicio de estimación en vivo, independiente del flujo LangChain.
 * Tasa interna 2026: $21k netos × 1.4 carga social ÷ 160 h/mes = $185 MXN/hr.
 * Llamable por GET /ai-analysis/estimation?projectId= o cuando el documento cambie en el front.
 */
@Injectable()
export class EstimationService {
  private readonly liveDraftByProject = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) { }

  setLiveDraft(projectId: string, mddDraft: string): void {
    if (!projectId?.trim()) return;
    this.liveDraftByProject.set(projectId.trim(), mddDraft ?? "");
  }

  clearLiveDraft(projectId: string): void {
    if (projectId?.trim()) this.liveDraftByProject.delete(projectId.trim());
  }

  async getMddContentForProject(projectId: string): Promise<string | null> {
    const live = this.liveDraftByProject.get(projectId?.trim() ?? "");
    if (live != null && live.trim().length > 0) return live;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId?.trim() },
      select: { mddContent: true },
    });
    return project?.mddContent ?? null;
  }

  /**
   * Métricas para un proyecto. Si se pasa mddContent, se usa ese (contenido actual en UI); sino liveDraft o DB.
   */
  async getLiveMetricsForProject(projectId: string, mddContentOverride?: string): Promise<LiveMetricsResult> {
    const content =
      mddContentOverride != null && mddContentOverride.length > 0
        ? mddContentOverride
        : (await this.getMddContentForProject(projectId)) ?? "";
    return this.calculateLiveMetrics(content);
  }

  /** Desglose por sección/agente (0–100) para mostrar en la tabla del chat tras auditar. */
  getPrecisionBreakdown(md: string): PrecisionBreakdown {
    return computePrecisionBreakdown((md ?? "").trim());
  }

  /**
   * Calcula métricas en vivo a partir del MDD (markdown o objeto con mddContent).
   * - Horas: asignación automática (entidades, pantallas, endpoints) repartida 15% arquitectura, 45% back, 40% front.
   * - totalMXN = totalHours × INTERNAL_HOUR_RATE ($185) × riskFactor.
   * - Factor de riesgo: precisión < 70% → 1.25; precisión ≥ 95% → 1.0 (entre 70–95% se usa 1.0).
   * - Verde solo si MDD tiene: entidades DB, endpoints con payloads, y sección Seguridad (MFA/Argon2).
   */
  calculateLiveMetrics(mddContext: MDDContext): LiveMetricsResult {
    const raw =
      typeof mddContext === "string"
        ? mddContext
        : (mddContext as { mddContent?: string })?.mddContent ?? "";
    const md = raw?.trim() ?? "";

    const sections = detectReferenceSections(md);
    const gaps = computeConsistencyGaps(md);

    // Penalidades por gaps (genéricas): Rule 1 alcance↔modelo, Rule 2 integridad SQL, contradicción, seguridad, manifest.
    const basePrecisionRaw =
      (sections.db + sections.endpoints + sections.security + sections.infra) * 25;
    const gapPenalty =
      gaps.scopeDataGap * 22 +
      gaps.contradictionGap * 22 +
      gaps.securityCompletenessGap * 12 +
      gaps.missingManifest * 16 +
      gaps.dataIntegrityGap * 10;
    const precisionRaw = Math.max(0, basePrecisionRaw - gapPenalty);
    const precision = Math.min(100, Math.round(precisionRaw));

    const hasGreenCriteria =
      sections.db > 0 &&
      sections.endpointsWithPayloads &&
      sections.securitySubstantive &&
      gaps.scopeDataGap === 0 &&
      gaps.contradictionGap === 0;
    const status: SemaphoreStatusLive =
      precision >= PRECISION_GREEN_MIN && hasGreenCriteria
        ? "green"
        : precision >= PRECISION_RED_MAX
          ? "yellow"
          : "red";

    const { entityCount, screenCount, extraEndpointCount } = parseCountsFromMarkdown(md);
    const baseTotalHours =
      entityCount * HOURS_PER_ENTITY +
      screenCount * HOURS_PER_SCREEN +
      extraEndpointCount * HOURS_PER_ENDPOINT;

    const riskFactor =
      precision < RISK_PRECISION_THRESHOLD ? RISK_FACTOR_LOW_PRECISION : 1.0;
    const totalHours = baseTotalHours;
    const totalMXN = Math.round(totalHours * INTERNAL_HOUR_RATE * riskFactor);
    const totalMXNMarket = Math.round(totalHours * MARKET_HOUR_RATE * riskFactor);

    const roles = {
      architect: baseTotalHours > 0 ? 1 : 0,
      back: baseTotalHours > 0 ? 1 : 0,
      front: baseTotalHours > 0 ? 1 : 0,
    };
    const rolesHours = {
      architect: Math.round(baseTotalHours * RATIO_ARCHITECT * 100) / 100,
      back: Math.round(baseTotalHours * RATIO_BACK * 100) / 100,
      front: Math.round(baseTotalHours * RATIO_FRONT * 100) / 100,
    };

    return {
      precision,
      totalMXN,
      totalMXNMarket,
      totalHours: Math.round(totalHours * 100) / 100,
      roles,
      rolesHours,
      status,
    };
  }

}
