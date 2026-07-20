import type { MddStructured } from "../../state/mdd-structured.schema.js";
import {
  formatDocumentMarkdown,
  repairGluedMarkdownHeadings,
  peelDocumentBodyForPersist,
  repairInlineHorizontalRuleSectionBreaks,
  repairApiResponse204NoContent,
  repairOrphanFenceBeforeContractLabels,
  repairUnclosedJsonBeforeApiEndpoint,
  repairApiContractJsonFences,
} from "@theforge/shared-types";
import {
  ensureMddGovernanceSection,
  extractGovernanceSection,
  hasGovernanceSection,
  selectedPatternIdsFromMdd,
  updateMddGovernancePatterns,
} from "@theforge/shared-types/mdd-governance-patterns";
import { applyMddQualityAutoRepairs, collectMddQualityIssues } from "../../../engine/mdd-quality-audit.util.js";
import { sanitizeMermaidInDraft } from "../../../engine/mdd-pre-render.js";
import { sqlToErDiagramContent } from "../mdd-diagram-suggestions.js";
import { subsectionsToMarkdown } from "./json-section-to-markdown.js";
import { extractMddSectionBody } from "./section-body.util.js";
import {
  draftUsesLdapPrimaryAuth,
  fixIntegrationMetadataCoherence,
  fixSecurityManifestCoherence,
} from "./security-manifest.js";
import {
  formatSqlBlockWithNewlines,
  sanitizeAllSqlBlocksInDraft,
  sanitizeSqlBrokenCommentsAndProse,
  sqlBlockContainsProseArtifact,
} from "./sql-repair.js";

import {
  deduplicateAndReorderMddSections,
  ensureMissingCanonicalSections,
  extractContextSectionBody,
  fixGluedSection6Heading,
  getMddDraftSummary,
  mddHasDuplicateSectionHeadings,
  normalizeCanonicalMddSectionHeadings,
  replaceContextWhenInstructions,
  stripTrailingDuplicateMddSections,
} from "./section-merge.js";
import { findBalancedBrace, findBalancedBraceRespectingStrings } from "./brace.util.js";
import {
  fixDoubleMermaidFences,
  fixSection2UnclosedSqlAndGluedMermaid,
  repairMermaidBlocksInSectionBody,
  stripMermaidFences,
  unescapeMermaidLiteralNewlines,
} from "./mermaid-fences.js";
import { stripStrayParenAfterJsonCodeBlocks } from "./persist-format.util.js";
import { corpusUsesRs256Jwt } from "./cross-consistency.js";



/** Patrones para detectar en el documento qué infra/orquestación/despliegue está identificada (genérico). */
const INFRA_TERM_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /docker\s+compose|docker-compose/i, key: "docker-compose" },
  { pattern: /\bdocker\b/i, key: "docker" },
  { pattern: /\bdokploy\b/i, key: "dokploy" },
  { pattern: /\bkubernetes\b|k8s\b/i, key: "kubernetes" },
  { pattern: /\baws\b|api\s+gateway|amazon\s+cognito|rds\b|cloudwatch|cloudtrail/i, key: "aws" },
  { pattern: /\bgcp\b|google\s+cloud|cloud\s+run/i, key: "gcp" },
  { pattern: /\bterraform\b/i, key: "terraform" },
  { pattern: /\becs\b|eks\b|ec2\b/i, key: "aws" },
];

/**
 * Extrae del texto del documento (contexto, borrador, respuestas del usuario) los términos de
 * infraestructura/orquestación/despliegue que están identificados (Docker, Dokploy, K8s, AWS, GCP, etc.).
 * Sirve para que el manifest refleje solo lo que el documento menciona.
 */
export function extractIdentifiedInfraFromText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const found = new Set<string>();
  for (const { pattern, key } of INFRA_TERM_PATTERNS) {
    if (pattern.test(text)) found.add(key);
  }
  return [...found];
}

/**
 * Patrones indicativos (agnósticos de dominio) para detectar temas ya documentados.
 * Cubren ámbitos frecuentes en MDDs (auth, datos, infra, etc.); el Clarificador debe usar
 * además el borrador completo como fuente de verdad: cualquier tema ya redactado, sea cual sea
 * el dominio, no debe generar pregunta.
 */
const ALREADY_DOCUMENTED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(transacciones\s+ACID|ACID\b|integridad\s+transaccional|consistencia\s+(fuerte|eventual|ACID))\b/i, label: "transacciones/consistencia" },
  { pattern: /\b(MFA|TOTP|2FA|autenticaci[oó]n\s+multifactor|segundo\s+factor)\b/i, label: "MFA/segundo factor" },
  { pattern: /\b(JWT|tokens?\s+JSON|json\s+web\s+token)\b/i, label: "JWT/tokens" },
  { pattern: /\b(password_hash|hash\s+de\s+contraseña|bcrypt|argon2)\b/i, label: "almacenamiento de credenciales" },
  { pattern: /\b(sesiones?|sessions?)\b/i, label: "sesiones" },
  { pattern: /\b(RBAC|roles?\s+y\s+permisos|control\s+de\s+acceso)\b/i, label: "roles/permisos" },
  { pattern: /\b(auditoría|audit|created_at|registro\s+de\s+actividades)\b/i, label: "auditoría" },
  { pattern: /\b(docker|kubernetes|dokploy|docker-compose)\b/i, label: "infraestructura/despliegue" },
  { pattern: /\b(manifest|stack|orquestaci[oó]n)\b/i, label: "manifest de infra" },
  { pattern: /\b(pago|payment|stripe|mercadopago|pasarela)\b/i, label: "pagos" },
  { pattern: /\b(inventario|stock|catálogo|catalog)\b/i, label: "inventario/catálogo" },
  { pattern: /\b(pedido|order)\b/i, label: "pedidos" },
  { pattern: /\b(notificaci[oó]n|notification|email\s+push)\b/i, label: "notificaciones" },
  { pattern: /\b(integridad\s+referencial|foreign\s+key|REFERENCES)\b/i, label: "integridad referencial" },
];

/**
 * Extrae temas indicativos que ya aparecen en el borrador (cualquier dominio) para que el
 * Clarificador no repita preguntas. La lista es orientativa; el LLM debe revisar el borrador
 * completo y no preguntar sobre ningún tema ya cubierto en el texto.
 */
export function extractAlreadyDocumentedTopics(draft: string): string[] {
  if (!draft || typeof draft !== "string") return [];
  const found = new Set<string>();
  for (const { pattern, label } of ALREADY_DOCUMENTED_PATTERNS) {
    if (pattern.test(draft)) found.add(label);
  }
  return [...found];
}

/**
 * Construye un manifest JSON mínimo a partir de términos de infra identificados en el documento.
 * Si no hay ninguno, devuelve un manifest con pending para que se pregunte al usuario.
 */
export function buildManifestFromIdentifiedInfra(identifiedTerms: string[]): string {
  const normalized = [...new Set(identifiedTerms.map((t) => t.toLowerCase()))];
  if (normalized.length === 0) {
    return JSON.stringify(
      {
        manifest: "infra-v1",
        stack: [],
        pending: "Definir con el usuario: orquestación (Docker Compose, K8s, etc.) y despliegue (Dokploy, AWS ECS, GCP, etc.)",
      },
      null,
      2,
    );
  }
  const hasAws = normalized.some((t) => t === "aws");
  const hasDocker = normalized.some((t) => t === "docker" || t === "docker-compose");
  const hasDokploy = normalized.some((t) => t === "dokploy");
  const hasK8s = normalized.some((t) => t === "kubernetes");
  if (hasDocker || hasDokploy) {
    return JSON.stringify(
      {
        manifest: "infra-v1",
        orchestration: hasDocker ? "docker-compose" : undefined,
        deployment: hasDokploy ? "dokploy" : undefined,
        stack: [...new Set([...(hasDocker ? ["docker", "docker-compose"] : []), ...(hasDokploy ? ["dokploy"] : [])])],
        services: ["api", "db", "frontend"],
      },
      null,
      2,
    );
  }
  if (hasK8s) {
    return JSON.stringify(
      { manifest: "infra-v1", orchestration: "kubernetes", stack: ["kubernetes"], services: ["api", "db", "frontend"] },
      null,
      2,
    );
  }
  if (hasAws) {
    return JSON.stringify(
      { manifest: "infra-v1", provider: "aws", stack: normalized, services: ["api", "db", "frontend"] },
      null,
      2,
    );
  }
  return JSON.stringify(
    { manifest: "infra-v1", stack: normalized, services: ["api", "db", "frontend"] },
    null,
    2,
  );
}

/**
 * Construye un manifest en el formato exclusivo (project_id, stack, deployment, integration_metadata)
 * a partir de términos identificados en el documento. Usado cuando el LLM no devuelve JSON válido
 * y el fallback no tiene bloque ```json (evita salida "Manifest: Docker, Dokploy").
 */
export function buildNewFormatManifestFromIdentifiedTerms(identifiedTerms: string[]): Record<string, unknown> {
  const normalized = [...new Set(identifiedTerms.map((t) => t.toLowerCase()))];
  const hasDokploy = normalized.includes("dokploy");
  const hasK8s = normalized.includes("kubernetes") || normalized.includes("k8s");
  const hasDocker = normalized.includes("docker") || normalized.includes("docker-compose");
  const orchestrator = hasK8s ? "Kubernetes" : hasDocker ? "Docker Compose" : "TBD";
  const deploymentManager = hasDokploy ? "Dokploy" : "TBD";
  return {
    project_id: "mdd-project",
    stack: {
      backend: {
        framework: "NestJS",
        version: "10.x",
        language: "TypeScript",
        orm: "TypeORM",
        container: { base_image: "node:20-alpine", exposed_port: 3000 },
      },
      database: { engine: "PostgreSQL", version: "16", extensions: ["uuid-ossp", "pgcrypto"] },
      security: {
        protocol: "HTTPS",
        token_management: "JWT",
        mfa_strategy: "TOTP",
        hashing_algorithm: "bcrypt",
        hashing_rounds: 12,
      },
    },
    deployment: {
      orchestrator,
      provider: "Self-hosted / Cloud",
      tooling: { deployment_manager: deploymentManager, ci_cd: "Bitbucket Pipelines" },
      resources: { min_replicas: 1, max_replicas: 5, cpu_threshold: "70%" },
    },
    integration_metadata: { api_prefix: "/api/v1", jwks_enabled: false, multi_tenant_support: false },
  };
}

/**
 * Si el documento identificó una infra concreta (identifiedTerms) y el bloque manifest de la sección
 * incluye proveedores/servicios NO mencionados (ej. AWS cuando solo se mencionó Docker/Dokploy),
 * reemplaza el bloque por un manifest coherente con lo identificado.
 * Si identifiedTerms está vacío, reemplaza manifest con placeholder para definir con el usuario.
 */
export function sanitizeManifestToMatchIdentifiedInfra(sectionBody: string, identifiedTerms: string[]): string {
  if (!sectionBody) return sectionBody;
  const jsonBlockRe = /```json\s*\n[\s\S]*?```/g;
  const normalized = [...new Set(identifiedTerms.map((t) => t.toLowerCase()))];
  const hasAwsInDoc = normalized.includes("aws");
  const hasDockerDokployInDoc = ["docker", "docker-compose", "dokploy"].some((k) => normalized.includes(k));

  return sectionBody.replace(jsonBlockRe, (block) => {
    if (normalized.length === 0) {
      if (/^\s*\{\s*"manifest"/m.test(block) && !/"pending"/.test(block)) {
        return "```json\n" + buildManifestFromIdentifiedInfra([]) + "\n```";
      }
      return block;
    }
    const blockHasAws = /api_gateway|Cognito|RDS|CloudWatch|CloudTrail|AWS\s+API/i.test(block);
    if (hasDockerDokployInDoc && !hasAwsInDoc && blockHasAws) {
      return "```json\n" + buildManifestFromIdentifiedInfra(identifiedTerms) + "\n```";
    }
    if (hasAwsInDoc && !blockHasAws && block.length < 200) {
      return "```json\n" + buildManifestFromIdentifiedInfra(identifiedTerms) + "\n```";
    }
    return block;
  });
}

/**
 * Si la infra identificada en el documento NO es AWS (ej. solo Docker/Dokploy), reemplaza en las secciones
 * Seguridad e Integración las menciones a AWS Cognito, AWS RDS, etc. por equivalentes genéricos para evitar
 * contradicción con un alcance self-hosted.
 */
export function replaceAwsProseWithGenericWhenInfraNotAws(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const identified = extractIdentifiedInfraFromText(draft);
  const normalized = [...new Set(identified.map((t) => t.toLowerCase()))];
  if (normalized.includes("aws")) return draft;

  const replacements: Array<[RegExp, string]> = [
    [/AWS\s+Cognito|Amazon\s+Cognito/gi, "servicio de autenticación (self-hosted)"],
    [/AWS\s+RDS|Amazon\s+RDS/gi, "base de datos PostgreSQL"],
    [/AWS\s+API\s+Gateway|API\s+Gateway\s+\(AWS\)/gi, "API / gateway de la aplicación"],
    [/AWS\s+CloudWatch|CloudWatch/gi, "monitoreo"],
    [/AWS\s+CloudTrail|CloudTrail/gi, "registro de auditoría"],
  ];

  for (const heading of ["## Seguridad", "## Integración"]) {
    const idx = draft.indexOf(heading);
    if (idx === -1) continue;
    const sectionStart = idx + heading.length;
    const rest = draft.slice(sectionStart);
    const nextH2 = rest.search(/\n##\s+/);
    const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
    let newBody = body;
    for (const [re, replacement] of replacements) {
      newBody = newBody.replace(re, replacement);
    }
    if (newBody === body) continue;
    const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
    draft = draft.slice(0, sectionStart) + newBody + afterSection;
  }
  return draft;
}

/**
 * Parche por concepto (no por dominio): cuando el documento describe autenticación con credenciales
 * (login/password) o con secretos (MFA/TOTP), asegura que el SQL tenga almacén para credencial y/o
 * secreto si falta. Nombres usados son convención estándar (password_hash, tabla de secretos);
 * aplica a cualquier documento que describa esos conceptos, no solo a un dominio concreto.
 */
export function ensureSection2HasAuthAndMfa(section2Content: string, scopeText: string): string {
  if (!section2Content || typeof section2Content !== "string") return section2Content;
  const scope = (scopeText || "").trim().toLowerCase();
  const hasCredentialAuth = /\b(login|password|credencial|autenticaci[oó]n|usuario\s+y\s+contraseña|hash\s+de\s+contraseña)\b/i.test(scope);
  const hasSecretAuth = /\b(mfa|totp|2fa|google\s+authenticator|segundo\s+factor|secreto\s+(de\s+)?(mfa|totp))\b/i.test(scope);
  if (!hasCredentialAuth && !hasSecretAuth) return section2Content;

  const sqlBlockMatch = section2Content.match(/```sql\s*([\s\S]*?)```/);
  if (!sqlBlockMatch) return section2Content;
  let sql = sqlBlockMatch[1];
  const beforeSql = section2Content.slice(0, sqlBlockMatch.index);
  const afterSql = section2Content.slice((sqlBlockMatch.index ?? 0) + sqlBlockMatch[0].length);
  let changed = false;

  if (hasCredentialAuth && !/\b(password_hash|credential_hash|password_hash)\b/i.test(sql)) {
    const usersMatch = sql.match(/CREATE\s+TABLE\s+users\s*\([\s\S]*?\)\s*;/i);
    if (usersMatch) {
      const block = usersMatch[0];
      if (!/\bpassword_hash\b/i.test(block)) {
        const withHash = block.replace(
          /(\n\s*created_at\s+TIMESTAMPTZ[^\n]*)/i,
          "  password_hash VARCHAR(255) NOT NULL,\n$1",
        );
        if (withHash === block) {
          sql = sql.replace(block, block.replace(/(\)\s*;)\s*$/, "  password_hash VARCHAR(255) NOT NULL,\n$1"));
        } else {
          sql = sql.replace(block, withHash);
        }
        changed = true;
      }
    }
  }
  if (hasSecretAuth && !/\b(mfa_secrets|totp_secret|mfa_secret|otp_secret)\b/i.test(sql)) {
    const userTable = /CREATE\s+TABLE\s+(users|usuarios|user)\s*\(/i.exec(sql)?.[1] ?? "users";
    const mfaTable =
      `\n\nCREATE TABLE mfa_secrets (\n  user_id UUID NOT NULL REFERENCES ${userTable}(id) ON DELETE CASCADE,\n  totp_secret VARCHAR(255) NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  PRIMARY KEY (user_id)\n);`;
    sql = sql.trimEnd() + mfaTable;
    changed = true;
  }
  if (!changed) return section2Content;
  return beforeSql + "```sql\n" + sql + "\n```" + afterSql;
}


/** Cuenta CREATE TABLE en §3 (autoridad para recuentos de entidades en export). */
export function countMddSection3CreateTables(mddMarkdown: string): number {
  const sec3 = extractMddSectionBody(mddMarkdown, "## 3. Modelo de Datos");
  if (!sec3?.body.trim()) return 0;
  return (
    sec3.body.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z_][a-zA-Z0-9_]*/gi) ??
    []
  ).length;
}

/** Detecta MDD truncado (fence JSON sin cerrar al final). */
export function detectTruncatedMddMarkdown(mdd: string): boolean {
  const trimmed = (mdd ?? "").trim();
  if (!trimmed) return false;
  const fenceCount = (trimmed.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) return true;
  const tail = trimmed.slice(-400);
  if (/```json[\s\S]*"[^"\n]{0,12}$/i.test(tail)) return true;
  return false;
}

/** Inyecta bloque TechnicalMetadata en §3 si falta (etiquetas inferidas del corpus). */
export function ensureTechnicalMetadataBlockInDraft(draft: string): string {
  if (
    /TechnicalMetadata|\[(?:high_security|external_api|multi_tenant|cicd_pipeline|real_time)\]/i.test(
      draft,
    )
  ) {
    return draft;
  }
  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section?.body?.trim()) return draft;

  const tags: string[] = [];
  if (/Argon2|JWT|MFA|TOTP|RS256|oauth|seguridad/i.test(draft)) tags.push("[high_security]");
  if (/webhook|api externa|terceros|integraci[oó]n externa/i.test(draft)) tags.push("[external_api]");
  if (/tenant|multi.?tenant/i.test(draft)) tags.push("[multi_tenant]");
  if (/docker|ci\/cd|pipeline|deploy|github actions/i.test(draft)) tags.push("[cicd_pipeline]");
  if (/websocket|real.?time|streaming/i.test(draft)) tags.push("[real_time]");
  if (tags.length === 0) tags.push("[high_security]");

  const metaBlock = `\n\n\`\`\`TechnicalMetadata\n${tags.join(" ")}\n\`\`\``;
  const headingLen = "## 3. Modelo de Datos".length;
  const bodyStart = section.start + headingLen;
  const newBody = section.body.trimEnd() + metaBlock + "\n";
  return draft.slice(0, bodyStart) + newBody + draft.slice(section.end);
}

export const POST_MVP_UI_SURFACE_BANNER =
  "> **Alcance MVP:** Esta guía UX/UI y el design system son **post-MVP**. El MVP implementa solo API REST y CLI (Node/Commander); no hay panel web en el alcance actual.\n";

const NO_UI_SURFACE_FOR_BANNER =
  /(?:sin|no)\s+(?:dashboard|frontend|ui|interfaz|pantalla|panel\s+web)|no\s+incluye[^\n]{0,48}panel\s+web|fuera\s+del\s+alcance[^\n]{0,60}(?:mvp|panel\s+web)|solo\s+interfaces?\s+de\s+integraci[oó]n|solo\s+APIs?\s+y\s+CLI|api[\s-]?only|mvp\s+api|cli[\s-]?only|solo\s+api|backend\s+only|l[ií]nea\s+de\s+comandos/i;

/** §1/§2 indican MVP API+CLI sin panel web (autoridad para omitir UI/UX en MDD). */
export function mddExcludesWebUiSurface(mddMarkdown: string): boolean {
  const sec1Body = extractContextSectionBody(mddMarkdown);
  const sec2 = extractMddSectionBody(mddMarkdown, "## 2. Arquitectura y Stack");
  const authority = [sec1Body, sec2?.body].filter(Boolean).join("\n");
  return NO_UI_SURFACE_FOR_BANNER.test(authority);
}

/** Antepone banner post-MVP en guías UX/design-system cuando el MDD excluye panel web. */
export function ensurePostMvpUiSurfaceBanner(mddMarkdown: string, content: string): string {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return content;
  if (/post-?mvp/i.test(trimmed.slice(0, 400))) return content;
  if (!mddExcludesWebUiSurface(mddMarkdown)) return content;
  return `${POST_MVP_UI_SURFACE_BANNER}\n---\n${trimmed}\n`;
}

/** Sustituye JWT_SECRET por par RS256 en listas, tablas y bloques `.env`. */
function replaceJwtSecretWithRs256KeyPair(text: string): string {
  let out = text;
  out = out.replace(/^(\s*)(JWT_SECRET)(\s*=\s*)(.*)$/gim, (_, indent, _key, eq, val) => {
    const value = (val as string).trim() || "<PEM>";
    const publicVal = /<PEM/i.test(value) ? "<PEM public>" : value;
    return `${indent}JWT_PRIVATE_KEY${eq}${value}\n${indent}JWT_PUBLIC_KEY${eq}${publicVal}`;
  });
  out = out.replace(
    /^(\s*)([-*]\s+)?JWT_PRIVATE_KEY\s*,\s*JWT_PUBLIC_KEY(.*)$/gim,
    (_, indent, bullet, rest) =>
      `${indent}${bullet ?? ""}JWT_PRIVATE_KEY${rest}\n${indent}${bullet ?? ""}JWT_PUBLIC_KEY${rest}`,
  );
  out = out.replace(/\bJWT_SECRET\b/g, "JWT_PRIVATE_KEY, JWT_PUBLIC_KEY");
  out = out.replace(
    /\|\s*`JWT_SECRET`\s*\|[^\n]*/gi,
    "| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | Par RSA PEM para firma/validación JWT (RS256); `JWT_SECRET` deprecado |",
  );
  return out;
}

/** Alinea variables JWT en entregables (infra, architecture) con RS256 del MDD §6. */
export function alignDeliverableMarkdownWithMddSecurity(
  mddMarkdown: string,
  deliverableMarkdown: string,
  options?: { extraCorpus?: string },
): string {
  if (!corpusUsesRs256Jwt(mddMarkdown, options?.extraCorpus ?? "")) return deliverableMarkdown;
  return replaceJwtSecretWithRs256KeyPair(deliverableMarkdown);
}

/** Repara contenido interno de un bloque ```json (fences anidados, blockquote, pretty-print). */
function fixSingleNestedArrayWrappers(value: unknown): unknown {
  if (Array.isArray(value)) {
    const fixed = value.map(fixSingleNestedArrayWrappers);
    if (fixed.length === 1 && Array.isArray(fixed[0])) return fixed[0];
    return fixed;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = fixSingleNestedArrayWrappers(v);
    }
    return out;
  }
  return value;
}

function repairJsonCodeBlockInner(inner: string): string {
  let cleaned = inner.replace(/^>\s?/gm, "");
  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^\s*```json\s*[\r]?\n/gim, "")
      .replace(/^\s*```\s*[\r]?\n/gm, "")
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "");
  }
  cleaned = cleaned.trim();
  if (!cleaned) return inner.trim();
  try {
    const parsed = fixSingleNestedArrayWrappers(JSON.parse(cleaned) as unknown);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return cleaned;
  }
}

/**
 * Desanida fences ```json dentro de bloques JSON (típico en §4 cuando el LLM formatea arrays).
 */
export function repairNestedJsonFencesInDraft(draft: string): string {
  if (!draft) return draft;
  const lower = draft.toLowerCase();
  let result = "";
  let i = 0;
  while (i < draft.length) {
    const open = lower.indexOf("```json", i);
    if (open === -1) {
      result += draft.slice(i);
      break;
    }
    result += draft.slice(i, open);
    let cursor = open + 7;
    if (draft[cursor] === "\r") cursor++;
    if (draft[cursor] === "\n") cursor++;
    const contentStart = cursor;
    let depth = 1;
    let closed = false;
    while (cursor < draft.length && depth > 0) {
      const fence = draft.indexOf("```", cursor);
      if (fence === -1) {
        result += draft.slice(open);
        return result;
      }
      if (lower.startsWith("```json", fence)) {
        depth++;
        cursor = fence + 7;
        if (draft[cursor] === "\r") cursor++;
        if (draft[cursor] === "\n") cursor++;
        continue;
      }
      depth--;
      if (depth === 0) {
        const inner = draft.slice(contentStart, fence);
        result += "```json\n" + repairJsonCodeBlockInner(inner) + "\n```";
        cursor = fence + 3;
        closed = true;
        break;
      }
      cursor = fence + 3;
    }
    if (!closed) {
      result += draft.slice(open);
      break;
    }
    i = cursor;
  }
  return result;
}

/** Saldo de llaves `{`/`}` fuera de strings JSON. Positivo = faltan cierres. */
function countJsonBraceDelta(text: string): number {
  let delta = 0;
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") delta++;
    if (ch === "}") delta--;
  }
  return delta;
}

/**
 * Recupera llaves `}` desplazadas tras el fence de un bloque ```json en §4.
 * Típico: el JSON cierra el fence sin `}` y el cierre aparece tras la descripción del siguiente endpoint.
 */
export function repairDisplacedJsonBracesInContratos(body: string): string {
  if (!body?.trim()) return body;
  let out = body;
  const openRe = /```json\s*\n/gi;
  const openIndices: number[] = [];
  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRe.exec(body)) !== null) {
    openIndices.push(openMatch.index);
  }
  for (let i = openIndices.length - 1; i >= 0; i--) {
    const openIdx = openIndices[i];
    const openTag = out.slice(openIdx).match(/^```json\s*\n/i)?.[0];
    if (!openTag) continue;
    const contentStart = openIdx + openTag.length;
    const closeIdx = out.indexOf("```", contentStart);
    if (closeIdx === -1) continue;
    const inner = out.slice(contentStart, closeIdx);
    let delta = countJsonBraceDelta(inner);
    if (delta <= 0) continue;

    const tail = out.slice(closeIdx + 3);
    const braceLine = tail.match(/\n\}\s*\n(?:```[ \t]*\n)?/);
    if (!braceLine || braceLine.index === undefined) continue;

    const newInner = `${inner.trimEnd()}\n}\n`;
    const repairedInner = repairJsonCodeBlockInner(newInner);
    const newBlock = `\`\`\`json\n${repairedInner}\n\`\`\``;
    const removeStart = closeIdx + 3 + braceLine.index;
    const removeEnd = closeIdx + 3 + braceLine.index + braceLine[0].length;
    const preserved = out.slice(closeIdx + 3, removeStart);
    out = out.slice(0, openIdx) + newBlock + preserved + out.slice(removeEnd);
  }
  return out;
}

/**
 * Asegura que el bloque ```sql de la sección 2 esté cerrado con ``` antes de ```mermaid, ```TechnicalMetadata o ###.
 * Así formatSqlBlockWithNewlines puede encontrar el bloque y formatear columnas por línea.
 */
export function ensureSection2SqlBlockClosed(draft: string): string {
  const modeloHeading = "## 3. Modelo de Datos";
  const modeloIdx = draft.indexOf(modeloHeading);
  if (modeloIdx === -1) return draft;
  const sectionStart = modeloIdx + modeloHeading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const sqlMatch = body.match(/```sql\s*/i);
  if (!sqlMatch || sqlMatch.index == null) return draft;
  const sqlOpen = sqlMatch.index + sqlMatch[0].length;
  const afterSql = body.slice(sqlOpen);
  const nextFence = afterSql.search(/```/);
  if (nextFence === -1) {
    const beforeDiagram = afterSql.search(/\n###\s*Diagrama|\n```(?:mermaid|TechnicalMetadata)/i);
    if (beforeDiagram === -1) return draft;
    const insertPos = sqlOpen + beforeDiagram;
    const newBody = body.slice(0, insertPos) + "\n```\n\n" + body.slice(insertPos);
    const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
    return draft.slice(0, sectionStart) + newBody + afterSection;
  }
  const fencePosInBody = sqlOpen + nextFence;
  const afterBackticks = body.slice(fencePosInBody + 3, fencePosInBody + 20);
  const isClosingFence = /^\s*\n|^\s*$/.test(afterBackticks) || afterBackticks === "";
  if (isClosingFence) return draft;
  const isOpenOfOther = /^\s*mermaid|^\s*TechnicalMetadata|^\s*sql\s/i.test(afterBackticks);
  if (!isOpenOfOther) return draft;
  const newBody = body.slice(0, fencePosInBody) + "\n```\n\n" + body.slice(fencePosInBody);
  const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
  return draft.slice(0, sectionStart) + newBody + afterSection;
}

/**
 * Asegura que en la sección 2 el bloque ```sql tenga saltos de línea (cada CREATE TABLE y cada columna).
 * Si el bloque no está cerrado con ```, lo cierra antes de ### Diagrama o ```mermaid/TechnicalMetadata y luego formatea.
 */
export function ensureSection2SqlFormattedInSection(draft: string): string {
  let sqlBlockMatch = draft.match(/```sql\s*([\s\S]*?)```/);
  let sqlStart = 0;
  let inner = "";
  let sqlEnd = 0;

  if (sqlBlockMatch && sqlBlockMatch.index != null) {
    sqlStart = sqlBlockMatch.index;
    inner = sqlBlockMatch[1];
    sqlEnd = sqlBlockMatch.index + sqlBlockMatch[0].length;
  } else {
    const openMatch = draft.match(/```sql\s*/i);
    if (!openMatch || openMatch.index == null) return draft;
    const afterOpen = draft.slice(openMatch.index + openMatch[0].length);
    const endMatch = afterOpen.match(/\n(```(?:mermaid|TechnicalMetadata)|\s*###\s*Diagrama)/i);
    const endPos = endMatch ? endMatch.index! : afterOpen.length;
    inner = afterOpen.slice(0, endPos).trimEnd();
    if (!inner || !/CREATE\s+TABLE/i.test(inner)) return draft;
    sqlStart = openMatch.index;
    sqlEnd = openMatch.index + openMatch[0].length + endPos;
  }

  const sanitized = sanitizeSqlBrokenCommentsAndProse(inner);
  const formatted = formatSqlBlockWithNewlines(sanitized);
  const before = draft.slice(0, sqlStart + "```sql\n".length);
  const after = draft.slice(sqlEnd);
  return before + formatted + "\n```\n\n" + after;
}

/**
 * Corrige formato de sección Integración cuando el LLM devolvió cada línea como viñeta (ej. "- ### 6.1" -> "### 6.1").
 */
export function fixIntegrationSectionBullets(sectionBody: string): string {
  if (!sectionBody || typeof sectionBody !== "string") return sectionBody;
  return sectionBody
    .replace(/^-\s*(###\s)/gm, "$1")
    .replace(/^-\s*(\*\*[^*]+\*\*:)/gm, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convierte cuerpo de §6 que es JSON con viñetas (ej. "- \"## Seguridad\": { - \"Key\": \"value\" - }")
 * a markdown legible (### Key, - value). Devuelve null si no aplica o el parse falla.
 */
export function fixSection6BulletedJsonToMarkdown(sectionBody: string): string | null {
  if (!sectionBody || typeof sectionBody !== "string") return null;
  let trimmed = sectionBody
    .replace(/^\s*\{:?\s*\n?/, "")
    .replace(/(\n\s*-\s*)+$/, "")
    .replace(/\n\s*---\s*$/, "")
    .trim();
  trimmed = trimmed
    .replace(/\n\s*-\s*}\s*\n\s*-\s*}\s*$/, "\n}\n}")
    .replace(/\n\s*-\s*}\s*$/, "\n}")
    .replace(/\n\s*-\s*}\s*(?=\n)/g, "\n}\n")
    .trim();
  const candidate = unbulletAndJoinForJson(trimmed);
  const firstBrace = candidate.indexOf("{");
  if (firstBrace === -1) return null;
  const braceEnd = findBalancedBraceRespectingStrings(candidate, firstBrace);
  if (braceEnd === -1) return null;
  try {
    const jsonStr = candidate.slice(firstBrace, braceEnd + 1);
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const inner = obj["## Seguridad"] ?? obj["6. Seguridad"] ?? obj["6.Seguridad"];
    const toConvert =
      inner !== null && typeof inner === "object" && !Array.isArray(inner)
        ? (inner as Record<string, unknown>)
        : obj;
    const md = nestedSectionKeysToMarkdown(toConvert);
    return md || null;
  } catch {
    return null;
  }
}

/**
 * Corrige formato de sección 6 Seguridad cuando el LLM devolvió subsecciones como viñetas (ej. "- 6.1 X" -> "### 6.1 X").
 */

/** Colapsa `--- --- ---` en la misma línea o consecutivos; normaliza `--`/`-` sueltos como separadores. */

/**
 * Cierra fences ``` sin cierre antes de `---` + ## o de otro H2 (manifest §7, SQL §3).
 */

/** Elimina fences ``` vacíos o de apertura suelta antes de H2/---. */

/** Desenvuelve fences ``` sin lenguaje que encierran prosa tras un encabezado. */

/** Quita `)` suelto en línea propia antes de §7 o cualquier H2. */

/**
 * Si el cuerpo de la sección Integración tiene un manifest JSON con stack no vacío y sin "pending",
 * reemplaza encabezados "### Nota/Pendiente", "### Nota", "### Pendiente" por "### Manifest de Infraestructura".
 * Así no se etiqueta como pendiente cuando el manifest ya está definido.
 */
export function stripNotaPendienteHeadingInIntegrationSection(sectionBody: string): string {
  if (!sectionBody || typeof sectionBody !== "string") return sectionBody;
  const jsonMatch = sectionBody.match(/```json\s*\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) return sectionBody;
  try {
    const obj = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    const stack = obj.stack;
    const pending = obj.pending;
    const hasStack = Array.isArray(stack) && stack.length > 0;
    const hasNoPending = pending == null || (typeof pending === "string" && !pending.trim());
    if (!hasStack || !hasNoPending) return sectionBody;
  } catch {
    return sectionBody;
  }
  return sectionBody
    .replace(/###\s*Nota\s*\/\s*Pendiente\s*$/gim, "### Manifest de Infraestructura")
    .replace(/###\s*Nota\s*\/?\s*Pendiente\s*$/gim, "### Manifest de Infraestructura")
    .replace(/###\s*Pendiente\s*$/gim, "### Manifest de Infraestructura")
    .replace(/###\s*Nota\s*$/gim, "### Manifest de Infraestructura");
}

/**
 * Si la sección 7 (Infraestructura) tiene ###/#### Manifest seguido de "stack"/"pending" sin ```json
 * (o como lista - "stack": [] / - "pending": "..."), lo envuelve en ```json válido.
 */
export function ensureManifestInJsonBlock(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const infrHeading = draft.search(/\n##\s+(?:7\.\s+)?(?:Infraestructura|Integración)\b/i);
  if (infrHeading === -1) return draft;
  const sectionStart = draft.indexOf("\n", infrHeading) + 1;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const manifestMatch = body.match(/\n(#{3,4})\s+Manifest(?:\s+de\s+Infraestructura)?\s*\n+/i);
  if (!manifestMatch || manifestMatch.index == null) return draft;
  const manifestH3 = manifestMatch.index;
  const afterManifest = body.slice(manifestH3 + manifestMatch[0].length).trim();
  if (/```json\s/i.test(afterManifest.slice(0, 100))) return draft;
  // Si el contenido es JSON crudo (empieza con {), envolver en ```json
  if (afterManifest.startsWith("{")) {
    const braceEnd = findBalancedBrace(afterManifest, 0);
    if (braceEnd !== -1) {
      try {
        const obj = JSON.parse(afterManifest.slice(0, braceEnd + 1)) as Record<string, unknown>;
        const jsonBlock = "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
        const restAfter = afterManifest.slice(braceEnd + 1).trim();
        const beforeManifest = body.slice(0, manifestH3) + "\n### Manifest\n\n";
        const newBody = beforeManifest + jsonBlock + (restAfter ? "\n\n" + restAfter : "");
        return draft.slice(0, sectionStart) + newBody + draft.slice(sectionStart + body.length);
      } catch {
        /* fall through to stack/pending extraction */
      }
    }
  }
  // Contenido en líneas sueltas o lista: "stack": [] / "pending": "..."
  const raw = afterManifest.replace(/^-\s*/gm, "").replace(/\n-\s*/g, "\n");
  const stackMatch = raw.match(/"stack"\s*:\s*(\[[\s\S]*?\])/);
  const pendingMatch = raw.match(/"pending"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!stackMatch && !pendingMatch) return draft;
  let stack: unknown[] = [];
  if (stackMatch) {
    try {
      stack = JSON.parse(stackMatch[1].replace(/\s+/g, " "));
    } catch {
      stack = [];
    }
  }
  const pending = pendingMatch ? pendingMatch[1].replace(/\\"/g, '"') : "Definir con el usuario: orquestación y despliegue";
  const jsonBlock = "```json\n" + JSON.stringify({ stack, pending }, null, 2) + "\n```";
  const beforeManifest = body.slice(0, manifestH3) + "\n### Manifest\n\n";
  const afterManifestEnd = afterManifest.search(/\n#{3,4}\s+|\n##\s+|$/);
  const restAfter = afterManifestEnd !== -1 ? afterManifest.slice(afterManifestEnd) : "";
  const newBody = beforeManifest + jsonBlock + (restAfter ? "\n\n" + restAfter.trim() : "");
  const bodyEnd = sectionStart + body.length;
  return draft.slice(0, sectionStart) + newBody + draft.slice(bodyEnd);
}

/**
 * Aplica stripNotaPendienteHeadingInIntegrationSection al cuerpo de ## 7. Infraestructura / ## Integración.
 */
export function stripNotaPendienteHeadingWhenManifestComplete(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const match = draft.match(/\n(##\s+(?:7\.\s+)?(?:Infraestructura|Integración)\b[^\n]*)/i);
  if (!match || match.index == null) return draft;
  const sectionStart = match.index + match[0].length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const newBody = stripNotaPendienteHeadingInIntegrationSection(body);
  if (newBody === body) return draft;
  const sectionEnd = nextH2 !== -1 ? sectionStart + nextH2 : draft.length;
  return draft.slice(0, sectionStart) + newBody + draft.slice(sectionEnd);
}

/** Busca una clave en obj de forma case-insensitive. */
function getKeyIgnoreCase(obj: Record<string, unknown>, key: string): string | undefined {
  const lower = key.toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return found;
}

/**
 * Convierte un objeto JSON a título + viñetas: acepta { section|heading + details } o { title + content }.
 * Lectura de claves case-insensitive (Title, Content, etc.).
 */
function jsonBlockToMarkdownLines(obj: Record<string, unknown>): { title: string; items: string[] } | null {
  const titleKey = getKeyIgnoreCase(obj, "title") ?? getKeyIgnoreCase(obj, "section") ?? getKeyIgnoreCase(obj, "heading");
  const title = titleKey != null && typeof obj[titleKey] === "string" ? String(obj[titleKey]).trim() : null;
  const contentKey = getKeyIgnoreCase(obj, "content") ?? getKeyIgnoreCase(obj, "details");
  const arr = contentKey != null && Array.isArray(obj[contentKey]) ? obj[contentKey] : null;
  if (!title || !arr) return null;
  const items = arr.map((d) => (typeof d === "string" ? d : String(d)).trim()).filter(Boolean);
  return { title, items };
}

/**
 * Convierte bloques JSON con forma { "section"|"heading"|"title": "...", "details"|"content": ["..."] } a markdown (### título, - ítem).
 * También acepta un único objeto { "sections": [ { title, content }, ... ] }.
 * Usado cuando el LLM devuelve Seguridad como varios objetos JSON en lugar de markdown.
 */
function convertSectionDetailsJsonToMarkdown(body: string): string {
  const trimmedBody = body.replace(/^\s*###\s*sections\s*\n+/i, "").trim();

  // Formato: único objeto con clave "sections" (array de { title, content })
  const firstBrace = trimmedBody.indexOf("{");
  if (firstBrace !== -1) {
    const braceEnd = findBalancedBrace(trimmedBody, firstBrace);
    if (braceEnd !== -1) {
      try {
        const singleJson = trimmedBody.slice(firstBrace, braceEnd + 1);
        const obj = JSON.parse(singleJson) as Record<string, unknown>;
        const sectionsKey = getKeyIgnoreCase(obj, "sections");
        const sections = sectionsKey != null && Array.isArray(obj[sectionsKey]) ? obj[sectionsKey] : null;
        if (sections && sections.length > 0) {
          const sectionLines: string[] = [];
          for (const item of sections) {
            if (!item || typeof item !== "object" || Array.isArray(item)) continue;
            const parsed = jsonBlockToMarkdownLines(item as Record<string, unknown>);
            if (parsed) {
              sectionLines.push("", `### ${parsed.title}`, "");
              for (const i of parsed.items) sectionLines.push(`- ${i}`);
            }
          }
          if (sectionLines.length > 0) return sectionLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch {
        // fall through to per-object parsing
      }
    }
  }

  const result: string[] = [];
  const jsonStart = /\{\s*"(?:section|heading|title)"\s*:/i;
  let remaining = trimmedBody;
  let braceStart = remaining.search(jsonStart);
  while (braceStart !== -1) {
    const before = remaining.slice(0, braceStart).trim();
    if (before) result.push(before);
    const braceEnd = findBalancedBrace(remaining, braceStart);
    if (braceEnd === -1) break;
    try {
      const jsonStr = remaining.slice(braceStart, braceEnd + 1);
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      const parsed = jsonBlockToMarkdownLines(obj);
      if (parsed) {
        result.push("", `### ${parsed.title}`, "");
        for (const item of parsed.items) result.push(`- ${item}`);
      }
      remaining = remaining.slice(braceEnd + 1).replace(/^\s*\n+/, "\n");
    } catch {
      remaining = remaining.slice(braceStart + 1);
    }
    braceStart = remaining.search(jsonStart);
  }
  if (remaining.trim()) result.push(remaining.trim());
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convierte un body que es (o empieza con) un objeto JSON cuyas claves son headings markdown ("### Flujo de integración", etc.)
 * a markdown legible: cada clave → ### Título (sin duplicar ###), valor como párrafo o lista/objeto legible.
 */
function convertIntegrationHeadingKeysObjectToMarkdown(body: string): string {
  let trimmed = body.replace(/^\s*###\s*##\s*Integración\s*\n+/i, "").trim();
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1 || !trimmed.includes('"')) return body;
  const braceEnd = findBalancedBrace(trimmed, firstBrace);
  if (braceEnd === -1) return body;
  try {
    const jsonStr = trimmed.slice(firstBrace, braceEnd + 1);
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const keys = Object.keys(obj);
    const hasHeadingKeys = keys.some((k) => k.includes("###"));
    if (!hasHeadingKeys) return body;
    const lines: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const heading = key.trim().startsWith("###") ? key.trim() : `### ${key}`;
      lines.push("", heading, "");
      if (typeof val === "string") {
        lines.push(val.trim());
      } else if (Array.isArray(val)) {
        for (const item of val) lines.push(typeof item === "string" ? `- ${item}` : `- ${JSON.stringify(item)}`);
      } else if (val !== null && typeof val === "object") {
        const rec = val as Record<string, unknown>;
        if (rec.stack !== undefined || rec.pending !== undefined) {
          if (Array.isArray(rec.stack)) lines.push("- **stack:** " + (rec.stack.length ? rec.stack.join(", ") : "[]"));
          if (typeof rec.pending === "string" && rec.pending.trim()) lines.push("- **pending:** " + rec.pending.trim());
        } else {
          lines.push("```json\n" + JSON.stringify(val, null, 2) + "\n```");
        }
      }
    }
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return body;
  }
}

/**
 * Detecta si el body está "contaminado": lista de viñetas donde cada línea es un fragmento de JSON
 * (ej. " - {", " - \"title\": \"## Seguridad\",", " - \"content\": [") en vez de un bloque JSON parseable.
 */
function isBulletListAsJsonLines(body: string): boolean {
  const trimmed = body.replace(/^\s*\n+/, "").trim();
  const lines = trimmed.split(/\n/);
  const bulletLines = lines.filter((line) => /^\s*-\s+/.test(line));
  if (bulletLines.length < 3) return false;
  const rest = bulletLines.map((l) => l.replace(/^\s*-\s*/, "").trim()).join(" ");
  const hasTitleOrHeading = /"title"\s*:/i.test(rest) || /"heading"\s*:/i.test(rest);
  const hasContentOrDetails = /"content"\s*:\s*\[/i.test(rest) || /"details"\s*:\s*\[/i.test(rest);
  const hasNestedSectionKeys = /"\s*6\.\s*Seguridad"\s*:\s*\{/i.test(rest) || /"\s*6\.\d+\s+/.test(rest);
  const hasDescriptionMeasures =
    /"description"\s*:/i.test(rest) || /"measures"\s*:\s*\[/i.test(rest) || /"considerations"\s*:\s*\[/i.test(rest);
  return (hasTitleOrHeading && hasContentOrDetails) || hasNestedSectionKeys || (rest.includes("{") && hasDescriptionMeasures);
}

/**
 * Quita el prefijo de viñeta de cada línea y opcionalmente inserta comas para obtener JSON válido
 * (entre } y { o ] y { que suelen faltar cuando el JSON fue volcado línea a línea).
 */
export function unbulletAndJoinForJson(body: string): string {
  const lines = body.split(/\n/);
  const unbulleted = lines.map((line) => line.replace(/^\s*-\s*/, "").trim());
  let joined = unbulleted.join("\n");
  // Insert comma between } or ] and newline and { (array/object elements)
  joined = joined.replace(/\}\s*\n\s*\{/g, "},\n{");
  joined = joined.replace(/\]\s*\n\s*\{/g, "],\n{");
  // Comma between ] or } and newline and " (next key in object)
  joined = joined.replace(/\]\s*\n\s*"/g, "],\n\"");
  joined = joined.replace(/\}\s*\n\s*"/g, "},\n\"");
  return joined;
}

/**
 * Convierte un objeto raíz con "content" como array de objetos { heading/title, details/content }
 * a markdown (### título + viñetas). Usado cuando el JSON contaminado tiene esa forma.
 */
function objectWithContentArrayToMarkdown(obj: Record<string, unknown>): string | null {
  const contentKey = getKeyIgnoreCase(obj, "content");
  const content = contentKey != null ? obj[contentKey] : undefined;
  if (!Array.isArray(content) || content.length === 0) return null;
  const first = content[0];
  const isArrayOfObjects =
    typeof first === "object" && first !== null && !Array.isArray(first);
  if (!isArrayOfObjects) return null;
  const sectionLines: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const parsed = jsonBlockToMarkdownLines(rec);
    if (parsed) {
      const heading = parsed.title.replace(/^#+\s*/, "").trim();
      sectionLines.push("", `### ${heading}`, "");
      for (const i of parsed.items) sectionLines.push(`- ${i}`);
    }
  }
  if (sectionLines.length === 0) return null;
  return sectionLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Convierte objeto con claves tipo "6. Seguridad": { "6.1 X": { "A": "texto" }, "6.2 Y": {...} } a markdown (### 6.1 X, - **A**: texto). */
function nestedSectionKeysToMarkdown(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const heading = key.trim().startsWith("###") ? key.trim() : `### ${key}`;
    lines.push("", heading, "");
    if (Array.isArray(val)) {
      for (const item of val) lines.push(typeof item === "string" ? `- ${item}` : `- ${JSON.stringify(item)}`);
    } else if (typeof val === "string" && val.trim()) {
      lines.push(`- ${val.trim()}`);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const rec = val as Record<string, unknown>;
      const allStrings = Object.values(rec).every((v) => typeof v === "string");
      if (allStrings && Object.keys(rec).length > 0) {
        for (const [k, v] of Object.entries(rec))
          if (typeof v === "string" && v.trim()) lines.push(`- **${k}**: ${v.trim()}`);
      } else {
        const nested = nestedSectionKeysToMarkdown(rec);
        if (nested) lines.push(nested);
      }
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convierte objeto con description (string), measures y considerations (array de { name, details }) a markdown.
 * Formato típico del nodo Security cuando devuelve JSON en viñetas.
 */
function descriptionMeasuresConsiderationsToMarkdown(obj: Record<string, unknown>): string | null {
  const lines: string[] = [];
  const desc = obj.description;
  if (typeof desc === "string" && desc.trim()) {
    lines.push(desc.trim(), "");
  }
  const measures = Array.isArray(obj.measures) ? obj.measures : [];
  for (const m of measures) {
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const rec = m as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : "Medida";
    const details = typeof rec.details === "string" ? rec.details : String(rec.details ?? "").trim();
    lines.push("### " + name, "", details ? `- ${details}` : "", "");
  }
  const considerations = Array.isArray(obj.considerations) ? obj.considerations : [];
  for (const c of considerations) {
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const rec = c as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : "Consideración";
    const details = typeof rec.details === "string" ? rec.details : String(rec.details ?? "").trim();
    lines.push("### " + name, "", details ? `- ${details}` : "", "");
  }
  if (lines.length === 0) return null;
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Descontamina un body que es "bullet list as JSON lines": quita prefijo de viñeta, reconstruye JSON,
 * parsea y convierte a markdown. Devuelve null si no aplica o el parse falla.
 */
function unbulletAndParseSectionJson(body: string): string | null {
  const trimmed = body.replace(/^\s*###\s*sections\s*\n+/i, "").trim().replace(/^\s*###\s*Seguridad\s*\n+/i, "").trim();
  const candidate = unbulletAndJoinForJson(trimmed);
  try {
    const firstBrace = candidate.indexOf("{");
    if (firstBrace === -1) return null;
    const braceEnd = findBalancedBraceRespectingStrings(candidate, firstBrace);
    if (braceEnd === -1) return null;
    const jsonStr = candidate.slice(firstBrace, braceEnd + 1);
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const descMeasures = descriptionMeasuresConsiderationsToMarkdown(obj);
    if (descMeasures) return descMeasures;
    const withContentArray = objectWithContentArrayToMarkdown(obj);
    if (withContentArray) return withContentArray;
    const sectionsKey = getKeyIgnoreCase(obj, "sections");
    const sections = sectionsKey != null && Array.isArray(obj[sectionsKey]) ? obj[sectionsKey] : null;
    if (sections && sections.length > 0) {
      const sectionLines: string[] = [];
      for (const item of sections) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const parsed = jsonBlockToMarkdownLines(item as Record<string, unknown>);
        if (parsed) {
          sectionLines.push("", `### ${parsed.title}`, "");
          for (const i of parsed.items) sectionLines.push(`- ${i}`);
        }
      }
      if (sectionLines.length > 0) return sectionLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    const singleBlock = jsonBlockToMarkdownLines(obj);
    if (singleBlock) {
      const lines: string[] = ["", `### ${singleBlock.title}`, ""];
      for (const i of singleBlock.items) lines.push(`- ${i}`);
      return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    if (/"6\.\s*Seguridad"/i.test(jsonStr) || Object.keys(obj).some((k) => /^\d+\.\d+\s/.test(k) || /^6\.\s*Seguridad$/i.test(k))) {
      const nested = nestedSectionKeysToMarkdown(obj);
      if (nested) return nested;
      const inner = obj["6. Seguridad"] ?? obj["6.Seguridad"];
      if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
        const innerMd = nestedSectionKeysToMarkdown(inner as Record<string, unknown>);
        if (innerMd) return innerMd;
      }
    }
  } catch {
    // parse failed
  }
  return null;
}

/** Busca la primera ocurrencia de ## Heading que esté al inicio del documento o tras un salto de línea (evita matchear dentro de sección 2). */
function findSectionStart(draft: string, heading: string): number {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\n)(${escaped})\\b`);
  const match = draft.match(re);
  if (!match || match.index == null) return -1;
  return match.index + (match[0].startsWith("\n") ? 1 : 0);
}

/** Busca una sección por el primero de varios headings (ej. "## 6. Seguridad" o "## Seguridad"). */
function findSectionStartAny(draft: string, headings: string[]): { index: number; heading: string } | null {
  let best: { index: number; heading: string } | null = null;
  for (const h of headings) {
    const idx = findSectionStart(draft, h);
    if (idx !== -1 && (best == null || idx < best.index)) best = { index: idx, heading: h };
  }
  return best;
}

/**
 * En secciones ## Seguridad y ## Integración, reemplaza viñetas que son JSON crudo (ej. "- {\"subsections\":[...]}")
 * o bloques { "section"|"heading"|"title": "...", "details"|"content": [...] } por markdown legible (### título, - ítem).
 * Para ## Integración también convierte objeto con claves "### Flujo de integración", etc.
 */
const SEGURIDAD_HEADINGS = ["## 6. Seguridad", "## Seguridad"];
const INTEGRACION_HEADINGS = ["## 7. Infraestructura", "## Integración"];

export function sanitizeSeguridadIntegracionRawJson(draft: string): string {
  let out = draft;
  for (const [headings, isIntegration] of [
    [SEGURIDAD_HEADINGS, false] as const,
    [INTEGRACION_HEADINGS, true] as const,
  ]) {
    const found = findSectionStartAny(out, headings as string[]);
    if (!found) continue;
    const { index: idx, heading } = found;
    const sectionStart = idx + heading.length;
    const rest = out.slice(sectionStart);
    const nextH2 = rest.search(/\n##\s+/);
    const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
    const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";

    if (isIntegration) {
      const bodyTrimmed = body.replace(/^\s*\n+/, "").trim().replace(/^###\s*##\s*Integración\s*\n+/i, "").trim();
      const hasIntegrationHeadingKeysJson =
        bodyTrimmed.startsWith("{") && /"\s*###\s+[^"]+"\s*:/.test(bodyTrimmed);
      if (hasIntegrationHeadingKeysJson) {
        const newBody = convertIntegrationHeadingKeysObjectToMarkdown(body);
        out = out.slice(0, sectionStart) + "\n\n" + newBody + afterSection;
        continue;
      }
    }

    // Bloques JSON: section/heading/details, title/content, { "sections": [...] }, o "### sections" + objetos { title, content }
    const hasSectionHeadingJson = /\{\s*"(?:section|heading)"\s*:/i.test(body);
    const hasTitleContentJson = /\{\s*"title"\s*:/i.test(body) && /\b"content"\s*:\s*\[/.test(body);
    const hasSectionsArrayJson = /\{\s*"sections"\s*:\s*\[/i.test(body);
    const hasSectionsHeadingWithTitleContent =
      /###\s*sections/i.test(body) && /"title"\s*:/.test(body) && /"content"\s*:/.test(body);
    if (hasSectionHeadingJson || hasTitleContentJson || hasSectionsArrayJson || hasSectionsHeadingWithTitleContent) {
      const newBody = convertSectionDetailsJsonToMarkdown(body);
      out = out.slice(0, sectionStart) + "\n\n" + newBody + afterSection;
      continue;
    }
    const bulletStart = body.search(/^-\s*\{\s*"subsections"\s*:/m);
    if (bulletStart !== -1) {
      const braceStart = body.indexOf("{", bulletStart);
      const braceEnd = findBalancedBrace(body, braceStart);
      if (braceEnd !== -1) {
        try {
          const jsonStr = body.slice(braceStart, braceEnd + 1);
          const obj = JSON.parse(jsonStr) as Record<string, unknown>;
          const subMd = subsectionsToMarkdown(obj);
          if (subMd) {
            const newBody = body.slice(0, bulletStart) + subMd + body.slice(braceEnd + 1).replace(/^\s*\n?/, "\n\n");
            out = out.slice(0, sectionStart) + newBody + afterSection;
            continue;
          }
        } catch {
          // fall through to bullet-list-as-JSON-lines
        }
      }
    }

    // Bullet list as JSON lines (contaminated: each line is a bullet with a JSON fragment)
    if (isBulletListAsJsonLines(body)) {
      const newBody = unbulletAndParseSectionJson(body);
      if (newBody != null) {
        out = out.slice(0, sectionStart) + "\n\n" + newBody + afterSection;
      }
    }
  }
  return out;
}

const CONTEXTO_JSON_KEY_LABELS: Record<string, string> = {
  objective: "Objetivo",
  goal: "Objetivo",
  audience: "Audiencia",
  includeMetadata: "Incluir metadatos",
  scope: "Alcance",
  technologies: "Tecnologías",
  techStack: "Stack tecnológico",
  focus: "Enfoque",
  requirements: "Requisitos",
  keyCompetitors: "Competidores de referencia",
  keyFeatures: "Características clave",
  marketOpportunities: "Oportunidades de mercado",
};

/**
 * Si la sección "## 1. Contexto" (o "## 1. Contexto y alcance") contiene un bloque JSON,
 * lo reemplaza por viñetas en markdown. Arrays → sublista con guiones. Evita JSON crudo en §1.
 */
const CONTEXTO_HEADINGS = ["## 1. Contexto y alcance", "## 1. Contexto", "## Contexto y alcance"];

function contextJsonValueToMarkdown(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) {
    return v
      .filter((item) => item != null && String(item).trim() !== "")
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .map((s) => `  - ${s}`)
      .join("\n");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function sanitizeContextSection(draft: string): string {
  let idx = -1;
  let heading = "";
  for (const h of CONTEXTO_HEADINGS) {
    const i = draft.indexOf(h);
    if (i !== -1) {
      idx = i;
      heading = h;
      break;
    }
  }
  if (idx === -1) return draft;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = (nextH2 !== -1 ? rest.slice(0, nextH2) : rest).replace(/^\s*\n+/, "").trim();
  const braceInBody = body.indexOf("{");
  if (braceInBody === -1 || !body.includes('"')) return draft;
  const endOfSection = nextH2 !== -1 ? sectionStart + nextH2 : draft.length;
  const start = draft.indexOf("{", sectionStart);
  if (start < sectionStart || start >= endOfSection) return draft;
  let depth = 0;
  let end = start;
  for (let i = start; i < endOfSection; i++) {
    const c = draft[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (depth !== 0) return draft;
  try {
    const jsonStr = draft.slice(start, end);
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const bullets = Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => {
        const label = CONTEXTO_JSON_KEY_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, " $1").trim();
        const val = contextJsonValueToMarkdown(v);
        if (val.includes("\n")) return `- **${label}:**\n${val}`;
        return `- **${label}:** ${val}`;
      })
      .join("\n");
    return draft.slice(0, start) + bullets + draft.slice(end);
  } catch {
    return draft;
  }
}

/**
 * En la sección "## 1. Contexto y alcance": reemplaza [object Object] por texto legible y convierte
 * viñetas key: value (objective, technologies, focus, requirements) en prosa breve cuando sea solo metadatos.
 */
export function sanitizeContextKeyValueAndObject(draft: string): string {
  const heading = "## 1. Contexto y alcance";
  const idx = draft.indexOf(heading);
  if (idx === -1) return draft;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = (nextH2 !== -1 ? rest.slice(0, nextH2) : rest).replace(/^\s*\n+/, "").trim();
  const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
  let newBody = body
    .replace(/\[object\s+Object\]/gi, "(stack tecnológico)")
    .replace(/\*\*technologies:\*\*\s*\[object\s+Object\]/gi, "**Tecnologías:** NestJS, PostgreSQL, React (según alcance).");
  const keyValueBullet = /^-\s+\*\*(objective|technologies|focus|requirements|scope)\*\*[:\s]+/im;
  if (keyValueBullet.test(newBody) && newBody.split(/\n/).length <= 8) {
    const lines = newBody.split(/\n/).map((line) => {
      const m = line.match(/^-\s+\*\*(objective|technologies|focus|requirements|scope)\*\*[:\s]+(.*)$/i);
      if (m) return `- **${m[1].charAt(0).toUpperCase() + m[1].slice(1)}:** ${m[2].trim()}`;
      return line;
    });
    newBody = lines.join("\n");
  }
  return draft.slice(0, sectionStart) + "\n\n" + newBody + (afterSection ? "\n\n" + afterSection : "");
}

const CONTRATOS_PLACEHOLDER =
  "\n\n## 4. Contratos de API\n\n(Falta: definir endpoints con request/response en JSON. El Auditor ha detectado este hueco; en la siguiente iteración se deben completar los contratos.)\n\n";


const CONTRATOS_BODY_FALTA =
  "(Falta: definir endpoints con request/response en JSON. El Auditor ha detectado este hueco; en la siguiente iteración se deben completar los contratos.)";

/** Cuerpo de sección 3 que es solo el placeholder perezoso (con o sin paréntesis). */
const PENDIENTE_CONTRATOS_REGEX = /^\s*\(?\s*Pendiente:\s*definir\s+endpoints[\s\S]*?\)?\s*$/i;

/**
 * Asegura que el MDD tenga la sección "## 4. Contratos de API" antes de "## 6. Seguridad".
 * Si falta, la inserta con un placeholder. Si existe pero el cuerpo es solo "Pendiente: definir endpoints...", lo reemplaza por el texto "Falta: ...".
 */
export function ensureContratosSection(draft: string): string {
  const trimmed = (draft || "").trim();
  if (!trimmed) return draft;
  const contratosMatch = trimmed.match(/##\s*4\.\s*Contratos de API|##\s*3\.\s*Contratos de API|##\s*Contratos de API/i);
  if (contratosMatch) {
    const idx = trimmed.indexOf(contratosMatch[0]);
    const afterHeading = trimmed.slice(idx + contratosMatch[0].length).replace(/^\s*\n+/, "");
    const nextH2 = afterHeading.search(/\n##\s+/);
    const body = (nextH2 !== -1 ? afterHeading.slice(0, nextH2) : afterHeading).trim();
    if (body && PENDIENTE_CONTRATOS_REGEX.test(body)) {
      const sectionStart = idx + contratosMatch[0].length;
      const bodyStart = trimmed.indexOf(body, sectionStart);
      const bodyEnd = bodyStart + body.length;
      return (
        trimmed.slice(0, bodyStart) +
        "\n\n" +
        CONTRATOS_BODY_FALTA +
        "\n\n" +
        trimmed.slice(bodyEnd)
      ).trim();
    }
    return draft;
  }
  const seguridadIdx = trimmed.search(/\n##\s+(?:6\.\s+)?Seguridad/i);
  if (seguridadIdx !== -1) {
    return trimmed.slice(0, seguridadIdx) + CONTRATOS_PLACEHOLDER + trimmed.slice(seguridadIdx);
  }
  const integracionIdx = trimmed.search(/\n##\s+(?:7\.\s+)?(?:Infraestructura|Integración)\b/i);
  if (integracionIdx !== -1) {
    return trimmed.slice(0, integracionIdx) + CONTRATOS_PLACEHOLDER + trimmed.slice(integracionIdx);
  }
  return trimmed + CONTRATOS_PLACEHOLDER.trim();
}

/**
 * Subtítulos en inglés que el LLM suele copiar del brief del usuario; se reemplazan por español canónico.
 * Orden: frases más largas / específicas primero.
 */
const ENGLISH_SUBHEADING_TO_ES: Array<{ pattern: RegExp; replacement: string }> = [
  // §1
  {
    pattern:
      /\*\*1\.1\.\s*Project\s+Vision\s*(?:&|and)\s*Objectives(?:\s*\([^)]*\))?\s*:\s*\*\*/gi,
    replacement: "**1.1. Visión y objetivos del producto:**",
  },
  {
    pattern: /###\s*1\.1\.\s*Project\s+Vision\s*(?:&|and)\s*Objectives(?:\s*\([^)]*\))?\s*:?/gi,
    replacement: "### 1.1. Visión y objetivos del producto",
  },
  {
    pattern: /\*\*1\.2\.\s*Functional\s+Requirements(?:\s*\([^)]*\))?\s*:\s*\*\*/gi,
    replacement: "**1.2. Requisitos funcionales (formato EARS):**",
  },
  { pattern: /###\s*1\.2\.\s*Functional\s+Requirements(?:\s*\([^)]*\))?\s*:?/gi, replacement: "### 1.2. Requisitos funcionales (formato EARS)" },
  {
    pattern: /\*\*1\.3\.\s*Monetization\s*(?:&|and)\s*Pricing\s+Architecture\s*:\s*\*\*/gi,
    replacement: "**1.3. Monetización y arquitectura de precios:**",
  },
  {
    pattern: /###\s*1\.3\.\s*Monetization\s*(?:&|and)\s*Pricing\s+Architecture\s*:?/gi,
    replacement: "### 1.3. Monetización y arquitectura de precios",
  },
  // §2
  { pattern: /\*\*2\.1\.\s*Technical\s+Architecture\s*:\s*\*\*/gi, replacement: "**2.1. Arquitectura técnica:**" },
  { pattern: /###\s*2\.1\.\s*Technical\s+Architecture\s*:?/gi, replacement: "### 2.1. Arquitectura técnica" },
  { pattern: /\*\*2\.2\.\s*Technical\s+Architecture\s*:\s*\*\*/gi, replacement: "**2.2. Arquitectura técnica (detalle):**" },
  // §6 (seguridad)
  { pattern: /\*\*6\.2\.\s*Identity\s*:\s*\*\*/gi, replacement: "**6.2. Identidad:**" },
  { pattern: /###\s*6\.2\.\s*Identity\s*:?/gi, replacement: "### 6.2. Identidad" },
  { pattern: /\*\*6\.3\.\s*Data\s+Sovereignty\s*:\s*\*\*/gi, replacement: "**6.3. Soberanía de datos:**" },
  { pattern: /###\s*6\.3\.\s*Data\s+Sovereignty\s*:?/gi, replacement: "### 6.3. Soberanía de datos" },
  { pattern: /\*\*6\.4\.\s*Vulnerability\s+Management\s*:\s*\*\*/gi, replacement: "**6.4. Gestión de vulnerabilidades:**" },
  { pattern: /###\s*6\.4\.\s*Vulnerability\s+Management\s*:?/gi, replacement: "### 6.4. Gestión de vulnerabilidades" },
  { pattern: /\*\*6\.5\.\s*Incident\s+Response\s*:\s*\*\*/gi, replacement: "**6.5. Respuesta a incidentes:**" },
  { pattern: /###\s*6\.5\.\s*Incident\s+Response\s*:?/gi, replacement: "### 6.5. Respuesta a incidentes" },
];

/**
 * Normaliza subtítulos frecuentes en inglés (procedentes del brief) a español, sin tocar el cuerpo del texto.
 */
export function normalizeMddEnglishSubheadings(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  let out = draft;
  for (const { pattern, replacement } of ENGLISH_SUBHEADING_TO_ES) {
    out = out.replace(pattern, replacement);
  }
  // `## 6. Seguridad**6.1. Privacidad:**` (H2 pegado a subencabezado en negrita)
  out = out.replace(/(##\s*6\.\s*Seguridad)\*\*(\d+\.\d+)/gi, "$1\n\n**$2");
  return out;
}

/** Títulos canónicos del MDD (7 secciones). */
export const CANONICAL_HEADINGS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^#+\s*Contexto\s*y\s*alcance\s*$/im, replacement: "## 1. Contexto" },
  { pattern: /^#+\s*Arquitectura\s+y\s*Stack\s*$/im, replacement: "## 2. Arquitectura y Stack" },
  { pattern: /^##\s+2\.\s*Arquitectura\s*$/im, replacement: "## 2. Arquitectura y Stack" },
  { pattern: /^##\s+2\.\s*Stack(?:\s+t[eé]cnico)?\s*$/im, replacement: "## 2. Arquitectura y Stack" },
  { pattern: /^#+\s*schemaSQL\s*$/im, replacement: "## 3. Modelo de Datos" },
  { pattern: /^#+\s*Schema\s*SQL\s*$/im, replacement: "## 3. Modelo de Datos" },
  { pattern: /^#+\s*\d\.\s*Modelo\s+(?:de\s+)?datos\s*$/im, replacement: "## 3. Modelo de Datos" },
  { pattern: /^#+\s*Modelo\s+(?:de\s+)?datos\s*$/im, replacement: "## 3. Modelo de Datos" },
  { pattern: /^#+\s*Contratos\s+de\s+API\s*$/im, replacement: "## 4. Contratos de API" },
  { pattern: /^#+\s*Lógica\s+y\s*Edge\s+Cases\s*$/im, replacement: "## 5. Lógica y Edge Cases" },
  { pattern: /^#+\s*Seguridad\s*$/im, replacement: "## 6. Seguridad" },
  { pattern: /^#+\s*Integración\s*$/im, replacement: "## 7. Infraestructura" },
  { pattern: /^#+\s*Infraestructura\s*$/im, replacement: "## 7. Infraestructura" },
  { pattern: /^#+\s*endpoints\s*$/im, replacement: "### Endpoints" },
];

/**
 * Convierte secuencias literales \\n, \\t y \\" en newline, tab y comilla real.
 * Corrige drafts que llegaron escapados (ej. doble JSON) para que el markdown renderice bien.
 */
export function unescapeLiteralNewlines(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  return draft
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

/**
 * Elimina del final del documento el bloque "Respuestas del usuario (incorporar al borrador...)"
 * y todo el historial de conversación que el LLM copió. Ese bloque es contexto para los agentes,
 * no parte del MDD que debe ver el usuario.
 */
export function stripUserResponsesAndConversationHistory(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const markers = [
    /\n\s*\*\*Respuestas del usuario\s*\(incorporar al borrador/i,
    /\n\s*\*\*Respuestas acumuladas del usuario\s*\(/i,
  ];
  for (const re of markers) {
    const match = draft.match(re);
    if (match && match.index != null) {
      return draft.slice(0, match.index).replace(/\n{2,}\s*$/, "\n").trim();
    }
  }
  return draft;
}

/** Inicio de párrafos que son instrucciones/feedback interno; no deben quedar en el documento final. */
const INSTRUCTION_STARTS = [
  /^\s*\*\*Feedback del Auditor\s*\(/i,
  /^\s*Aplica las correcciones que afecten a/i,
  /^\s*Unifica el documento y asegura que los gaps/i,
  /^\s*Opcional:\s*Usa la tool validate_mdd_structure/i,
  /^\s*\*\*Opcional:\s*\*\*.*format_section3_endpoints/i,
  /^\s*\*\*Requisitos o petición del usuario\s*\(incorporar en las secciones/i,
  // Bloques que inyectamos en el contexto del SA; el LLM no debe copiarlos en la salida.
  /^\s*\*\*ACCIÓN REQUERIDA\s*\(usuario aceptó esta propuesta\)\s*:\s*\*\*/i,
  /^\s*\*\*Prioridad\s*\(léelo primero\)\s*:\s*\*\*/i,
  /^\s*Requisitos del usuario\s*\(conversación reciente\)\s*:/im,
  /^\s*Debes aplicar esta directiva al MDD/i,
];

function isInstructionBlock(paragraph: string): boolean {
  const firstLine = paragraph.split("\n")[0]?.trim() ?? "";
  return INSTRUCTION_STARTS.some((re) => re.test(firstLine));
}

/**
 * Elimina del texto párrafos que son instrucciones o feedback interno (Feedback del Auditor, Aplica las correcciones..., Unifica el documento..., Opcional: Usa la tool...).
 * Evita que el LLM haya copiado esas instrucciones al output y queden en el MDD final.
 */
export function stripInstructionAndFeedbackBlocks(text: string): string {
  if (!text || typeof text !== "string") return text;
  const paragraphs = text.split(/\n\n+/);
  const kept = paragraphs.filter((p) => !isInstructionBlock(p));
  return stripMeshDirectivesFromDraft(kept.join("\n\n").replace(/\n{3,}/g, "\n\n").trim());
}

/**
 * Elimina directivas internas del mesh (`[DIRECTIVE: nodo] …`) que el LLM copió al markdown entregable.
 */
export function stripMeshDirectivesFromDraft(draft: string): string {
  return (draft ?? "")
    .replace(/^\s*-\s*\[DIRECTIVE:\s*[\w.]+\]\s*/gim, "- ")
    .replace(/\[DIRECTIVE:\s*[\w.]+\]\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Quita del contenido de un diagrama Mermaid cualquier fence sobrante (```mermaid o ```).
 * Así al envolver con ```mermaid\n...\n``` nunca queda doble apertura/cierre.
 */

/**
 * Dado un objeto parseado con SQL/DiagramaER/TechnicalMetadata, devuelve el markdown canónico de la sección 2.
 * Acepta SQL como string (todo el bloque) o como array de strings.
 */
function section2ObjectToMarkdown(obj: Record<string, unknown>): string {
  const sqlArr = obj.SQL ?? obj.sql;
  const sqlContent =
    typeof sqlArr === "string"
      ? sqlArr.trim()
      : Array.isArray(sqlArr)
        ? (sqlArr as string[]).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean).join("\n\n")
        : "";
  if (!sqlContent || !/CREATE\s+TABLE/i.test(sqlContent)) return "";
  const sqlBlock = "\n\n```sql\n" + sqlContent + "\n```";
  const diagramRaw = (obj.DiagramaER ?? obj.diagramaER ?? obj.diagrama_er ?? obj.erDiagram) as string | undefined;
  let diagramBlock = "";
  if (typeof diagramRaw === "string" && diagramRaw.trim()) {
    const m = diagramRaw.trim().match(/```mermaid\s*([\s\S]*?)```/i);
    const innerContent = m?.[1] ? m[1].trim() : diagramRaw.replace(/^[\s\S]*?```mermaid\s*/i, "").replace(/```\s*$/i, "").trim();
    const content = stripMermaidFences(innerContent || diagramRaw);
    if (content || /erDiagram/i.test(diagramRaw))
      diagramBlock = "\n\n### Diagrama entidad-relación\n\n```mermaid\n" + (content || "erDiagram\n  \n") + "\n```";
  }
  const metaRaw = (obj.technicalMetadata ?? obj.TechnicalMetadata) as string | undefined;
  const metaBlock =
    typeof metaRaw === "string" && metaRaw.trim()
      ? "\n\n```TechnicalMetadata\n" + metaRaw.trim() + "\n```"
      : "\n\n```TechnicalMetadata\n[high_security]\n```";
  return sqlBlock + diagramBlock + metaBlock + "\n\n";
}

/**
 * Convierte sección 2 cuando el cuerpo es JSON con "SQL": string|[] y/o "DiagramaER": "..." (salida mal formada del Experto).
 * Devuelve markdown correcto o null si el cuerpo no es ese JSON.
 */
export function convertSection2JsonBodyToMarkdown(body: string): string | null {
  const t = body.trim();
  if (!t.startsWith("{") || !t.includes("SQL") || !t.includes("CREATE")) return null;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    const out = section2ObjectToMarkdown(obj);
    return out || null;
  } catch {
    return null;
  }
}

/** Unescape JSON string (\\n -> newline, \\" -> ", etc.) para contenido extraído por regex. */
function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/**
 * Cuando el JSON dentro de ```sql es inválido (p. ej. newlines literales en strings), extrae SQL/DiagramaER/TechnicalMetadata por regex.
 */
function section2ObjectFromMalformedJson(inner: string): Record<string, unknown> | null {
  const sqlKey = /"SQL"\s*:\s*"/i.exec(inner)?.[0];
  if (!sqlKey) return null;
  const sqlStart = inner.indexOf(sqlKey) + sqlKey.length;
  const afterSql = inner.slice(sqlStart);
  const sqlEndRe = /"\s*,\s*"(?:DiagramaER|TechnicalMetadata)"/i;
  const sqlEndMatch = afterSql.match(sqlEndRe);
  const rawSql = sqlEndMatch
    ? afterSql.slice(0, sqlEndMatch.index).trim()
    : afterSql.trim().replace(/"\s*\}\s*$/, "").trim();
  const sqlContent = unescapeJsonString(rawSql);
  if (!sqlContent || !/CREATE\s+TABLE/i.test(sqlContent)) return null;
  let diagramRaw = "";
  const diagramKey = /"DiagramaER"\s*:\s*"/i.exec(inner);
  if (diagramKey) {
    const diagramStart = inner.indexOf(diagramKey[0]) + diagramKey[0].length;
    const afterDiagram = inner.slice(diagramStart);
    const diagramEndMatch = afterDiagram.match(/"\s*,\s*"TechnicalMetadata"/i) ?? afterDiagram.match(/"\s*\}/);
    diagramRaw = diagramEndMatch
      ? unescapeJsonString(afterDiagram.slice(0, diagramEndMatch.index).trim())
      : unescapeJsonString(afterDiagram.trim().replace(/"\s*\}$/, ""));
  }
  let metaRaw = "[high_security]";
  const metaMatch = inner.match(/"TechnicalMetadata"\s*:\s*"([^"]*)"\s*\}/i) ?? inner.match(/"TechnicalMetadata"\s*:\s*"([^"]*)"/i);
  if (metaMatch?.[1]) metaRaw = metaMatch[1].trim() || metaRaw;
  return { SQL: sqlContent, DiagramaER: diagramRaw || undefined, TechnicalMetadata: metaRaw };
}

/**
 * Si en la sección 2 el bloque ```sql contiene un objeto JSON ({"SQL": "...", "DiagramaER": "...", ...}),
 * lo extrae y reemplaza por la estructura canónica: ```sql + SQL crudo + ``` + ### Diagrama + ```mermaid + ```TechnicalMetadata.
 */
export function unwrapSection2SqlBlockContainingJson(draft: string): string {
  const modeloHeading = "## 3. Modelo de Datos";
  const modeloIdx = draft.indexOf(modeloHeading);
  if (modeloIdx === -1) return draft;
  const sectionStart = modeloIdx + modeloHeading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const sqlBlockMatch = body.match(/```sql\s*([\s\S]*?)```/i);
  if (!sqlBlockMatch || sqlBlockMatch.index == null) return draft;
  const inner = sqlBlockMatch[1].trim();
  if (!inner.startsWith("{") || !/SQL|DiagramaER/i.test(inner)) return draft;
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(inner) as Record<string, unknown>;
  } catch {
    obj = section2ObjectFromMalformedJson(inner);
  }
  if (!obj) return draft;
  const markdown = section2ObjectToMarkdown(obj);
  if (!markdown) return draft;
  const before = body.slice(0, sqlBlockMatch.index);
  const after = body.slice(sqlBlockMatch.index + sqlBlockMatch[0].length);
  const newBody = before + markdown.trim() + after;
  const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
  return draft.slice(0, sectionStart) + newBody + afterSection;
}

/**
 * Normaliza el contenido de la sección 2 cuando viene con JSON dentro de ```sql (salida mal formada del Experto).
 * Acepta string que empieza por "## 3. Modelo de Datos" o solo el cuerpo; devuelve sección 2 con bloques canónicos.
 */
export function unwrapSection2ContentIfJsonInsideSql(section2: string): string {
  const sqlBlockMatch = section2.match(/```sql\s*([\s\S]*?)```/i);
  if (!sqlBlockMatch || sqlBlockMatch.index == null) return section2;
  const inner = sqlBlockMatch[1].trim();
  if (!inner.startsWith("{") || !/SQL|DiagramaER/i.test(inner)) return section2;
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(inner) as Record<string, unknown>;
  } catch {
    obj = section2ObjectFromMalformedJson(inner);
  }
  if (!obj) return section2;
  const markdown = section2ObjectToMarkdown(obj);
  if (!markdown) return section2;
  const before = section2.slice(0, sqlBlockMatch.index);
  const after = section2.slice(sqlBlockMatch.index + sqlBlockMatch[0].length);
  return before + markdown.trim() + after;
}

/** Asegura que la sección 2 termine con bloque TechnicalMetadata. Si falta, lo añade al final del cuerpo. */
export function ensureTechnicalMetadataAtEndOfSection2(draft: string): string {
  const modeloHeading = "## 3. Modelo de Datos";
  const modeloIdx = draft.indexOf(modeloHeading);
  if (modeloIdx === -1) return draft;
  const sectionStart = modeloIdx + modeloHeading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  if (/```TechnicalMetadata\s*[\s\S]*?```/i.test(body)) return draft;
  const defaultMeta = "\n\n```TechnicalMetadata\n[high_security]\n```\n\n";
  const newBody = body.trimEnd() + defaultMeta;
  const newRest = nextH2 !== -1 ? newBody + rest.slice(nextH2) : newBody;
  return draft.slice(0, sectionStart) + newRest;
}

/**
 * Dentro de ```mermaid, si el contenido es JSON (o "## 2. Modelo...") lo reemplaza por erDiagram o por diagramaER extraído.
 */

/**
 * Estandariza el formato del MDD: títulos canónicos, SQL en bloque ```sql, evita líneas sueltas como "3".
 * Se aplica al draft antes de mostrarlo para que cada regeneración se vea consistente.
 */

/**
 * Pasada final antes de entregar al usuario: sin directivas mesh; deduplica y reordena §1–§7.
 * Preserva bloques añadidos tras §7 (p. ej. UI/UX) salvo que sean repetición de secciones núcleo.
 */

/** Elimina del draft la sección "## 4. Arquitectura Frontend" completa (hasta el siguiente ## o fin). Evita dos secciones 4. */

/** En sección 7: si la primera subsección es ### Integración (redundante con el H2), reemplazarla por ### Resumen. */

/** En sección 7: colapsa repeticiones de ### Manifest (incl. ### 7.5 Manifest...) y ### Manifest de Infraestructura en una sola. */

/** Reemplaza secuencias de líneas "---" (con o sin líneas en blanco entre ellas) por una sola "---". */

const REAL_SECTION_RE =
  /\n##\s+(?:1\.\s*Contexto|2\.\s*Modelo|3\.\s*Contratos|4\.\s*Arquitectura\s+Frontend|Seguridad|Integración)\b/i;

/** Si el draft empieza con useMermaidForDiagrams/document, recorta todo hasta la primera sección real y reconstruye. */
export function forceStripBrokenPrefix(draft: string): string {
  const trimmed = (draft || "").trim();
  if (!trimmed || trimmed.length < 100) return draft;
  const hasBroken = /useMermaidForDiagrams|##\s+document\b/i.test(trimmed.slice(0, 2000));
  if (!hasBroken) return draft;
  const match = trimmed.match(REAL_SECTION_RE);
  if (!match || match.index == null) return draft;
  const fromSection = trimmed.slice(match.index).replace(/^\s*\n+/, "");
  if (fromSection.length < 200) return draft;
  return ("# Master Design Document\n\n---\n" + fromSection).trim();
}

/**
 * Convierte sección "## TechnicalMetadata" con viñetas (- [tag]) en bloque de código
 * ```TechnicalMetadata\n[tag1] [tag2]\n``` para que no se muestre como encabezado roto.
 */
function convertTechnicalMetadataSectionToBlock(draft: string): string {
  const heading = "## TechnicalMetadata";
  const idx = draft.indexOf(heading);
  if (idx === -1) return draft;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = (nextH2 !== -1 ? rest.slice(0, nextH2) : rest).replace(/^\s*\n+/, "").trim();
  const tagMatches = body.match(/-\s*\[([^\]]+)\]/g);
  const tags = tagMatches ? tagMatches.map((m) => "[" + m.replace(/^-\s*\[|\]$/g, "").trim() + "]") : [];
  const blockContent = tags.length > 0 ? tags.join(" ") : "[high_security]";
  const codeBlock = "\n\n```TechnicalMetadata\n" + blockContent + "\n```\n\n";
  const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
  return draft.slice(0, idx) + codeBlock + (afterSection ? afterSection : "");
}

/**
 * Convierte metadata en cursiva (*Metadata: [high_security]*) a bloque ```TechnicalMetadata.
 */
function convertItalicMetadataToBlock(draft: string): string {
  return draft.replace(
    /\*Metadata:\s*([^*]+)\*/gi,
    (_match, tags) => "```TechnicalMetadata\n" + tags.trim().replace(/\s*,\s*/g, " ") + "\n```"
  );
}

/** Elimina bloques "## useMermaidForDiagrams" / "## leaveUncovered" / "## document" cuando hay una sección real después. Repite hasta que no queden. */
export function stripBrokenMetadataDocumentBlock(draft: string): string {
  let out = draft;
  out = convertItalicMetadataToBlock(out);
  out = convertTechnicalMetadataSectionToBlock(out);
  let changed = true;
  while (changed) {
    changed = false;
    const idx = out.search(/\n##\s+useMermaidForDiagrams\b/i);
    if (idx === -1) break;
    const afterBroken = out.slice(idx);
    const match = afterBroken.match(REAL_SECTION_RE);
    if (!match || match.index == null) break;
    const startRemove = out.slice(0, idx).replace(/\n---\s*\n?$/, "");
    const rest = afterBroken.slice(match.index).replace(/^\n+/, "");
    out = (startRemove + "\n\n---\n" + rest).trim();
    changed = true;
  }
  return out;
}

/** Elimina repeticiones de "# Master Design Document"; deja solo la primera y quita el bloque duplicado (y --- siguiente si existe). */
export function collapseDuplicateMainTitle(draft: string): string {
  const mainTitleRe = /^#\s+Master\s+Design\s+Document[^\n]*/im;
  const first = draft.match(mainTitleRe);
  if (!first) return draft;
  const firstEnd = draft.indexOf(first[0]) + first[0].length;
  const afterFirst = draft.slice(firstEnd);
  const withoutDuplicates = afterFirst.replace(/(\n\s*)#\s+Master\s+Design\s+Document[^\n]*(\s*\n---\s*\n?)?/gi, "$1");
  return draft.slice(0, firstEnd) + withoutDuplicates;
}

/**
 * Devuelve el rango [start, end) del bloque §2–§5 (Arquitectura hasta antes de Seguridad) en el draft.
 * Usado para reemplazar solo §2–§5 al regenerar desde el arquitecto.
 */
export function getSections2To5Range(draft: string): { start: number; end: number } | null {
  const trimmed = (draft ?? "").trim();
  const startRe = /\n?(##\s*2\.\s*Arquitectura[^\n]*)/i;
  const startM = trimmed.match(startRe);
  if (!startM || startM.index == null) return null;
  const start = startM.index + (startM[0].startsWith("\n") ? 1 : 0);
  const afterStart = start + (startM[1]?.length ?? 0);
  const rest = trimmed.slice(afterStart);
  const endH2 = rest.search(/\n##\s+(?:6\.\s+)?Seguridad/i);
  const end = endH2 >= 0 ? afterStart + endH2 : trimmed.length;
  return { start, end };
}

/** Extrae el contenido de §2–§5 (desde ## 2. Arquitectura hasta antes de ## 6. Seguridad) de un draft. */
export function extractSections2To5Content(draft: string): string | null {
  const range = getSections2To5Range((draft ?? "").trim());
  if (!range) return null;
  return (draft ?? "").trim().slice(range.start, range.end).trim() || null;
}

/**
 * Reemplaza solo el bloque §2–§5 en currentDraft por newSections2To5Markdown.
 * newSections2To5Markdown debe incluir ## 2. Arquitectura … hasta el final de §5 (sin ## 6.).
 */
export function replaceSections2To5InDraft(
  currentDraft: string,
  newSections2To5Markdown: string,
): string {
  const trimmed = (currentDraft ?? "").trim();
  const range = getSections2To5Range(trimmed);
  if (range) {
    const before = trimmed.slice(0, range.start);
    const after = range.end < trimmed.length ? trimmed.slice(range.end).trimStart() : "";
    return (before + "\n\n" + newSections2To5Markdown.trim() + (after ? "\n\n" + after : "")).trim();
  }
  const sec6 = trimmed.match(/\n##\s+(?:6\.\s+)?Seguridad/i);
  if (sec6 && sec6.index != null) {
    return (trimmed.slice(0, sec6.index).trim() + "\n\n" + newSections2To5Markdown.trim() + "\n\n" + trimmed.slice(sec6.index).trim()).trim();
  }
  return (trimmed + "\n\n" + newSections2To5Markdown.trim()).trim();
}

/**
 * Devuelve el rango [start, end) de la sección 6 (Seguridad) o 7 (Infraestructura) en el draft.
 * Usado para reemplazar solo esa sección sin tocar §1–§5 (evitar sobrescribir §3/§4 desde structured).
 */

/** Línea que es solo el título de la sección (evitar duplicar "6. Seguridad" en el cuerpo). */
const reSection6TitleOnly = /^\s*(###?\s*)?6\.\s*Seguridad\s*$/i;

/** Detecta subsección por número (6.1, 6.2) o por **Título:** */
const reSection6SubsectionNum = /^\d+\.\d+\s+.+$/;
const reSection6BoldHeading = /^\*\*[^*]+\*\*:\s*$/; // **Autenticación y Autorización:**

const SECTION6_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Formato canónico §6: ## Aspectos Generales + párrafo intro + ### A. / B. / C. con * bullets; Conclusión en blockquote.
 */
function formatSection6AspectosGenerales(lines: string[]): string {
  const normalized = lines
    .map((c) => c.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
    .filter((c) => c && !reSection6TitleOnly.test(c));
  const intro: string[] = [];
  const groups: { title: string; lines: string[] }[] = [];
  let i = 0;
  while (i < normalized.length) {
    const line = normalized[i]!;
    if (reSection6BoldHeading.test(line)) {
      const title = line.replace(/^\*\*|\*\*:\s*$/g, "").trim();
      const groupLines: string[] = [];
      i++;
      while (i < normalized.length && !reSection6BoldHeading.test(normalized[i]!)) {
        groupLines.push(normalized[i]!);
        i++;
      }
      groups.push({ title, lines: groupLines });
    } else {
      intro.push(line);
      i++;
    }
  }
  const out: string[] = [];
  if (intro.length) out.push(intro.join(" ").trim(), "");
  groups.forEach((g, idx) => {
    const letter = SECTION6_LETTERS[idx] ?? String(idx + 1);
    const title = g.title.trim();
    if (/^conclusi[oó]n$/i.test(title)) {
      const text = g.lines.length ? g.lines.join(" ").trim() : "(Pendiente.)";
      out.push("> **Conclusión:** " + text, "");
      return;
    }
    out.push(`### ${letter}. ${title}`);
    out.push("");
    g.lines.forEach((l) => out.push("* " + l));
    out.push("");
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Agrupa líneas de contenido por subsecciones 6.1/6.2 o **X:**; 4 espacios para ítem, 8 para hijos. */
function formatSection6ContentLines(lines: string[]): string {
  const sub = "    - "; // 4 espacios = primer nivel
  const subSub = "        - "; // 8 espacios = bajo subsección
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }
    line = line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim();
    if (reSection6TitleOnly.test(line)) {
      i++;
      continue;
    }
    const isSubsectionNum = reSection6SubsectionNum.test(line);
    const isBoldHeading = reSection6BoldHeading.test(line);
    if (isSubsectionNum || isBoldHeading) {
      const label = line.endsWith(":") ? line : line + ":";
      out.push(sub + label);
      i++;
      while (i < lines.length) {
        const raw = lines[i]!.trim();
        const next = raw.replace(/^-\s*/, "");
        if (!next) {
          i++;
          continue;
        }
        if (reSection6SubsectionNum.test(next) || reSection6BoldHeading.test(next)) break;
        out.push(subSub + next);
        i++;
      }
    } else {
      out.push(sub + line);
      i++;
    }
  }
  return out.length ? out.join("\n") : sub + "(Pendiente.)";
}

/** Convierte array de items { title, content } a markdown de la sección 6 (Seguridad). Categoría con -; subniveles 4 espacios; bajo 6.1/6.2 etc. 8 espacios. Sin "--" al final. */
export function seguridadItemsToSection6Markdown(
  items: Array<{ title: string; content: string[] }>,
): string {
  if (!items?.length) return "## 6. Seguridad\n\n(Pendiente de definir.)";
  const filtered =
    items.length > 1
      ? items.filter((item) => {
          const t = (item.title ?? "").trim().replace(/^\d+\.\d*\s*/, "");
          return t && t !== "Seguridad" && !/^6\.\s*Seguridad$/i.test(t);
        })
      : items;
  const reLineSeguridad = /^\s*(-\s*)?##\s*6\.\s*Seguridad\s*$/i;
  const parts = filtered.map((item) => {
    let title = (item.title ?? "")
      .replace(/^\d+\.\d*\s*/, "")
      .replace(/^#+\s*/, "")
      .replace(/^\.\s+/, "")
      .trim();
    if (filtered.length === 1 && (!title || title === "Seguridad")) title = "Aspectos generales";
    let lines = Array.isArray(item.content) ? item.content.filter(Boolean) : [String(item.content ?? "").trim()].filter(Boolean);
    lines = lines
      .filter((c) => !reLineSeguridad.test(c.trim()))
      .map((c) => c.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim())
      .filter((c) => !reSection6TitleOnly.test(c));
    // Un solo ítem "Aspectos generales" → formato canónico: ## Aspectos Generales + intro + ### A./B./C. + * bullets; Conclusión en blockquote
    if (filtered.length === 1 && /^Aspectos\s+generales$/i.test(title)) {
      const body = lines.length ? formatSection6AspectosGenerales(lines) : "(Pendiente de definir.)";
      return `## Aspectos Generales\n\n${body}`;
    }
    const subBullets = lines.length ? formatSection6ContentLines(lines) : "    - (Pendiente.)";
    const label = title.endsWith(":") ? title : title + ":";
    return `- ${label}\n${subBullets}`;
  });
  let body = parts.length ? parts.join("\n\n") : "(Pendiente de definir.)";
  body = body.replace(/\s*--\s*\n*$/, "").replace(/(\n\s*-\s*)+$/, "").trim();
  return "## 6. Seguridad\n\n" + body;
}

/** Convierte objeto integracion (subsections + manifest) a markdown de la sección 7. */
export function integracionToSection7Markdown(integracion: {
  subsections?: Array<{ title: string; content: string | string[] }>;
  manifest?: Record<string, unknown>;
}): string {
  const subs = integracion?.subsections ?? [];
  let body = subs.length
    ? subs
      .map((s) => {
        const c = s.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.join("\n") : "";
        return `### ${s.title}\n\n${text}`;
      })
      .join("\n\n")
    : "(Pendiente de definir.)";
  const manifest =
    integracion?.manifest && typeof integracion.manifest === "object"
      ? integracion.manifest
      : buildNewFormatManifestFromIdentifiedTerms([]);
  body += "\n\n### Manifest de Infraestructura\n\n```json\n" + JSON.stringify(manifest, null, 2) + "\n```";
  return "## 7. Infraestructura\n\n" + body;
}

/** Extrae el cuerpo de la sección ## 3. Modelo de Datos (hasta el siguiente ## o fin). */

/**
 * Extrae SQL del cuerpo de §3 cuando no está en bloque ```sql (parse tolerante).
 * Busca CREATE TABLE y toma hasta el siguiente ``` o hasta un bloque ```mermaid/TechnicalMetadata.
 */
function extractSqlFromSection3Fallback(markdown: string): string {
  const trimmed = (markdown ?? "").trim();
  const createIdx = trimmed.search(/\bCREATE\s+TABLE\b/i);
  if (createIdx === -1) return "";
  const fromCreate = trimmed.slice(createIdx);
  const nextBlock = fromCreate.search(/\n?\s*```\s*(?:mermaid|sql|TechnicalMetadata|json)/i);
  const chunk = nextBlock >= 0 ? fromCreate.slice(0, nextBlock) : fromCreate;
  return chunk.trim();
}

/** Parsea cuerpo de §3 (markdown con ```sql, ```mermaid, ```TechnicalMetadata) a modeloDatos. Para merge en mddStructured cuando el SA genera §3. Más tolerante: si hay CREATE TABLE pero no ```sql, extrae SQL por heurística. */
export function parseModeloDatosFromSection3Markdown(markdown: string): {
  sql: string;
  diagramaEr?: string;
  technicalMetadata?: string[];
} | null {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return null;
  const sqlMatch = trimmed.match(/```sql\s*([\s\S]*?)```/i);
  let sql = sqlMatch?.[1]?.trim() ?? "";
  if (!sql && /CREATE\s+TABLE/i.test(trimmed)) sql = extractSqlFromSection3Fallback(trimmed);
  if (!sql) return null;
  const metaMatch = trimmed.match(/```TechnicalMetadata\s*([\s\S]*?)```/i);
  const metaRaw = metaMatch?.[1]?.trim();
  const technicalMetadata = metaRaw
    ? metaRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^\[.*\]$/.test(s))
    : ["[high_security]"];
  // diagramaEr: derivado del SQL (no del bloque mermaid del LLM).
  const diagramaEr = sqlToErDiagramContent(sql) ?? undefined;
  return { sql, diagramaEr, technicalMetadata };
}

const OUTPUT_PREFIX_LEN = 200;

/** Log resumido de la salida de un nodo (len, section2, prefijo) para depurar pipeline MDD. */
export function logMddNodeOutput(nodeName: string, draft: string): void {
  const trimmed = (draft ?? "").trim();
  const sum = getMddDraftSummary(trimmed);
  const prefix = trimmed.slice(0, OUTPUT_PREFIX_LEN).replace(/\s+/g, " ").trim();
  const suffix = trimmed.length > OUTPUT_PREFIX_LEN ? "…" : "";
  console.log(
    `[MDD:${nodeName}] output len=${sum.length} section2=${sum.section2} prefix=${JSON.stringify(prefix + suffix)}`
  );
}

/**
 * Valida la estructura del MDD: sección 3 con payloads, secciones presentes, TechnicalMetadata, orden.
 * Usado por tools del Auditor y Redactor.
 */

/** Inserta `---` antes de cada `##` que no tenga ya una línea `---` inmediatamente anterior. */

/** Extrae el primer objeto/array JSON de una línea (desde { o [ hasta el cierre balanceado). */
function extractJsonFromLine(line: string): { json: string; start: number; end: number } | null {
  const open = line.indexOf("{");
  const openBracket = line.indexOf("[");
  const start = open === -1 ? openBracket : openBracket === -1 ? open : Math.min(open, openBracket);
  if (start === -1) return null;
  const openChar = line[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < line.length; i++) {
    if (line[i] === openChar) depth++;
    else if (line[i] === closeChar) {
      depth--;
      if (depth === 0) return { json: line.slice(start, i + 1), start, end: i + 1 };
    }
  }
  return null;
}

/** Asegura que la fila de tabla cierre con | (evita errores de parseo en Backstage y otros). */
function ensureTrailingTablePipe(row: string): string {
  const t = row.trimEnd();
  return t.endsWith("|") ? t : t + " |";
}

/**
 * Solo parte en límites de fila: | seguido de | y luego --- (separador), POST/GET/etc, o /ruta (datos).
 * No parte en | | que sea una celda vacía dentro de la misma fila.
 */
const TABLE_ROW_BOUNDARY = /\|\s*\|(?=\s*(?:-{2,}|(?:POST|GET|PUT|DELETE|PATCH)\s*\||\/))/gi;

/**
 * Colapsa líneas en blanco entre fila de cabecera de tabla (| ... |) y fila separador (|---|).
 * Muchos renderers rompen la tabla si hay línea vacía entre ambas.
 */
function collapseBlankBetweenTableHeaderAndSeparator(body: string): string {
  return body.replace(
    /(\|[^\n]+)\n(\s*\n)+(\|\s*[-|\s]+\|[^\n]*)/g,
    "$1\n$3"
  );
}

/** Parte una línea con varias filas de tabla concatenadas (ej. 8 celdas en tabla de 4 columnas) en una fila por línea. */
function splitConcatenatedTableRows(line: string, colCount = 4): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.includes("|")) return [line];
  const parts = trimmed.split("|").map((p) => p.trim());
  const cells =
    parts.length >= 2 && parts[0] === "" && parts[parts.length - 1] === "" ? parts.slice(1, -1) : parts;
  if (cells.length <= colCount || cells.length % colCount !== 0) return [line];
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += colCount) {
    rows.push("| " + cells.slice(i, i + colCount).join(" | ") + " |");
  }
  return rows;
}

/**
 * Si una línea parece tabla Markdown pero tiene filas concatenadas en una sola línea,
 * separa cada fila en su propia línea (solo en límites de fila, no en cada celda).
 * También quita el pipe final de cada fila para evitar columna vacía en el render.
 */
function fixMarkdownTableRows(body: string): string {
  const collapsed = collapseBlankBetweenTableHeaderAndSeparator(body);
  const lines = collapsed.split(/\n/);
  const out: string[] = [];
  let lastWasTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const hasDoublePipe = /\|\s*\|/.test(trimmed);
    const looksLikeTable = trimmed.includes("|") && (trimmed.includes("---") || /\|[^|]+\|[^|]+\|/.test(trimmed));
    const concatenatedRows = splitConcatenatedTableRows(trimmed, 4);
    if (concatenatedRows.length > 1) {
      if (lastWasTable === false && out.length > 0) out.push("");
      for (const row of concatenatedRows) out.push(ensureTrailingTablePipe(row));
      lastWasTable = true;
      continue;
    }
    if ((looksLikeTable || trimmed.startsWith("|")) && hasDoublePipe) {
      const fixed = trimmed.replace(TABLE_ROW_BOUNDARY, "|\n|").trim();
      const rows = fixed.split("\n");
      if (lastWasTable === false && out.length > 0) out.push("");
      for (const row of rows) out.push(ensureTrailingTablePipe(row.trim()));
      lastWasTable = true;
    } else if (trimmed.startsWith("|") && looksLikeTable) {
      lastWasTable = true;
      out.push(ensureTrailingTablePipe(trimmed));
    } else {
      lastWasTable = false;
      out.push(line);
    }
  }
  return out.join("\n");
}

/**
 * Convierte un bloque de viñetas con pipes (ej. "*   **POST** | `/path` | desc | Auth") en tabla Markdown válida
 * (encabezado + separador + filas con pipes). Así el renderer muestra tabla y no texto plano.
 */
function convertListWithPipesToMarkdownTable(body: string): string {
  const lines = body.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const hasPipes = bulletMatch && bulletMatch[1].includes("|");
    if (!bulletMatch || !hasPipes) {
      result.push(line);
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const m = l.match(/^\s*[-*]\s+(.+)$/);
      if (!m || !m[1].includes("|")) break;
      block.push(m[1].trim());
      i++;
    }
    if (block.length === 0) {
      i++;
      continue;
    }
    const parseCells = (row: string): string[] =>
      row
        .split("|")
        .map((c) => c.replace(/\*\*([^*]+)\*\*/, "$1").trim())
        .filter((cell, idx, arr) => idx < arr.length - 1 || cell.trim().length > 0);
    const rows = block.map(parseCells);
    const colCount = Math.max(...rows.map((r) => r.length), 2);
    const headers =
      colCount >= 4 ? ["Método", "Ruta", "Descripción", "Auth"] : Array.from({ length: colCount }, (_, j) => `Col${j + 1}`);
    const headerRow = "| " + headers.slice(0, colCount).join(" | ") + " |";
    const sepRow = "|" + Array(colCount).fill(":---").join("|") + "|";
    result.push("", headerRow, sepRow);
    for (const cells of rows) {
      const padded = [...cells];
      while (padded.length < colCount) padded.push("");
      result.push("| " + padded.slice(0, colCount).join(" | ") + " |");
    }
    result.push("");
  }
  return result.join("\n");
}

/**
 * Si la cabecera y el separador están en la misma línea (ej. "| Método | Ruta |---|---|---"),
 * los separa en dos líneas para que la tabla renderice bien.
 */
function splitHeaderAndSeparatorOnSameLine(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const sepRun = trimmed.match(/\|\s*\-{2,}(\|\s*\-{2,})*\s*\|?\s*$/);
    if (sepRun && /[a-zA-Z\u00C0-\u024F]/.test(trimmed) && trimmed.includes("|")) {
      const sepStart = trimmed.length - sepRun[0].length;
      const headerPart = trimmed.slice(0, sepStart).trim();
      const colCount = Math.max(
        1,
        headerPart
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean).length,
      );
      const sepRow = "|" + Array(colCount).fill(":---").join("|") + "|";
      const headerNormalized = headerPart.endsWith("|") ? headerPart : headerPart + " |";
      out.push(headerNormalized, sepRow);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Normaliza el texto de la tabla de §4 (contratos): limpia separadores duplicados, convierte viñetas con pipes
 * en tabla Markdown válida y asegura un solo separador bajo el encabezado.
 */
export function normalizeContratosTableSummary(body: string): string {
  let out = splitHeaderAndSeparatorOnSameLine(body);
  out = deduplicateTableSeparators(out);
  out = convertListWithPipesToMarkdownTable(out);
  out = ensureTableSeparatorAfterHeader(out);
  return out;
}

/** True si la línea es la fila separadora de una tabla (solo |, - y espacios; trailing | opcional). */
function isTableSeparatorLine(trimmed: string): boolean {
  const withoutSpaces = trimmed.replace(/\s/g, "");
  if (
    (withoutSpaces.length > 0 &&
      /^[\|\-\:]+$/.test(withoutSpaces) &&
      trimmed.includes("|") &&
      (trimmed.includes("-") || trimmed.includes(":"))) ||
    /^\|[\-\:|]+\|?$/.test(withoutSpaces) ||
    /^[\-\:]+\|/.test(withoutSpaces)
  ) {
    return true;
  }
  if (!trimmed.startsWith("|") || !trimmed.includes("|")) return false;
  const cells = trimmed.split("|").map((c) => c.trim());
  return (
    cells.length >= 2 &&
    cells.some((c) => /-/.test(c)) &&
    cells.every((c) => c === "" || /^[\s\-:]+$/.test(c))
  );
}

/**
 * Elimina separadores duplicados o intercalados: deja solo una fila separadora justo después de la cabecera.
 * Omite líneas en blanco entre cabecera y separador/datos; si llega una fila de datos sin separador, lo inserta.
 */
function deduplicateTableSeparators(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let inTable = false;
  let headerDone = false;
  let separatorDone = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isSeparator = isTableSeparatorLine(trimmed);
    const isTableRow = /^\|\s*.+\s*\|?/.test(trimmed) && trimmed.includes("|");
    if (isTableRow && !isSeparator) {
      if (!inTable) {
        inTable = true;
        headerDone = false;
        separatorDone = false;
      }
      if (inTable && headerDone && !separatorDone) {
        const headerLine = out[out.length - 1];
        const colCount = headerLine
          ? Math.max(
            1,
            headerLine
              .trim()
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean).length,
          )
          : 4;
        out.push("|" + Array(colCount).fill(":---").join("|") + "|");
        separatorDone = true;
      }
      out.push(line);
      if (!headerDone) headerDone = true;
      continue;
    }
    if (isSeparator) {
      if (inTable && headerDone && !separatorDone) {
        out.push(line);
        separatorDone = true;
      }
      continue;
    }
    if (trimmed === "" && inTable) {
      continue;
    }
    inTable = false;
    headerDone = false;
    separatorDone = false;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Añade línea separadora bajo la primera fila con pipes si falta (solo tras la cabecera real, no tras cada fila).
 * Si hay líneas en blanco entre cabecera y la primera fila de datos, no las emite y inserta el separador.
 */
function ensureTableSeparatorAfterHeader(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let i = 0;
  let lastPushedIsHeader = false;
  let separatorPushed = false;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const currentIsSeparator = isTableSeparatorLine(trimmed);
    const looksLikeHeaderRow =
      !currentIsSeparator &&
      /^\|\s*.+\s*\|?/.test(trimmed) &&
      trimmed.includes("|") &&
      /[a-zA-Z\u00C0-\u024F]/.test(trimmed);
    const isDataRow = /^\|\s*.+\s*\|?/.test(trimmed) && trimmed.includes("|") && !currentIsSeparator;

    if (trimmed === "" && lastPushedIsHeader && !separatorPushed) {
      i++;
      continue;
    }
    if (currentIsSeparator) {
      if (separatorPushed) {
        i++;
        continue;
      }
      separatorPushed = true;
    }
    if ((isDataRow || looksLikeHeaderRow) && !separatorPushed) lastPushedIsHeader = true;
    else if (isDataRow || looksLikeHeaderRow) lastPushedIsHeader = false;
    else if (trimmed !== "") {
      lastPushedIsHeader = false;
      separatorPushed = false;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/**
 * Envuelve JSON minificado (líneas largas sin saltos) en bloques ```json con pretty-print.
 */
export function formatContratosBody(body: string): string {
  let normalized = splitHeaderAndSeparatorOnSameLine(body);
  normalized = deduplicateTableSeparators(normalized);
  normalized = convertListWithPipesToMarkdownTable(normalized);
  normalized = ensureTableSeparatorAfterHeader(normalized);
  normalized = fixMarkdownTableRows(normalized);
  // Muchos renderers de markdown requieren línea en blanco antes de la tabla
  if (normalized.trimStart().startsWith("|")) {
    normalized = "\n" + normalized.trimStart();
  }
  const lines = normalized.split(/\n/);
  const result: string[] = [];
  for (const line of lines) {
    if (line.includes("```json") || line.trim().startsWith("```")) {
      result.push(line);
      continue;
    }
    if (line.length < 40 || (!line.includes("{") && !line.includes("["))) {
      result.push(line);
      continue;
    }
    const extracted = extractJsonFromLine(line);
    if (!extracted) {
      result.push(line);
      continue;
    }
    try {
      const parsed = JSON.parse(extracted.json) as unknown;
      const pretty = JSON.stringify(parsed, null, 2);
      const before = line.slice(0, extracted.start).trimEnd();
      const after = line.slice(extracted.end).trimStart();
      if (before) result.push(before);
      result.push("```json", pretty, "```");
      if (after) result.push(after);
    } catch {
      result.push(line);
    }
  }
  return result.join("\n");
}

/**
 * Normaliza `tables` cuando el LLM devuelve array (ej. [{ name: "users", columns: [{ name, type, primaryKey, unique }] }])
 * a formato record esperado por structuredToMarkdown: { "users": { "columns": { "id": "UUID PRIMARY KEY", ... } } }.
 */
export function normalizeTablesToRecord(tables: unknown): Record<string, { columns: Record<string, string> }> | null {
  if (!tables || typeof tables !== "object") return null;
  if (!Array.isArray(tables)) return tables as Record<string, { columns: Record<string, string> }>;

  const record: Record<string, { columns: Record<string, string> }> = {};
  for (const row of tables) {
    const t = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const name = typeof t.name === "string" ? t.name : "table";
    const colsRaw = t.columns;
    const cols: Record<string, string> = {};
    if (Array.isArray(colsRaw)) {
      for (const c of colsRaw) {
        const col = c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
        const colName = typeof col.name === "string" ? col.name : "id";
        const type = typeof col.type === "string" ? col.type : "VARCHAR(255)";
        const parts = [type];
        if (col.primaryKey) parts.push("PRIMARY KEY");
        if (col.unique) parts.push("UNIQUE");
        if (col.notNull !== false) parts.push("NOT NULL");
        cols[colName] = parts.join(" ");
      }
    }
    record[name] = { columns: Object.keys(cols).length ? cols : { id: "UUID PRIMARY KEY DEFAULT gen_random_uuid()" } };
  }
  return Object.keys(record).length ? record : null;
}

/**
 * Convierte cualquier objeto JSON a Markdown estructurado recursivamente.
 * Reemplaza la lógica anterior estricta por una universal.
 */
export function objectSectionToMarkdown(data: unknown, level = 1): string {
  if (data === null || data === undefined) return "";

  // Si es string/number/boolean, devolverlo directo
  if (typeof data !== "object") return String(data).trim();

  // Si es array, convertir a lista de viñetas
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === "object" && item !== null) {
        return `- ${JSON.stringify(item)}`;
      }
      return `- ${String(item)}`;
    }).join("\n");
  }

  const out: string[] = [];
  const entries = Object.entries(data as Record<string, unknown>);

  // Detectar si estamos en la raíz y hay una clave contenedora principal "mddDraft" o "Master Design Document"
  if (level === 1 && entries.length === 1 && (entries[0][0] === "mddDraft" || entries[0][0] === "Master Design Document")) {
    return objectSectionToMarkdown(entries[0][1], level);
  }

  // Detectar wrapper { "Master Design Document": ... } junto con otras claves
  if (level === 1 && entries.some(e => e[0] === "Master Design Document")) {
    const mdd = (data as Record<string, unknown>)["Master Design Document"];
    if (mdd) out.push(objectSectionToMarkdown(mdd, level));
    for (const [key, val] of entries) {
      if (key === "Master Design Document") continue;
      out.push(objectSectionToMarkdown({ [key]: val }, level));
    }
    return out.join("\n\n").trim();
  }

  // Título principal si level=1 y no hay wrapper obvio
  if (level === 1) {
    out.push("# Master Design Document", "");
  }

  for (const [key, val] of entries) {
    if (val === undefined || val === null) continue;

    const headingPrefix = "#".repeat(Math.min(level + 1, 6)); // Start at H2 for keys at level 1

    // Heurísticas de formato para bloques de código
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Si ya tiene bloques de código, imprimir tal cual
      if (trimmed.startsWith("```")) {
        out.push(`${headingPrefix} ${key}`, "", trimmed, "");
        continue;
      }
      // Si parece SQL
      if (key.toLowerCase().includes("sql") || trimmed.includes("CREATE TABLE") || trimmed.includes("SELECT ")) {
        out.push(`${headingPrefix} ${key}`, "", "```sql", trimmed, "```", "");
        continue;
      }
      // Texto normal
      out.push(`${headingPrefix} ${key}`, "", trimmed, "");
      continue;
    }

    if (key === "request" || key === "response" || key === "body" || key === "payload") {
      if (typeof val === "object") {
        out.push(`${headingPrefix} ${key}`, "", "```json", JSON.stringify(val, null, 2), "```", "");
        continue;
      }
    }

    // Si es array
    if (Array.isArray(val)) {
      out.push(`${headingPrefix} ${key}`, "");
      // Si es lista de endpoints (objetos), intentar formatear mejor
      if (val.length > 0 && typeof val[0] === "object" && ((val[0] as any).method || (val[0] as any).path || (val[0] as any).endpoint)) {
        for (const item of val) {
          const method = (item as any).method || (item as any).type || "ITEM";
          const path = (item as any).path || (item as any).endpoint || "";
          const label = path ? `${method} ${path}` : method;
          out.push(objectSectionToMarkdown({ [label]: item }, level + 1));
        }
      } else {
        const list = val.map(item => {
          if (typeof item === "object") return `- ${JSON.stringify(item)}`;
          return `- ${String(item)}`;
        }).join("\n");
        out.push(list, "");
      }
      continue;
    }

    // Si es objeto regular
    out.push(`${headingPrefix} ${key}`, "");
    out.push(objectSectionToMarkdown(val, level + 1), "");
  }

  return out.join("\n").trim();
}
