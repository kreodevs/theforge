import type { MddStructured } from "../state/mdd-structured.schema.js";
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
import { applyMddQualityAutoRepairs, collectMddQualityIssues } from "../../engine/mdd-quality-audit.util.js";
import { sanitizeMermaidInDraft } from "../../engine/mdd-pre-render.js";
import { sqlToErDiagramContent } from "./mdd-diagram-suggestions.js";

/** Convierte objeto con subsections (array de {title, description: string[]}) a markdown legible. */
function subsectionsToMarkdown(val: unknown): string | null {
  if (!val || typeof val !== "object" || Array.isArray(val)) return null;
  const rec = val as Record<string, unknown>;
  const subsections = rec.subsections;
  if (!Array.isArray(subsections)) return null;
  const out: string[] = [];
  for (const sub of subsections) {
    if (!sub || typeof sub !== "object") continue;
    const s = sub as Record<string, unknown>;
    const title = s.title;
    if (title != null) out.push(`### ${String(title)}`, "");
    const desc = s.description;
    if (Array.isArray(desc)) {
      for (const d of desc) out.push(typeof d === "string" ? `- ${d}` : `- ${JSON.stringify(d)}`);
      out.push("");
    } else if (typeof desc === "string") {
      out.push(`- ${desc}`, "");
    }
  }
  return out.length ? out.join("\n").trim() : null;
}

/** Convierte un item (string u objeto con title/description o subsections) a línea(s) markdown. */
function contentItemToMarkdown(item: unknown): string[] {
  if (typeof item === "string") return [item.trim()].filter(Boolean);
  if (typeof item !== "object" || item === null) return [String(item)];
  const subMd = subsectionsToMarkdown(item);
  if (subMd) return [subMd];
  const rec = item as Record<string, unknown>;
  if (rec.title != null && rec.description != null) {
    const lines: string[] = [`### ${String(rec.title)}`, ""];
    const desc = rec.description;
    if (Array.isArray(desc)) for (const d of desc) lines.push(typeof d === "string" ? `- ${d}` : `- ${JSON.stringify(d)}`);
    else if (typeof desc === "string") lines.push(desc);
    return [lines.join("\n")];
  }
  return [JSON.stringify(item, null, 2)];
}

/**
 * Si el contenido de una sección (Seguridad/Integración) es un objeto JSON con claves como títulos
 * y valores como arrays de strings u objetos (subsections), lo convierte a markdown legible.
 */
export function jsonSectionToMarkdown(sectionContent: string, sectionTitle: string): string {
  const trimmed = (sectionContent || "").trim();
  if (!trimmed || !trimmed.startsWith("{") || !trimmed.includes('"')) return sectionContent;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof obj !== "object" || Array.isArray(obj)) return sectionContent;
    const keys = Object.keys(obj);
    const isTitleContentShape =
      keys.length >= 2 &&
      keys.some((k) => k.toLowerCase() === "title") &&
      keys.some((k) => k.toLowerCase() === "content");
    const lines: string[] = [`## ${sectionTitle}`, ""];
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase() === "title") continue;
      if (key.toLowerCase() === "content" && isTitleContentShape && Array.isArray(val)) {
        for (const item of val) {
          const parts = contentItemToMarkdown(item);
          for (const p of parts) lines.push(p.includes("\n") ? p : `- ${p}`);
        }
        lines.push("");
        continue;
      }
      const heading = key.trim().startsWith("###") ? key.trim() : `### ${key}`;
      lines.push(heading, "");
      if (Array.isArray(val)) {
        for (const item of val) {
          const parts = contentItemToMarkdown(item);
          for (const p of parts) lines.push(p.includes("\n") ? p : `- ${p}`);
        }
      } else if (typeof val === "string") {
        lines.push(val);
      } else if (typeof val === "object" && val !== null) {
        const subMd = subsectionsToMarkdown(val);
        lines.push(subMd ?? JSON.stringify(val, null, 2));
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  } catch {
    return sectionContent;
  }
}

/** Encuentra el índice del cierre de llave que equilibra la llave abierta en start. */
function findBalancedBrace(str: string, start: number): number {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Como findBalancedBrace pero ignora { } que estén dentro de strings con comillas dobles (para JSON con erDiagram). */
function findBalancedBraceRespectingStrings(str: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

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

const SQL_DDL_STATEMENT =
  /^\s*(CREATE\s+TABLE|CREATE\s+INDEX|CREATE\s+UNIQUE|ALTER\s+TABLE|PARTITION\s+OF|FOR\s+VALUES|\)\s*;|\);|CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s*\(|CHECK\s*\(|REFERENCES\s+)/i;

const SQL_COLUMN_DEF =
  /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s+(UUID|VARCHAR|TEXT|INTEGER|INT|BIGINT|BOOLEAN|BOOL|TIMESTAMPTZ|TIMESTAMP|INET|JSONB|BYTEA|DATE|SMALLINT|NUMERIC|DECIMAL|CHAR|SERIAL|REAL|DOUBLE)/i;

/** Línea de prosa española incrustada en DDL (ej. «application_id o NULL para system»). */
function isSqlProseArtifactLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("--")) return false;
  if (SQL_DDL_STATEMENT.test(t)) return false;
  if (SQL_COLUMN_DEF.test(t)) return false;
  if (/^\s*\)\s*;?\s*$/.test(t)) return false;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s+o\s+(NULL|null)\b/i.test(t)) return true;
  if (/\b(para|cuando|mediante|debe|puede|sin)\b/i.test(t) && !SQL_COLUMN_DEF.test(t)) return true;
  return false;
}

function repairSqlProseArtifactLine(line: string): string {
  const t = line.trim();
  const appNull = /^application_id\s+o\s+NULL\s+para\s+(\w+)/i.exec(t);
  if (appNull) {
    return `  application_id UUID, -- NULL for ${appNull[1]} actors`;
  }
  const actorNull = /^actor_id\s+o\s+NULL\s+para\s+(\w+)/i.exec(t);
  if (actorNull) {
    return `  actor_id UUID, -- NULL for ${actorNull[1]} actors`;
  }
  return `  -- ${t}`;
}

function prevLineHasDanglingSqlComment(prev: string): boolean {
  return /--\s*[\w\s,]+$/.test(prev.trim()) && !SQL_COLUMN_DEF.test(prev.trim());
}

/**
 * Limpia prosa y comentarios rotos dentro de bloques ```sql (p. ej. comentario partido en dos líneas).
 */
/** Fusiona comentarios SQL partidos en dos líneas (ej. `-- inmutable,` + `  particionado`). */
function repairSqlSplitCommentLines(sqlContent: string): string {
  const lines = sqlContent.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    const prev = out[out.length - 1];
    if (
      prev?.trim().startsWith("--") &&
      /^[a-záéíóúñ(]/i.test(t) &&
      !t.startsWith("--") &&
      !SQL_DDL_STATEMENT.test(t) &&
      !SQL_COLUMN_DEF.test(t)
    ) {
      out[out.length - 1] = `${prev.trimEnd()} ${t}`;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Separa comentarios `--` pegados a DDL (`CREATE TABLE`, `CREATE EXTENSION`, funciones, etc.). */
function repairSqlCommentGluedToDdl(sqlContent: string): string {
  return sqlContent.replace(
    /^(\s*--[^\n]*?)\s+(CREATE\s+(?:OR\s+REPLACE\s+)?(?:SCHEMA|TABLE|INDEX|EXTENSION|TYPE(?:\s+AS\s+ENUM)?|FUNCTION|TRIGGER))/gim,
    "$1\n$2",
  );
}

/** Fusiona llamadas partidas en varias líneas (p. ej. `NOW(\n);` → `NOW());`). */
function repairSqlSplitFunctionBody(sqlContent: string): string {
  return sqlContent
    .replace(/(\b(?:NOW|CURRENT_TIMESTAMP|gen_random_uuid)\()\s*\n\s*\)\s*;/gi, "$1));")
    .replace(/(\b(?:NOW|CURRENT_TIMESTAMP|gen_random_uuid)\()\s*\n\s*\)/gi, "$1))")
    .replace(/DEFAULT\s+(\w+)\(\s*\n\s*\)/gi, "DEFAULT $1())");
}

export function sanitizeSqlBrokenCommentsAndProse(sqlContent: string): string {
  if (!sqlContent || typeof sqlContent !== "string") return sqlContent;
  const repaired = repairSqlSplitFunctionBody(repairSqlCommentGluedToDdl(sqlContent));
  const lines = repairSqlSplitCommentLines(repaired).split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (isSqlProseArtifactLine(line)) {
      const prev = out[out.length - 1];
      if (prev != null && prevLineHasDanglingSqlComment(prev)) {
        const repairedLine = repairSqlProseArtifactLine(line);
        if (SQL_COLUMN_DEF.test(repairedLine.trim())) {
          out[out.length - 1] = prev.replace(/\s*--\s*[\w\s,]+\s*$/, "").trimEnd();
          if (!out[out.length - 1]!.endsWith(",")) {
            out[out.length - 1] = out[out.length - 1]!.replace(/\s*$/, ",");
          }
          out.push(repairedLine);
          continue;
        }
      }
      out.push(repairSqlProseArtifactLine(line));
      continue;
    }
    out.push(line);
  }

  return stripIndexesOnCommentedSqlColumns(
    repairSqlProseInTableBodies(
      repairSqlDetachedCheckConstraints(repairSqlOrphanTokensAndSplitParens(out.join("\n"))),
    ),
  );
}

/** Column name on a fully commented-out definition line (`-- embedding VECTOR(...)`). */
const SQL_COMMENTED_COLUMN_LINE = /^\s*--\s*,?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+/;

/**
 * Drops CREATE INDEX when it targets a column that only appears as a commented-out definition.
 * Typical LLM drift: `-- embedding VECTOR(1536)` left in CREATE TABLE but index on `embedding` kept.
 */
export function stripIndexesOnCommentedSqlColumns(sql: string): string {
  if (!sql?.trim()) return sql;

  const commentedColumns = new Set<string>();
  for (const line of sql.split("\n")) {
    const m = line.match(SQL_COMMENTED_COLUMN_LINE);
    if (m?.[1]) commentedColumns.add(m[1].toLowerCase());
  }
  if (commentedColumns.size === 0) return sql;

  const out: string[] = [];
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (/^CREATE\s+INDEX\b/i.test(trimmed)) {
      const parenMatch = trimmed.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const indexCols = parenMatch[1]
          .split(/\s*,\s*/)
          .map((c) => c.trim().replace(/^[\w.]+\./, "").toLowerCase());
        if (indexCols.some((c) => commentedColumns.has(c))) continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Elimina prosa huérfana entre definiciones de columnas dentro de CREATE TABLE.
 */
export function repairSqlProseInTableBodies(sql: string): string {
  if (!sql?.trim()) return sql;
  const tableRe =
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w.]+\s*\()([\s\S]*?)(\)\s*;)/gi;
  return sql.replace(tableRe, (_full, openPart: string, cols: string, close: string) => {
    const cleaned = cols
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        if (t.startsWith("--")) return true;
        if (SQL_DDL_STATEMENT.test(t)) return true;
        if (SQL_COLUMN_DEF.test(t)) return true;
        if (/^\s*\)\s*;?\s*$/.test(t)) return true;
        if (isSqlProseArtifactLine(line)) return false;
        return true;
      })
      .join("\n");
    return `${openPart}${cleaned}${close}`;
  });
}

/** Token suelto tras comentario `--` partido o columna de índice en línea siguiente. */
function isSqlOrphanEnumTokenLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("--")) return false;
  if (SQL_DDL_STATEMENT.test(t)) return false;
  if (SQL_COLUMN_DEF.test(t)) return false;
  if (/^\s*\)\s*;?\s*$/.test(t)) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(t);
}

function prevLineHasOpenParen(prev: string): boolean {
  const opens = (prev.match(/\(/g) ?? []).length;
  const closes = (prev.match(/\)/g) ?? []).length;
  return opens > closes;
}

/**
 * Segunda pasada SQL: fusiona tokens huérfanos (enum en comentario roto) y cierra paréntesis partidos en CREATE INDEX.
 */
function repairSqlOrphanTokensAndSplitParens(sql: string): string {
  const lines = sql.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    if (isSqlOrphanEnumTokenLine(line) && out.length > 0) {
      const prev = out[out.length - 1]!;
      if (/--/.test(prev)) {
        out[out.length - 1] = `${prev.trimEnd()} ${t}`;
        continue;
      }
      if (prevLineHasOpenParen(prev) || /CREATE\s+INDEX/i.test(prev)) {
        const sep = prev.trimEnd().endsWith(",") ? " " : ", ";
        out[out.length - 1] = `${prev.trimEnd()}${sep}${t}`;
        continue;
      }
    }

    if (/^\s*\)\s*;?\s*$/.test(t) && out.length > 0) {
      const prev = out[out.length - 1]!;
      if (prevLineHasOpenParen(prev)) {
        const suffix = t.includes(";") ? ");" : ")";
        out[out.length - 1] = `${prev.trimEnd()}${suffix}`;
        continue;
      }
    }

    out.push(line);
  }

  return out
    .join("\n")
    .replace(/(CREATE\s+INDEX\s+[^\n]+\([^)\n]+)\n\s*\)\s*;/gi, "$1);");
}

/** Línea de definición de columna sin CHECK inline, antes de un CHECK en la línea siguiente. */
function isSqlColumnDefLineBeforeDetachedCheck(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("--")) return false;
  if (SQL_DDL_STATEMENT.test(t)) return false;
  if (/\bCHECK\s*\(/i.test(t)) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*\s+.+/i.test(t);
}

/**
 * PostgreSQL exige coma antes de CHECK en línea aparte dentro de CREATE TABLE.
 * Corrige: `col TYPE DEFAULT 'x'\n  CHECK (...)` → `col TYPE DEFAULT 'x',\n  CHECK (...)`.
 */
export function repairSqlDetachedCheckConstraints(sql: string): string {
  if (!sql?.trim()) return sql;
  const lines = sql.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === "") j++;
    const nextTrim = lines[j]?.trim() ?? "";

    if (
      nextTrim &&
      /^\s*CHECK\s*\(/i.test(nextTrim) &&
      isSqlColumnDefLineBeforeDetachedCheck(line)
    ) {
      const trimmed = line.trimEnd();
      if (!trimmed.endsWith(",")) line = `${trimmed},`;
    }
    out.push(line);
  }
  return out.join("\n");
}

function extractMddSectionBody(draft: string, heading: string): { body: string; start: number; end: number } | null {
  const idx = draft.indexOf(heading);
  if (idx === -1) return null;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const end = nextH2 !== -1 ? sectionStart + nextH2 : draft.length;
  return { body, start: sectionStart, end };
}

const AUTHORITATIVE_BACKEND_PATTERNS: Array<[RegExp, string]> = [
  [/fastify/i, "Fastify"],
  [/fastapi/i, "FastAPI"],
  [/nestjs/i, "NestJS"],
  [/express/i, "Express"],
  [/django/i, "Django"],
];

/** Cláusulas alternativas de stack a eliminar en §1 cuando §2 ya fijó el backend. */
const ALTERNATE_BACKEND_CLAUSE_PATTERNS: Record<string, RegExp[]> = {
  Fastify: [
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*Python\s*\(\s*FastAPI\s*\)/gi,
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*FastAPI\b(?:\s*\([^)]*\))?/gi,
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*Python\b[^.\n;]*\bFastAPI\b/gi,
  ],
  FastAPI: [
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*Node\.js\s*\(\s*Fastify\s*\)/gi,
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*Fastify\b(?:\s*\([^)]*\))?/gi,
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*Node\.js\b[^.\n;]*\bFastify\b/gi,
  ],
  NestJS: [
    /\s*(?:,\s*)?(?:o|or|\/|\|)\s*(?:Python\s*\(\s*FastAPI\s*\)|FastAPI|Fastify|Express)\b[^.\n;]*/gi,
  ],
};

function resolveAuthoritativeBackendFromSection2(draft: string): string | undefined {
  const sec2 = extractMddSectionBody(draft, "## 2. Arquitectura y Stack");
  if (!sec2?.body.trim()) return undefined;
  for (const [re, label] of AUTHORITATIVE_BACKEND_PATTERNS) {
    if (re.test(sec2.body)) return label;
  }
  return undefined;
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

/**
 * Elimina menciones de stack alternativo en §1 (p. ej. FastAPI) cuando §2 ya fijó Fastify.
 */
export function stripAlternateBackendFromSection1(draft: string): string {
  if (!draft?.trim()) return draft;
  const backend = resolveAuthoritativeBackendFromSection2(draft);
  const patterns = backend ? ALTERNATE_BACKEND_CLAUSE_PATTERNS[backend] : undefined;
  if (!patterns?.length) return draft;

  const sec1 = extractMddSectionBody(draft, "## 1. Contexto");
  if (!sec1) return draft;

  let body = sec1.body;
  for (const re of patterns) {
    body = body.replace(re, "");
  }
  body = body.replace(/\s{2,}/g, " ").replace(/ +\n/g, "\n");
  if (body === sec1.body) return draft;
  return draft.slice(0, sec1.start) + body + draft.slice(sec1.end);
}

/**
 * Correcciones deterministas de coherencia cross-sección (sin LLM): monolito vs microservicios,
 * prefijo API en manifest, retención de auditoría.
 */
export function fixDeterministicMddCoherence(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  let out = draft;

  const arch = extractMddSectionBody(out, "## 2. Arquitectura y Stack");
  const isModularMonolith =
    arch != null &&
    /monolito\s+modular|única unidad de despliegue|single deployment|único despliegue/i.test(arch.body);

  if (isModularMonolith) {
    const infra = extractMddSectionBody(out, "## 7. Infraestructura");
    if (infra) {
      let body = infra.body;
      const replaced = body.replace(
        /\b(comunicaciones?|tráfico|conexiones?)\s+entre\s+microservicios?\b/gi,
        "$1 entre módulos internos del monolito",
      );
      const replaced2 = replaced.replace(
        /\bentre\s+microservicios?\b/gi,
        "entre módulos internos",
      );
      if (replaced2 !== body) {
        out = out.slice(0, infra.start) + replaced2 + out.slice(infra.end);
      }
    }
  }

  const manifestPrefixMatch = out.match(/"api_prefix"\s*:\s*"([^"]+)"/);
  const manifestPrefix = manifestPrefixMatch?.[1] ?? null;

  const contratos = extractMddSectionBody(out, "## 4. Contratos de API");
  if (contratos) {
    let body = contratos.body;
    const routeCounts = countSection4RoutePrefixes(body);
    const dominantPrefix = resolveDominantApiPrefix(routeCounts);

    if (manifestPrefix === "/api/v1") {
      if (routeCounts.bare > routeCounts.v1 && routeCounts.bare >= routeCounts.api) {
        body = prefixSection4TableRoutes(body, "/api/v1");
      }
      if (/\/api\/(?!v1[/"'])/i.test(body)) {
        body = upgradeSection4ApiRoutesToV1(body);
      }
    } else if (dominantPrefix && manifestPrefix && dominantPrefix !== manifestPrefix) {
      out = out.replace(
        /"api_prefix"\s*:\s*"[^"]*"/g,
        `"api_prefix": "${dominantPrefix}"`,
      );
    } else if (dominantPrefix && !manifestPrefix) {
      out = out.replace(
        /("integration_metadata"\s*:\s*\{)/,
        `$1\n    "api_prefix": "${dominantPrefix}",`,
      );
    }

    if (body !== contratos.body) {
      out = out.slice(0, contratos.start) + body + out.slice(contratos.end);
    }
  }

  const auditImmutableContext = [
    "## 5. Lógica y Edge Cases",
    "## 6. Seguridad",
    "## 7. Infraestructura",
  ].some((heading) => {
    const section = extractMddSectionBody(out, heading);
    return section != null && bodyImpliesImmutableAudit(section.body);
  });

  for (const heading of [
    "## 5. Lógica y Edge Cases",
    "## 6. Seguridad",
    "## 7. Infraestructura",
  ]) {
    const section = extractMddSectionBody(out, heading);
    if (!section) continue;
    const body = fixImmutableAuditRetentionInBody(section.body, auditImmutableContext);
    if (body !== section.body) {
      out = out.slice(0, section.start) + body + out.slice(section.end);
    }
  }

  out = fixLdapAuthCoherenceInDraft(out);
  out = fixSecurityManifestCoherence(out);
  out = fixIntegrationMetadataCoherence(out);
  out = alignJwtAlgorithmWithSection6(out);
  out = fixJwtEnvVarsInDraft(out);
  out = alignInfraNodeVersionWithSection2(out);
  out = stripStrayParenAfterJsonCodeBlocks(out);
  out = upgradeNonSection4ApiPathsToV1(out);
  out = deduplicateUatSections(out);
  out = stripAlternateBackendFromSection1(out);

  return out;
}

/** True si LDAP/AD es autenticación principal de usuarios humanos (§1, §2 o §6). */
export function draftUsesLdapPrimaryAuth(draft: string): boolean {
  if (!draft) return false;
  const ldapRe =
    /LDAP\/AD|Active\s+Directory|directorio\s+activo|autenticación\s+corporativa/i;
  for (const heading of ["## 1. Contexto", "## 2. Arquitectura y Stack", "## 6. Seguridad"]) {
    const section = extractMddSectionBody(draft, heading);
    if (section && ldapRe.test(section.body)) return true;
  }
  return ldapRe.test(draft);
}

/** Corrige §6 cuando LDAP es principal pero el texto exige Argon2id/bcrypt para todos los usuarios. */
function fixLdapAuthCoherenceInDraft(draft: string): string {
  if (!draftUsesLdapPrimaryAuth(draft)) return draft;
  const section = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!section) return draft;

  let body = section.body;
  const ldapUserPasswordRe =
    /Las contraseñas de los usuarios se almacenan hasheadas con Argon2id[^.\n]*\./i;
  if (ldapUserPasswordRe.test(body)) {
    body = body.replace(
      ldapUserPasswordRe,
      "Los usuarios corporativos no almacenan contraseña local; la validación se delega a LDAP/AD. Solo la cuenta bootstrap del super administrador usa hash local (Argon2id: memoria 64 MB, tiempo 3, paralelismo 4).",
    );
  }

  const genericHashRe =
    /El hashing de contraseñas usa Argon2id con sales aleatorias de 16 bytes\./i;
  if (genericHashRe.test(body)) {
    body = body.replace(
      genericHashRe,
      "El hashing local (Argon2id, sal 16 bytes) aplica únicamente al bootstrap del super administrador y a secretos de aplicación (client_secret_hash).",
    );
  }

  const manifestMfa = draft.match(/"mfa_strategy"\s*:\s*"([^"]+)"/i)?.[1];
  if (manifestMfa && !/\bMFA\b|\bTOTP\b/i.test(body)) {
    const mfaBullet = `- MFA obligatorio para roles privilegiados (admin_security, ciso) mediante ${manifestMfa} (RFC 6238), con registro en auditoría.`;
    const authHeading = body.search(/###\s+Autenticación/i);
    if (authHeading !== -1) {
      const lineEnd = body.indexOf("\n", authHeading);
      const insertAt = lineEnd === -1 ? body.length : lineEnd + 1;
      body = body.slice(0, insertAt) + mfaBullet + "\n" + body.slice(insertAt);
    } else {
      body = `${mfaBullet}\n${body}`;
    }
  }

  if (body === section.body) return draft;
  return draft.slice(0, section.start) + body + draft.slice(section.end);
}

/** True si §6 documenta JWT asimétrico (RS256, par de claves, JWKS). */
export function draftUsesRs256Jwt(draft: string): boolean {
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!sec6) return false;
  return /RS256|clave\s+pública|public\s+key|par\s+de\s+claves|JWKS|jwt.*asymmetr/i.test(sec6.body);
}

/** RS256 en MDD §6 o en entregables derivados (tasks, user stories) cuando §6 falta/truncada. */
export function corpusUsesRs256Jwt(mddMarkdown: string, extraCorpus = ""): boolean {
  if (draftUsesRs256Jwt(mddMarkdown)) return true;
  const extra = (extraCorpus ?? "").trim();
  if (!extra) return false;
  return /RS256|JWT_PRIVATE_KEY|JWT_PUBLIC_KEY|firmados?\s+con\s+RS256/i.test(extra);
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

/** Extrae algoritmo JWT documentado en §6 (SSOT). */
function extractJwtAlgorithmFromSection6(draft: string): "RS256" | "HS256" | null {
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!sec6) return null;
  if (/RS256|JWKS|clave\s+pública|public\s+key|par\s+de\s+claves|asymmetr/i.test(sec6.body)) {
    return "RS256";
  }
  if (/HS256|JWT_SECRET|simétric|symmetric|HMAC/i.test(sec6.body)) return "HS256";
  return null;
}

/** Extrae algoritmo JWT inferido de §7 / manifest. */
function extractJwtAlgorithmFromSection7(draft: string): "RS256" | "HS256" | null {
  const manifestAlg = draft.match(/"jwt_algorithm"\s*:\s*"(RS256|HS256)"/i)?.[1];
  if (manifestAlg) return manifestAlg.toUpperCase() as "RS256" | "HS256";
  const infra = extractMddSectionBody(draft, "## 7. Infraestructura");
  const body = infra?.body ?? draft;
  if (/JWT_PRIVATE_KEY|JWKS|RS256/i.test(body) && !/\bJWT_SECRET\b/.test(body)) return "RS256";
  if (/\bJWT_SECRET\b/.test(body) && !/JWT_PRIVATE_KEY/.test(body)) return "HS256";
  if (/jwks_enabled"\s*:\s*true/i.test(body)) return "RS256";
  if (/\(\s*HS256\s*\)/i.test(body)) return "HS256";
  if (/\(\s*RS256\s*\)/i.test(body)) return "RS256";
  return null;
}

/** True si §6 y §7 documentan algoritmos JWT distintos. */
export function detectJwtAlgorithmMismatch(draft: string): boolean {
  const s6 = extractJwtAlgorithmFromSection6(draft);
  const s7 = extractJwtAlgorithmFromSection7(draft);
  return s6 != null && s7 != null && s6 !== s7;
}

/** Alinea §7 al algoritmo JWT de §6 (SSOT). */
export function fixJwtAlgorithmCoherence(draft: string): string {
  return alignJwtAlgorithmWithSection6(draft);
}

/** Alinea §7 al algoritmo JWT de §6 (SSOT). */
function alignJwtAlgorithmWithSection6(draft: string): string {
  const s6Alg = extractJwtAlgorithmFromSection6(draft);
  if (!s6Alg || !detectJwtAlgorithmMismatch(draft)) return draft;
  let out = draft;

  const infra = extractMddSectionBody(out, "## 7. Infraestructura");
  if (infra) {
    let body = infra.body;
    if (s6Alg === "RS256") {
      body = body
        .replace(/\(\s*HS256\s*\)/gi, "(RS256)")
        .replace(/\bHS256\b/g, "RS256")
        .replace(/\bJWT_SECRET\b/g, "JWT_PRIVATE_KEY, JWT_PUBLIC_KEY");
      if (/"jwt_algorithm"\s*:\s*"HS256"/i.test(body)) {
        body = body.replace(/"jwt_algorithm"\s*:\s*"HS256"/gi, '"jwt_algorithm": "RS256"');
      } else if (!/"jwt_algorithm"\s*:/i.test(body)) {
        body = body.replace(
          /("security"\s*:\s*\{)/i,
          '$1\n      "jwt_algorithm": "RS256",',
        );
      }
      if (/"jwks_enabled"\s*:\s*false/i.test(body)) {
        body = body.replace(/"jwks_enabled"\s*:\s*false/gi, '"jwks_enabled": true');
      }
    } else {
      body = body
        .replace(/\(\s*RS256\s*\)/gi, "(HS256)")
        .replace(/JWT_PRIVATE_KEY,\s*JWT_PUBLIC_KEY/gi, "JWT_SECRET")
        .replace(/"jwt_algorithm"\s*:\s*"RS256"/gi, '"jwt_algorithm": "HS256"');
    }
    if (body !== infra.body) {
      out = out.slice(0, infra.start) + body + out.slice(infra.end);
    }
  }
  return out;
}

/** Extrae versión mayor de Node.js declarada en §2. */
export function extractNodeVersionFromSection2(draft: string): string | null {
  const arch = extractMddSectionBody(draft, "## 2. Arquitectura y Stack");
  if (!arch) return null;
  const patterns = [
    /Node\.?js\s*(?:LTS\s*)?(\d{2}(?:\.\d+)?)/i,
    /\|\s*Node(?:\.js)?\s*\|\s*(\d{2}(?:\.\d+)?)/i,
    /runtime\s+Node\s*(\d{2})/i,
  ];
  for (const re of patterns) {
    const m = arch.body.match(re);
    if (m?.[1]) return m[1].split(".")[0]!;
  }
  return null;
}

/** Corrige `node:XX` en §7/manifest para coincidir con la versión Node de §2. */
export function alignInfraNodeVersionWithSection2(draft: string): string {
  const nodeVer = extractNodeVersionFromSection2(draft);
  if (!nodeVer) return draft;
  let out = draft.replace(/node:(\d+)(-alpine)?/gi, (_, _v: string, suffix: string) =>
    `node:${nodeVer}${suffix ?? ""}`,
  );
  out = out.replace(/\bNode\s+(\d+)(-alpine)?\b/gi, (_, _v: string, suffix: string) =>
    `Node ${nodeVer}${suffix ?? ""}`,
  );
  return out;
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

/** Pasada final antes del delivery gate: alinea Node §2↔§7, calidad MDD, JSON §4 y duplicados (idempotente). */
export function applyPreDeliveryGateFixes(draft: string): string {
  let out = normalizeCanonicalMddSectionHeadings(draft ?? "");
  out = alignInfraNodeVersionWithSection2(out);
  out = repairNestedJsonFencesInDraft(out);
  out = repairDisplacedJsonBracesInContratosSection(out);
  out = closeUnclosedCodeFencesInDraft(out);
  out = applyMddQualityAutoRepairs(out).markdown;
  out = applyDeterministicCrossConsistencyFixes(out);
  out = sanitizeMermaidInDraft(out);
  out = ensureTechnicalMetadataBlockInDraft(out);
  if (mddHasDuplicateSectionHeadings(out)) {
    out = stripTrailingDuplicateMddSections(out);
    if (mddHasDuplicateSectionHeadings(out)) {
      out = deduplicateAndReorderMddSections(out);
    }
  }
  return out;
}

function extractInfraSectionBodyForNodeCheck(draft: string): string | null {
  const sec7 = extractMddSectionBody(draft, "## 7. Infraestructura");
  if (sec7?.body?.trim()) return sec7.body;
  const integration = extractMddSectionBody(draft, "## Integración");
  return integration?.body?.trim() ? integration.body : null;
}

/** Devuelve el mensaje de blocker si §7 cita `node:XX` distinto al declarado en §2. */
export function detectSection2Section7NodeVersionMismatchIssue(draft: string): string | null {
  const nodeVer = extractNodeVersionFromSection2(draft);
  if (!nodeVer) return null;
  const infraBody = extractInfraSectionBodyForNodeCheck(draft);
  if (infraBody == null) return null;
  const nodeMismatch =
    /node:(\d+)/i.test(infraBody) &&
    !new RegExp(`node:${nodeVer}(?:-|$)`, "i").test(infraBody);
  if (!nodeMismatch) return null;
  return `§7/manifest: versión Node distinta a §2 (esperado node:${nodeVer}-alpine).`;
}

/** Sustituye JWT_SECRET por JWT_PRIVATE_KEY/JWT_PUBLIC_KEY cuando §6 exige RS256. */
function fixJwtEnvVarsInDraft(draft: string): string {
  if (!draftUsesRs256Jwt(draft)) return draft;
  let out = draft;
  for (const heading of ["## 7. Infraestructura", "## Integración"]) {
    const section = extractMddSectionBody(out, heading);
    if (!section) continue;
    let body = section.body;
    const updated = body
      .replace(/\bJWT_SECRET\b/g, "JWT_PRIVATE_KEY, JWT_PUBLIC_KEY")
      .replace(
        /NODE_ENV,\s*JWT_PRIVATE_KEY,\s*JWT_PUBLIC_KEY,\s*JWT_EXPIRES_IN/gi,
        "NODE_ENV, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_EXPIRES_IN",
      );
    if (updated !== body) {
      out = out.slice(0, section.start) + updated + out.slice(section.end);
    }
  }
  return out;
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

function repairDisplacedJsonBracesInContratosSection(draft: string): string {
  const heading = "## 4. Contratos de API";
  const idx = draft.indexOf(heading);
  if (idx === -1) return draft;
  const sectionStart = idx + heading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const fixed = repairDisplacedJsonBracesInContratos(body);
  if (fixed === body) return draft;
  return draft.slice(0, sectionStart) + fixed + (nextH2 !== -1 ? rest.slice(nextH2) : "");
}

function isValidContratosOrInfraSubheading(line: string): boolean {
  const t = line.replace(/^###\s+/, "").trim();
  if (/^(GET|POST|PUT|DELETE|PATCH)\s+\//i.test(t)) return true;
  if (/^7\.\d+/i.test(t)) return true;
  if (/^Manifest/i.test(t)) return true;
  if (/^Autenticación|^Autorización|^Aspectos|^Flujos|^Validaciones|^Casos\s+Borde/i.test(t)) return true;
  if (t.length <= 55 && !/[.=]/.test(t) && !/^(Endpoint|Lista|Crea|Obtiene|Configura|Valida|Consulta|Recibe|Stage)\b/i.test(t)) {
    return true;
  }
  return false;
}

function demoteProseHeadingsInSectionBody(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      if (/^#{3,6}\s+(#{1,2}\s+)/.test(line.trim())) {
        return line.trim().replace(/^#{3,6}\s+(#{1,2}\s+)/, "$1");
      }
      if (!/^###\s+/.test(line)) return line;
      if (isValidContratosOrInfraSubheading(line)) return line;
      const text = line.replace(/^###\s+/, "").trim();
      if (/=/.test(text)) return text;
      if (/\.\s*$/.test(text)) return text;
      if (/^Stage\s+\d+\s+-/i.test(text)) return text;
      if (/^(Endpoint|Lista|Crea|Obtiene|Configura|Valida|Consulta|Recibe)\b/i.test(text)) return text;
      if (text.length > 80) return text;
      return text;
    })
    .join("\n");
}

/** Degrada `###` usados como prosa/labels en §4, §6 y §7. */
export function demoteProseHeadingsInSections(draft: string): string {
  let out = draft;
  for (const heading of ["## 4. Contratos de API", "## 6. Seguridad", "## 7. Infraestructura"]) {
    const section = extractMddSectionBody(out, heading);
    if (!section) continue;
    const fixed = demoteProseHeadingsInSectionBody(section.body);
    if (fixed !== section.body) {
      out = out.slice(0, section.start) + fixed + out.slice(section.end);
    }
  }
  return out;
}

/** Elimina `}` suelto inmediatamente después de un bloque ```json ya balanceado. */
function stripStrayBraceAfterJsonCodeBlocks(draft: string): string {
  if (!draft) return draft;
  return draft.replace(/(```json[\s\S]*?```)\s*\n\}\s*\n/g, "$1\n");
}

/** Quita ## UI/UX Design Intent cuando §1/§2 declaran MVP API+CLI sin panel web. */
export function stripUiUxSectionForApiOnlyMvp(markdown: string): string {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed || !/##\s*UI\/UX\s+Design\s+Intent/i.test(trimmed)) return markdown;
  if (!mddExcludesWebUiSurface(trimmed)) return markdown;
  return `${trimmed.replace(/\n##\s*UI\/UX\s+Design\s+Intent[\s\S]*$/i, "").trimEnd()}\n`;
}

/** Re-aplica despegado de headings y reglas horizontales rotas tras pasos que pueden recompactar §1. */
function finalizeMddPersistFormatting(mddMarkdown: string): string {
  if (!mddMarkdown?.trim()) return mddMarkdown;
  let out = repairGluedMarkdownHeadings(mddMarkdown);
  out = collapseInlineHorizontalRules(out);
  out = ensureHorizontalRuleBeforeH2(out);
  out = collapseConsecutiveHorizontalRules(out);
  return out;
}

/**
 * Elimina líneas basura: `#` solo, `# ---` (HR confundido con heading),
 * y headings vacíos sin texto (artefactos LLM).
 */
export function repairGarbageHeadings(draft: string): string {
  if (!draft) return draft;
  let text = draft.replace(/^#\s+([A-ZÁÉÍÓÚÑ][^\n#]{40,})$/gm, "$1");
  text = text.replace(/^#\s+(_[^\n]+_\.?)\s*$/gm, "$1");
  text = text.replace(/^#\s+(_[^\n]+)$/gm, "$1");
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = (lines[i] ?? "").trim();
    // Bare "#" alone
    if (/^#\s*$/.test(t)) continue;
    // "# ---" or "# --- --- ---" (horizontal rule rendered as heading)
    if (/^#\s+[-\s]*-[-\s]*-[-\s]*[-\s]*$/.test(t)) continue;
    // "### Heading.**Label:**" — heading glued to bold label (already split by repairGluedApiContractLines)
    // but if the heading text is just punctuation, skip
    if (/^#{1,6}\s+[.\-_=]{1,3}\s*$/.test(t)) continue;
    out.push(lines[i]!);
  }
  return out.join("\n");
}

/**
 * Cierra el JSON del manifest en §7 si falta la llave de cierre raíz.
 * Patrones: último contenido antes de ``` es `}` de sub-objeto sin `}` raíz.
 */
export function repairManifestJsonClosing(draft: string): string {
  const manifestIdx = draft.indexOf("### Manifest");
  if (manifestIdx === -1) return draft;
  const section7Idx = draft.indexOf("## 7.");
  if (section7Idx === -1 || manifestIdx < section7Idx) {
    // Manifest is in §7 area
  }
  // Find the ```json block after ### Manifest
  const jsonFenceStart = draft.indexOf("```json", manifestIdx);
  if (jsonFenceStart === -1) return draft;
  const fenceClose = draft.indexOf("```", jsonFenceStart + 7);
  if (fenceClose === -1) return draft;
  const inner = draft.slice(jsonFenceStart + 7, fenceClose).trim();
  if (!inner) return draft;
  // Count brace balance
  let braces = 0;
  let inString = false;
  let escape = false;
  for (const ch of inner) {
    if (escape) { escape = false; continue; }
    if (inString) { if (ch === "\\") escape = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") braces++;
    if (ch === "}") braces--;
  }
  if (braces <= 0) return draft;
  // Add missing closing braces
  const closingBraces = "}".repeat(braces);
  const before = draft.slice(0, fenceClose);
  const after = draft.slice(fenceClose);
  // Also strip any garbage between last `}` and the fence close
  const lastBrace = before.lastIndexOf("}");
  const cleaned = before.slice(0, lastBrace + 1) + closingBraces + "\n" + after;
  return cleaned;
}

/**
 * SSOT al persistir MDD (Workshop, doc-gap reconcile, export/handoff).
 * Orden: headings pegados → coherencia cruzada → JSON §4 → UI/UX MVP → finalize (headings/HR).
 */
export function sanitizeMddAtPersist(mddMarkdown: string): string {
  if (!mddMarkdown?.trim()) return mddMarkdown;
  let out = fixGluedSection6Heading(mddMarkdown);
  out = repairGarbageHeadings(out);
  out = stripOrphanFenceWrappingProse(out);
  out = stripEmptyBareCodeFences(out);
  out = closeUnclosedCodeFencesInDraft(out);
  out = demoteProseHeadingsInSections(out);
  out = applyDeterministicCrossConsistencyFixes(out);
  out = ensureSecurityLockoutInSection6(out);
  out = repairNestedJsonFencesInDraft(out);
  out = repairDisplacedJsonBracesInContratosSection(out);
  out = repairManifestJsonClosing(out);
  out = stripStrayParenAfterJsonCodeBlocks(out);
  out = stripStrayBraceAfterJsonCodeBlocks(out);
  out = stripStrayParenBeforeH2(out);
  out = collapseInlineHorizontalRules(out);
  out = stripUiUxSectionForApiOnlyMvp(out);
  return finalizeMddPersistFormatting(out);
}

/**
 * Persistencia MDD unificada (NEW + LEGACY): fences/tablas/headings vía formatDocumentMarkdown,
 * luego coherencia determinista vía sanitizeMddAtPersist. Idempotente en re-aplicaciones.
 */
export function prepareMddMarkdownForPersist(mddMarkdown: string): string {
  if (!mddMarkdown?.trim()) return mddMarkdown;
  const preservedGov = extractGovernanceSection(mddMarkdown);
  const lockedPatternIds = selectedPatternIdsFromMdd(mddMarkdown);
  let body = normalizeCanonicalMddSectionHeadings(mddMarkdown);
  body = peelDocumentBodyForPersist(body);
  let formatted = formatDocumentMarkdown(body);
  let sanitized = sanitizeMddAtPersist(formatted);
  formatted = formatDocumentMarkdown(sanitized);
  if (lockedPatternIds.size > 0) {
    formatted = updateMddGovernancePatterns(formatted, lockedPatternIds);
  } else if (preservedGov && !hasGovernanceSection(formatted)) {
    formatted = ensureMddGovernanceSection(formatted, preservedGov);
  }
  formatted = repairGarbageHeadings(formatted);
  formatted = repairOrphanFenceBeforeContractLabels(formatted);
  formatted = repairUnclosedJsonBeforeApiEndpoint(formatted);
  formatted = repairApiContractJsonFences(formatted);
  formatted = repairApiResponse204NoContent(formatted);
  formatted = normalizeCanonicalMddSectionHeadings(formatted);
  formatted = finalizeMddPersistFormatting(formatted);
  return formatted;
}

/**
 * MDD persistido en BD sin cabecera de fechas (evita corrupción stamp+cuerpo).
 * Limpia stamps legados vía peel antes de formatear.
 */
export function storeMddMarkdownForPersist(mddMarkdown: string): string {
  return prepareMddMarkdownForPersist(mddMarkdown);
}

/** Sanitiza MDD antes de exportar al handoff (misma pasada que persist). */
export function sanitizeMddForExport(mddMarkdown: string): string {
  return sanitizeMddAtPersist(mddMarkdown);
}

/** Elimina paréntesis suelto inmediatamente después de un bloque ```json. */
export function stripStrayParenAfterJsonCodeBlocks(draft: string): string {
  if (!draft) return draft;
  return draft.replace(/(```json[\s\S]*?```)\s*\)/g, "$1");
}

/** Alinea manifest §7 (security) con LDAP y estrategia MFA del borrador. */
function fixSecurityManifestCoherence(draft: string): string {
  const infra = extractMddSectionBody(draft, "## 7. Infraestructura");
  if (!infra || !/```json/i.test(infra.body)) return draft;

  let body = infra.body;
  const usesLdap = draftUsesLdapPrimaryAuth(draft);
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  const mfaInSec6 = sec6 != null && /\bMFA\b|\bTOTP\b/i.test(sec6.body);
  const manifestMfa = draft.match(/"mfa_strategy"\s*:\s*"([^"]+)"/i)?.[1];
  const sec6MentionsArgon2 = sec6 != null && /Argon2(?:id)?/i.test(sec6.body);
  const sec6MentionsBcryptOnly =
    sec6 != null && /\bbcrypt\b/i.test(sec6.body) && !/Argon2(?:id)?/i.test(sec6.body);

  if (usesLdap) {
    if (!/"auth_provider"\s*:/i.test(body)) {
      body = body.replace(
        /("security"\s*:\s*\{)/i,
        '$1\n      "auth_provider": "LDAP/AD",',
      );
    }
    if (sec6MentionsBcryptOnly) {
      body = body.replace(/"hashing_algorithm"\s*:\s*"Argon2id"/gi, '"hashing_algorithm": "bcrypt"');
      if (!/"hashing_scope"\s*:/i.test(body)) {
        body = body.replace(
          /"hashing_algorithm"\s*:\s*"[^"]*"/i,
          (m) => `${m},\n      "hashing_scope": "bootstrap_and_service_secrets_only"`,
        );
      }
    } else if (sec6MentionsArgon2) {
      body = body.replace(/"hashing_algorithm"\s*:\s*"bcrypt"/gi, '"hashing_algorithm": "Argon2id"');
      if (!/"hashing_scope"\s*:/i.test(body)) {
        body = body.replace(
          /"hashing_algorithm"\s*:\s*"[^"]*"/i,
          (m) => `${m},\n      "hashing_scope": "bootstrap_and_service_secrets_only"`,
        );
      }
    }
  }

  if (mfaInSec6 && manifestMfa && !/"mfa_strategy"\s*:/i.test(body)) {
    body = body.replace(
      /("security"\s*:\s*\{)/i,
      `$1\n      "mfa_strategy": "${manifestMfa}",`,
    );
  }

  if (sec6MentionsBcryptOnly && /"hashing_algorithm"\s*:\s*"Argon2id"/i.test(body)) {
    body = body.replace(/"hashing_algorithm"\s*:\s*"Argon2id"/gi, '"hashing_algorithm": "bcrypt"');
  }
  if (sec6MentionsArgon2 && /"hashing_algorithm"\s*:\s*"bcrypt"/i.test(body)) {
    body = body.replace(/"hashing_algorithm"\s*:\s*"bcrypt"/gi, '"hashing_algorithm": "Argon2id"');
    if (!/"hashing_scope"\s*:/i.test(body)) {
      body = body.replace(
        /"hashing_algorithm"\s*:\s*"[^"]*"/i,
        (m) => `${m},\n      "hashing_scope": "local_passwords_and_bootstrap"`,
      );
    }
  }

  if (body === infra.body) return draft;
  return draft.slice(0, infra.start) + body + draft.slice(infra.end);
}

/** True si el MDD exige multi-tenant (TechnicalMetadata, §2, §3 o §6). */
function mddRequiresMultiTenant(draft: string): boolean {
  if (/\[multi_tenant\]/i.test(draft)) return true;
  if (/```TechnicalMetadata[\s\S]*?\[multi_tenant\]/i.test(draft)) return true;
  const sec2 = extractMddSectionBody(draft, "## 2. Arquitectura y Stack");
  const sec3 = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  const corpus = [sec2?.body, sec3?.body, sec6?.body].filter(Boolean).join("\n");
  if (/multi[\s-]?tenant|multitenanc|\btenant_id\b|multiinquilino|aislamiento\s+multi[\s-]?inquilino/i.test(corpus)) {
    return true;
  }
  if (sec3?.body && countNegocioIdMultiTenantSignals(sec3.body)) return true;
  return false;
}

/** Heurística: negocio_id en la mayoría de tablas §3 implica multi-tenant. */
function countNegocioIdMultiTenantSignals(section3Body: string): boolean {
  const createTableCount = (section3Body.match(/CREATE\s+TABLE/gi) ?? []).length;
  const negocioIdCount = (section3Body.match(/\bnegocio_id\b/gi) ?? []).length;
  return createTableCount >= 2 && negocioIdCount >= 3 && negocioIdCount >= createTableCount * 0.5;
}

/** Alinea integration_metadata.multi_tenant_support con TechnicalMetadata y §2/§3. */
function fixIntegrationMetadataCoherence(draft: string): string {
  const infra = extractMddSectionBody(draft, "## 7. Infraestructura");
  if (!infra || !/"multi_tenant_support"/i.test(infra.body)) return draft;
  const requiresMultiTenant = mddRequiresMultiTenant(draft);
  let body = infra.body;
  if (requiresMultiTenant) {
    body = body.replace(/"multi_tenant_support"\s*:\s*false/gi, '"multi_tenant_support": true');
  }
  if (body === infra.body) return draft;
  return draft.slice(0, infra.start) + body + draft.slice(infra.end);
}

/** Promueve referencias `/api/...` en §5–§7 cuando el manifest declara `/api/v1`. */
function upgradeNonSection4ApiPathsToV1(draft: string): string {
  const manifestPrefix = draft.match(/"api_prefix"\s*:\s*"([^"]+)"/)?.[1];
  if (manifestPrefix !== "/api/v1") return draft;

  let out = draft;
  for (const heading of [
    "## 5. Lógica y Edge Cases",
    "## 6. Seguridad",
    "## 7. Infraestructura",
  ]) {
    const section = extractMddSectionBody(out, heading);
    if (!section || !/\/api\/(?!v1\/)/i.test(section.body)) continue;
    const body = section.body.replace(/\/api\/(?!v1[/"'])/gi, "/api/v1/");
    out = out.slice(0, section.start) + body + out.slice(section.end);
  }
  return out;
}

function countSection4RoutePrefixes(body: string): { bare: number; api: number; v1: number } {
  const counts = { bare: 0, api: 0, v1: 0 };
  const routes = body.matchAll(/\|\s*(?:GET|POST|PUT|DELETE|PATCH)\s*\|\s*(\/[^\s|]+)/gi);
  for (const match of routes) {
    const path = match[1] ?? "";
    if (path.startsWith("/api/v1/") || path === "/api/v1") counts.v1++;
    else if (path.startsWith("/api/") || path === "/api") counts.api++;
    else counts.bare++;
  }
  return counts;
}

function resolveDominantApiPrefix(counts: { bare: number; api: number; v1: number }): string | null {
  const { bare, api, v1 } = counts;
  const total = bare + api + v1;
  if (total === 0) return null;
  if (v1 >= api && v1 >= bare) return "/api/v1";
  if (api >= bare) return "/api";
  return "/";
}

/** Antepone prefijo a rutas de la tabla resumen §4 que no llevan /api. */
function prefixSection4TableRoutes(body: string, prefix: string): string {
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return body.replace(
    /(\|\s*(?:GET|POST|PUT|DELETE|PATCH)\s*\|\s*)(\/(?!api\/)([^\s|]+))/gi,
    (_, lead: string, path: string) => `${lead}${normalized}${path}`,
  );
}

/** Promueve rutas `/api/...` a `/api/v1/...` en tabla y headings de §4 (manifest declara v1). */
function upgradeSection4ApiRoutesToV1(body: string): string {
  const toV1 = (path: string) => path.replace(/\/api\/(?!v1[/"'])/gi, "/api/v1/");
  let out = body.replace(
    /(\|\s*(?:GET|POST|PUT|DELETE|PATCH)\s*\|\s*)(`?)(\/api\/(?!v1[/"'])[^\s`|]+)(`?)/gi,
    (_m, lead: string, q1: string, path: string, q2: string) =>
      `${lead}${q1}${toV1(path)}${q2}`,
  );
  out = out.replace(
    /(#{2,6}\s*(?:GET|POST|PUT|DELETE|PATCH)\s+)(\/api\/(?!v1[/"'])[^\s\n]+)/gi,
    (_m, lead: string, path: string) => `${lead}${toV1(path)}`,
  );
  return out;
}

function bodyImpliesImmutableAudit(body: string): boolean {
  return /inmutable|append-only|no pueden ser modificados ni eliminados|previene\s+UPDATE\s+y\s+DELETE|nunca\s+UPDATE|solo\s+INSERT/i.test(
    body,
  );
}

function bodyHasDestructiveAuditRetention(body: string): boolean {
  return /elimina(?:r)?\s+particiones|drop\s+de\s+particiones|drop\s+particiones|dropea\s+la\s+partici[oó]n|dropea\s+de\s+la\s+base|purga(?:n)?\s+autom[aá]ticamente|purga\s+controlada|purga\s+la\s+base\s+de\s+datos|job\s+de\s+drop|drop\s+de\s+partici[oó]n|dropea\s+la\s+partici[oó]n\s+correspondiente|elimina\s+de\s+la\s+tabla\s+[`']?audit_events[`']?|elimina\s+de\s+audit_events|se\s+elimina\s+de\s+la\s+tabla/i.test(
    body,
  );
}

/** Sustituye purga/drop destructivo cuando el texto exige auditoría inmutable. */
function fixImmutableAuditRetentionInBody(
  body: string,
  draftHasImmutableAuditContext = false,
): string {
  if (
    !bodyHasDestructiveAuditRetention(body) ||
    (!draftHasImmutableAuditContext && !bodyImpliesImmutableAudit(body))
  ) {
    return body;
  }
  return body
    .replace(
      /Los eventos solo se purga(?:n)?\s+autom[aá]ticamente[^.\n]*/gi,
      "Los eventos solo se archivan a cold storage inmutable al cumplir 5 años (detach de partición, sin DELETE de filas)",
    )
    .replace(
      /purga(?:n)?\s+autom[aá]ticamente[^.\n]*/gi,
      "archiva particiones completas a cold storage inmutable tras exportación verificada",
    )
    .replace(
      /purga\s+controlada[^.\n]*/gi,
      "archivado a cold storage inmutable (sin DELETE en filas de auditoría)",
    )
    .replace(
      /dropea\s+la\s+partici[oó]n\s+correspondiente[^.\n]*/gi,
      "archiva la partición correspondiente a cold storage inmutable tras exportación verificada",
    )
    .replace(
      /exporta\s+la\s+partici[oó]n\s+a\s+backup\s+fr[ií]o[^.\n]*\s+y\s+la\s+dropea[^.\n]*/gi,
      "exporta la partición a backup frío (S3/Blob) y la desacopla (DETACH) sin borrar el archivo inmutable",
    )
    .replace(
      /elimina(?:r)?\s+particiones[^.\n]*/gi,
      "archiva particiones completas a almacenamiento cold storage inmutable",
    )
    .replace(
      /drop\s+de\s+particiones[^.\n]*/gi,
      "archiva particiones completas a almacenamiento cold storage inmutable",
    )
    .replace(
      /drop\s+particiones[^.\n]*/gi,
      "archiva particiones completas a almacenamiento cold storage inmutable",
    )
    .replace(
      /job\s+de\s+drop\s+de\s+partici[oó]n[^.\n]*/gi,
      "job de archivado y detach de partición a cold storage inmutable",
    )
    .replace(
      /elimina\s+de\s+la\s+tabla\s+[`']?audit_events[`']?[^.\n]*/gi,
      "archiva filas de audit_events a cold storage inmutable (detach de partición, sin DELETE)",
    )
    .replace(
      /elimina\s+de\s+audit_events[^.\n]*/gi,
      "archiva registros de audit_events a cold storage inmutable (sin DELETE en filas)",
    )
    .replace(
      /se\s+elimina\s+de\s+la\s+tabla[^.\n]*/gi,
      "se archiva a cold storage inmutable (detach de partición, sin DELETE en filas de auditoría)",
    )
    .replace(
      /purga\s+la\s+base\s+de\s+datos[^.\n]*/gi,
      "archiva datos de auditoría a cold storage inmutable (sin purga destructiva de filas)",
    );
}

const OUTBOX_TABLE_DDL = `
-- =====================================================
-- Outbox (Outbox Pattern) — eventos pendientes de publicar
-- =====================================================
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX idx_outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;
`;

const OUTBOX_LIKE_STATUS_COLUMN_RE =
  /\b(procesado|processed_at|published_at|retry_count|event_type|tipo_evento|evento_tipo)\b/i;

function isOutboxLikeTableDef(tableName: string, colsBody: string): boolean {
  const bare = tableName.includes(".") ? tableName.split(".").pop()! : tableName;
  const lower = bare.toLowerCase();
  if (/^(outbox_events|eventos_outbox|outbox)$/.test(lower)) return true;
  if (lower === "eventos") {
    const hasPayload = /\bpayload(_json)?\b/i.test(colsBody);
    const hasStatus =
      OUTBOX_LIKE_STATUS_COLUMN_RE.test(colsBody) || /\bidempotency_key\b/i.test(colsBody);
    return hasPayload && hasStatus;
  }
  return /\bpayload(_json)?\b/i.test(colsBody) && OUTBOX_LIKE_STATUS_COLUMN_RE.test(colsBody);
}

function listOutboxLikeTablesInSql(sql: string): string[] {
  const found: string[] = [];
  const tableRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([\w]+)\.)?([\w]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(sql)) !== null) {
    const schema = m[1];
    const name = m[2]!;
    const cols = m[3]!;
    const qualified = (schema ? `${schema}.${name}` : name).toLowerCase();
    if (isOutboxLikeTableDef(qualified, cols)) found.push(qualified);
  }
  return found;
}

function listOutboxLikeTablesInDraft(draft: string): string[] {
  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section) return [];
  const tables: string[] = [];
  for (const [, inner] of section.body.matchAll(/```sql\s*([\s\S]*?)```/gi)) {
    if (!inner) continue;
    for (const t of listOutboxLikeTablesInSql(inner)) {
      if (!tables.includes(t)) tables.push(t);
    }
  }
  return tables;
}

function bareOutboxTableName(qualified: string): string {
  return qualified.includes(".") ? qualified.split(".").pop()! : qualified;
}

function resolveCanonicalOutboxTableName(draft: string, tables: string[]): string {
  for (const heading of [
    "## 2. Arquitectura y Stack",
    "## 5. Lógica y Edge Cases",
    "## 7. Infraestructura",
  ]) {
    const section = extractMddSectionBody(draft, heading);
    if (!section) continue;
    for (const t of tables) {
      const bare = bareOutboxTableName(t);
      if (new RegExp(`\\btabla\\s+${bare}\\b|\\b${bare}\\b`, "i").test(section.body)) return t;
    }
  }
  const priority = ["outbox_events", "eventos_outbox", "eventos", "outbox"];
  for (const p of priority) {
    const match = tables.find((t) => t === p || t.endsWith(`.${p}`));
    if (match) return match;
  }
  return tables[0]!;
}

function removeOutboxLikeTableFromSql(sql: string, tableToRemove: string): string {
  const bare = bareOutboxTableName(tableToRemove);
  const escaped = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const schemaPrefix = tableToRemove.includes(".")
    ? `${tableToRemove.split(".")[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`
    : "";
  const tableRe = new RegExp(
    `(?:--[^\\n]*Outbox[^\\n]*\\n(?:--[^\\n]*\\n)*)?CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${schemaPrefix}${escaped}\\s*\\([\\s\\S]*?\\)\\s*;\\s*(?:CREATE\\s+INDEX\\s+idx_${escaped}[^\\n]*;\\s*)?`,
    "gi",
  );
  return sql.replace(tableRe, "").replace(/\n{3,}/g, "\n\n").trim();
}

function unifyOutboxReferencesInDraft(draft: string, canonicalBare: string): string {
  const aliases = ["outbox", "outbox_events", "eventos_outbox", "eventos"];
  let out = draft;
  for (const alias of aliases) {
    if (alias === canonicalBare) continue;
    for (const heading of [
      "## 2. Arquitectura y Stack",
      "## 5. Lógica y Edge Cases",
      "## 7. Infraestructura",
    ]) {
      const section = extractMddSectionBody(out, heading);
      if (!section) continue;
      const re = new RegExp(`(\\btabla\\s+)${alias}\\b`, "gi");
      const body = section.body.replace(re, `$1${canonicalBare}`);
      if (body !== section.body) {
        out = out.slice(0, section.start) + body + out.slice(section.end);
      }
    }
  }
  return out;
}

function draftReferencesOutboxTable(draft: string): boolean {
  return /tabla\s+(?:outbox_events|eventos_outbox|outbox|eventos)\b|eventos\s+no\s+publicados\s+de\s+la\s+tabla\s+(?:outbox_events|eventos_outbox|outbox|eventos)|lee\s+los\s+eventos\s+no\s+publicados|Outbox\s+Pattern/i.test(
    draft,
  );
}

function draftHasOutboxTable(draft: string): boolean {
  return listOutboxLikeTablesInDraft(draft).length > 0;
}

/** True si §3 define 2+ tablas outbox-like (outbox, eventos+payload, outbox_events, etc.). */
export function detectDuplicateOutboxTables(draft: string): boolean {
  return listOutboxLikeTablesInDraft(draft).length >= 2;
}

/**
 * Elimina tablas outbox-like duplicadas cuando ya existe una canónica referenciada en §2/§5/§7.
 */
export function deduplicateOutboxTablesInDraft(draft: string): string {
  if (!draft || !detectDuplicateOutboxTables(draft)) return draft;

  const tables = listOutboxLikeTablesInDraft(draft);
  const canonical = resolveCanonicalOutboxTableName(draft, tables);
  const toRemove = tables.filter((t) => t !== canonical);
  if (toRemove.length === 0) return draft;

  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section) return draft;

  let body = section.body;
  const sqlRe = /```sql\s*([\s\S]*?)```/gi;
  let changed = false;
  body = body.replace(sqlRe, (full, inner: string) => {
    let cleaned = inner;
    let blockChanged = false;
    for (const table of toRemove) {
      const next = removeOutboxLikeTableFromSql(cleaned, table);
      if (next !== cleaned) {
        cleaned = next;
        blockChanged = true;
      }
    }
    if (!blockChanged || cleaned === inner.trim()) return full;
    changed = true;
    return "```sql\n" + cleaned + "\n```";
  });

  if (!changed) return draft;
  let out = draft.slice(0, section.start) + body + draft.slice(section.end);
  out = unifyOutboxReferencesInDraft(out, bareOutboxTableName(canonical));
  return out;
}

/**
 * Alinea narrativa §7 (y §2/§5) con la tabla outbox canónica de §3.
 */
export function fixSection7OutboxNarrative(draft: string): string {
  if (!draft?.trim()) return draft;
  const tables = listOutboxLikeTablesInDraft(draft);
  if (tables.length === 0) return draft;
  const canonical = resolveCanonicalOutboxTableName(draft, tables);
  const bare = bareOutboxTableName(canonical);
  let out = unifyOutboxReferencesInDraft(draft, bare);
  const aliases = ["outbox", "outbox_events", "eventos_outbox"];
  for (const alias of aliases) {
    if (alias === bare) continue;
    const tablaRe = new RegExp(`(\\btabla\\s+)${alias}\\b`, "gi");
    out = out.replace(tablaRe, `$1${bare}`);
    const genericOutboxRe = /\btabla\s+outbox\b(?!\w)/gi;
    if (bare !== "outbox") {
      out = out.replace(genericOutboxRe, `tabla ${bare}`);
    }
  }
  return out;
}

/** Añade CREATE TABLE outbox en §3 si §7/§2 la mencionan y falta cualquier tabla outbox-like. */
export function ensureOutboxTableInDraft(draft: string): string {
  if (!draft || !draftReferencesOutboxTable(draft) || draftHasOutboxTable(draft)) return draft;
  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section) return draft;

  let body = section.body;
  const sqlRe = /```sql\s*([\s\S]*?)```/i;
  if (!sqlRe.test(body)) return draft;

  body = body.replace(sqlRe, (full, inner: string) => {
    if (listOutboxLikeTablesInSql(inner).length > 0) {
      return full;
    }
    return "```sql\n" + inner.trimEnd() + OUTBOX_TABLE_DDL + "\n```";
  });

  if (body === section.body) return draft;
  return draft.slice(0, section.start) + body + draft.slice(section.end);
}

/**
 * Patrón dual alternativo: un mismo POST …/:requestId/approve (1.ª/2.ª) + execute/reject.
 * Válido cuando el flujo documenta estados y 409 por mismo aprobador.
 */
export function draftHasRequestIdDualApprovalApi(draft: string): boolean {
  const contratos = extractMddSectionBody(draft, "## 4. Contratos de API");
  if (!contratos) return false;
  const body = contratos.body;
  const hasRequestApprove =
    /\/:requestId\/approve\b|\/:requestId\/approve/i.test(body) ||
    /\/export\/[^/\s\n]*:requestId\/approve/i.test(body);
  const hasExecuteOrReject =
    /\/:requestId\/(?:execute|reject)\b|\/:requestId\/(?:execute|reject)/i.test(body);
  return hasRequestApprove && hasExecuteOrReject;
}

const DUAL_APPROVAL_TABLES = ["approval_requests", "export_requests"] as const;

/** True si §1, §4 o §5 exigen aprobación dual / control dual. */
export function draftRequiresDualApproval(draft: string): boolean {
  if (!draft) return false;
  const pattern =
    /aprobación\s+dual|dual\s+control|dos\s+administradores|two\s+approvers|segunda\s+aprobación/i;
  for (const heading of ["## 1. Contexto", "## 4. Contratos de API", "## 5. Lógica y Edge Cases"]) {
    const section = extractMddSectionBody(draft, heading);
    if (section && pattern.test(section.body)) return true;
  }
  return pattern.test(draft);
}

function fixDualApprovalTableSqlBlock(sqlBlock: string): string {
  let out = sqlBlock;
  for (const table of DUAL_APPROVAL_TABLES) {
    const tableRe = new RegExp(
      `(CREATE\\s+TABLE\\s+${table}\\s*\\([\\s\\S]*?\\)\\s*;)`,
      "gi",
    );
    out = out.replace(tableRe, (block) => {
      if (/second_approver_id/i.test(block)) return block;
      let fixed = block;
      if (/\bapproved_by\b/i.test(fixed) && !/first_approver_id/i.test(fixed)) {
        fixed = fixed.replace(/\bapproved_by\b/gi, "first_approver_id");
      }
      if (/first_approver_id/i.test(fixed)) {
        if (/(first_approver_id\s+UUID[^,\n]*,)/i.test(fixed)) {
          fixed = fixed.replace(
            /(first_approver_id\s+UUID[^,\n]*,)/i,
            "$1\n  second_approver_id UUID REFERENCES users(id),",
          );
        } else {
          fixed = fixed.replace(
            /(first_approver_id\s+UUID(?:\s+REFERENCES\s+users\(id\))?)(\s*)(?=\n)/i,
            "$1,\n  second_approver_id UUID REFERENCES users(id)$2",
          );
        }
      }
      fixed = fixed.replace(
        /CHECK\s*\(\s*status\s+IN\s*\(\s*'pending'\s*,\s*'approved'\s*,\s*'rejected'\s*\)\s*\)/i,
        "CHECK (status IN ('pending', 'first_approved', 'approved', 'rejected', 'expired', 'completed'))",
      );
      return fixed;
    });
  }
  return out;
}

function fixDualApprovalMermaidBlock(mermaid: string): string {
  let out = mermaid;
  for (const table of DUAL_APPROVAL_TABLES) {
    const entityRe = new RegExp(`(${table}\\s*\\{[\\s\\S]*?\\})`, "gi");
    out = out.replace(entityRe, (entity) => {
      if (/second_approver_id/i.test(entity)) return entity;
      if (!/\bapproved_by\b/i.test(entity) && !/first_approver_id/i.test(entity)) return entity;
      let fixed = entity.replace(/\buuid\s+approved_by\s+FK\b/gi, "uuid first_approver_id FK");
      if (!/first_approver_id/i.test(fixed)) {
        fixed = fixed.replace(/\bapproved_by\b/gi, "first_approver_id");
      }
      if (!/second_approver_id/i.test(fixed)) {
        fixed = fixed.replace(/(first_approver_id\s+FK\s*\n)/i, "$1    uuid second_approver_id FK\n");
      }
      return fixed;
    });
  }
  return out;
}

/** Repara filas de tabla §4 rotas tras división approve-first / approve-second. */
function normalizeDualApprovalSection4TableRows(body: string): string {
  let out = body.replace(
    /^\|\s*POST\s*\|\s*`?([^|`\n]+approve-first)`?\s*\|\s*$/gim,
    "| POST | `$1` | Primera aprobación (dual) | JWT (admin_security) |",
  );
  out = out.replace(
    /^\|\s*POST\s*\|\s*`?([^|`\n]+approve-second)`?\s*\|[^|\n]*(?:\|[^|\n]*)+/gim,
    "| POST | `$1` | Segunda aprobación (409 si mismo aprobador) | JWT (admin_security) |",
  );
  return out;
}

/** Sustituye un único endpoint de aprobación por approve-first / approve-second en §4. */
function fixDualApprovalSection4Endpoints(draft: string): string {
  if (!draftRequiresDualApproval(draft)) return draft;
  if (draftHasRequestIdDualApprovalApi(draft)) return draft;
  const section = extractMddSectionBody(draft, "## 4. Contratos de API");
  if (!section) return draft;

  let body = section.body;
  const hasSplitEndpoints = /approve-first/i.test(body) && /approve-second/i.test(body);
  const exportApprovePathRe =
    /\/export(?:-requests\/:requestId)?\/approve(?!-first|-second)/i;
  const hasSingleApprove =
    (/\|\s*POST\s*\|/i.test(body) && exportApprovePathRe.test(body)) ||
    /#{2,6}\s*POST\s+\/[^\s\n]*\/export(?:-requests\/:requestId)?\/approve(?!-first|-second)/i.test(
      body,
    );

  if (hasSplitEndpoints && !hasSingleApprove) {
    body = normalizeDualApprovalSection4TableRows(body);
    body = splitDualApprovalEndpointDetailHeadings(body);
    if (body !== section.body) {
      return draft.slice(0, section.start) + body + draft.slice(section.end);
    }
    return draft;
  }

  body = body.replace(
    /^\|\s*POST\s*\|\s*[`']?(\/[^\s`'\n|]*\/export(?:-requests\/:requestId)?\/)approve[`']?\s*\|[^\n]*$/gim,
    (_line, prefix: string) =>
      `| POST | \`${prefix}approve-first\` | Primera aprobación (dual) | JWT (admin_security) |\n| POST | \`${prefix}approve-second\` | Segunda aprobación (409 si mismo aprobador) | JWT (admin_security) |`,
  );
  body = normalizeDualApprovalSection4TableRows(body);
  body = splitDualApprovalEndpointDetailHeadings(body);

  if (body === section.body) return draft;
  return draft.slice(0, section.start) + body + draft.slice(section.end);
}

/** Divide el bloque detalle `#### POST …/export/approve` en approve-first y approve-second. */
function splitDualApprovalEndpointDetailHeadings(body: string): string {
  const headingRe =
    /####\s*POST\s+(\/[^\s\n]*\/export(?:-requests\/:requestId)?\/)approve(?!-first|-second)[^\n]*\n+([\s\S]*?)(?=\n####\s*POST\s+\/|\n##\s+|\n---\s*\n|$)/i;
  if (!headingRe.test(body)) return body;
  return body.replace(headingRe, (_m, prefix: string, detail: string) => {
    const trimmed = detail.trim();
    return (
      `#### POST ${prefix}approve-first\n\nPrimera aprobación. Cambia estado a \`first_approved\`.\n\n${trimmed}\n\n` +
      `#### POST ${prefix}approve-second\n\nSegunda aprobación (distinto del primero). Cambia a \`approved\` y ejecuta exportación.\n\n${trimmed}\n\n`
    );
  });
}

/** Corrige esquema de aprobación dual (2 aprobadores) en SQL, diagramas ER y §4. */
export function fixDualApprovalSchemaInDraft(draft: string): string {
  if (!draft || !draftRequiresDualApproval(draft)) return draft;
  const hasApprovalTable = DUAL_APPROVAL_TABLES.some((t) =>
    new RegExp(`CREATE\\s+TABLE\\s+${t}\\b`, "i").test(draft),
  );

  let out = draft;
  if (hasApprovalTable) {
    out = out.replace(/```sql\s*([\s\S]*?)```/gi, (_full, inner: string) => {
      const fixed = fixDualApprovalTableSqlBlock(inner);
      return fixed === inner ? _full : "```sql\n" + fixed + "\n```";
    });
    out = out.replace(/```mermaid\s*([\s\S]*?)```/gi, (_full, inner: string) => {
      if (!/erDiagram/i.test(inner)) return _full;
      const fixed = fixDualApprovalMermaidBlock(inner);
      return fixed === inner ? _full : "```mermaid\n" + fixed + "\n```";
    });
  }
  out = fixDualApprovalSection4Endpoints(out);
  return out;
}

/** Sanitiza todos los bloques ```sql del borrador (no solo el primero). */
export function sanitizeAllSqlBlocksInDraft(draft: string): string {
  if (!draft) return draft;
  return draft.replace(/```sql\s*([\s\S]*?)```/gi, (_full, inner: string) => {
    let sanitized = sanitizeSqlBrokenCommentsAndProse(inner);
    sanitized = dedentCreateIndexLines(sanitized);
    if (sanitized !== inner) {
      return "```sql\n" + sanitized + "\n```";
    }
    return _full;
  });
}

export type CrossConsistencyPatch = { find: string; replace: string };

/**
 * Aplica parches find/replace del revisor LLM con límites de seguridad.
 * Solo aplica si `find` aparece exactamente una vez.
 */
export function applyCrossConsistencyPatches(
  draft: string,
  patches: CrossConsistencyPatch[],
): string {
  if (!draft || !patches?.length) return draft;
  let out = draft;
  const maxPatches = 12;
  for (const patch of patches.slice(0, maxPatches)) {
    const find = patch?.find?.trim();
    const replace = patch?.replace ?? "";
    if (!find || find.length < 8 || find.length > 4_000) continue;
    if (replace.length > 8_000) continue;
    const count = out.split(find).length - 1;
    if (count === 1) {
      out = out.replace(find, replace);
    }
  }
  return out;
}

/** Extrae array JSON de parches desde la respuesta del LLM. */
export function parseCrossConsistencyPatches(text: string): CrossConsistencyPatch[] {
  if (!text?.trim()) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const arrayStart = raw.indexOf("[");
  const arrayEnd = raw.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd <= arrayStart) return [];
  try {
    const parsed = JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is CrossConsistencyPatch =>
          p != null &&
          typeof p === "object" &&
          typeof (p as CrossConsistencyPatch).find === "string" &&
          typeof (p as CrossConsistencyPatch).replace === "string",
      )
      .map((p) => ({ find: p.find, replace: p.replace }));
  } catch {
    return [];
  }
}

/**
 * Detecta incoherencias que pueden requerir parche LLM tras el paso determinista.
 */

const SEC6_EXPECTED_TABLES = ["security_events", "refresh_tokens", "mfa_backup_codes"] as const;

/** OWASP ASVS V3.1.1 — bloqueo por intentos fallidos cuando §5 lo exige y §6 no lo detalla. */
export const SECURITY_LOCKOUT_DEFAULT_PARAGRAPH =
  "Bloqueo de cuenta tras 5 intentos fallidos de login en ventana de 15 minutos; lockout 5 minutos (OWASP ASVS V3.1.1).";

const LOCKOUT_DETAIL_RE =
  /\d+\s*intentos?|\d+\s*attempts?|intentos?\s*:\s*\d+|máximo\s+\d+|fallos?\s*:\s*\d+|lockout|bloqueo\s+tras\s+\d+/i;

const LOGIC_LOCKOUT_TRIGGER_RE =
  /\b(bloqueo\s+de\s+cuenta|lock\s+account|intentos\s+fallidos|failed\s+attempts|máximo\s+de\s+intentos|fallos?\b|lockout\b)/i;

/** Inyecta párrafo OWASP de lockout en §6 si §5 lo requiere y falta número de intentos. */
export function ensureSecurityLockoutInSection6(draft: string): string {
  if (!draft?.trim()) return draft;
  const logicSec = extractMddSectionBody(draft, "## 5. Lógica y Edge Cases");
  if (!logicSec || !LOGIC_LOCKOUT_TRIGGER_RE.test(logicSec.body)) return draft;

  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!sec6) return draft;
  if (LOCKOUT_DETAIL_RE.test(sec6.body)) return draft;

  const injection = `\n\n${SECURITY_LOCKOUT_DEFAULT_PARAGRAPH}\n`;
  const updatedBody = sec6.body.trimEnd() + injection;
  return draft.slice(0, sec6.start) + updatedBody + draft.slice(sec6.end);
}

function detectSecurityTablesMissingInSection3(draft: string): string[] {
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!sec6) return [];
  const section3 = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  const sql = section3?.body ?? "";
  const missing: string[] = [];
  for (const table of SEC6_EXPECTED_TABLES) {
    if (!new RegExp(`\\b${table}\\b`, "i").test(sec6.body)) continue;
    if (!new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\b`, "i").test(sql)) {
      missing.push(table);
    }
  }
  return missing;
}

const SECURITY_TABLE_STUB_DDL: Record<(typeof SEC6_EXPECTED_TABLES)[number], string> = {
  security_events: `
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type VARCHAR(100) NOT NULL,
  ip_address INET,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  refresh_tokens: `
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  mfa_backup_codes: `
CREATE TABLE mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
};

function section6RequiresTotpSecretColumn(draft: string): boolean {
  const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (!sec6) return false;
  const body = sec6.body;
  if (/\b(sin\s+mfa|no\s+mfa|no\s+se\s+(?:implementa|requiere|usa)\s+mfa|mfa\s+no\s+(?:obligatorio|requerido|aplica))\b/i.test(body)) {
    return false;
  }
  const mandatesMfa =
    /\b(mfa\s+obligatorio|totp\s+obligatorio|2fa\s+obligatorio|requiere\s+mfa|implementa\s+(?:mfa|totp|2fa)|autenticaci[oó]n\s+multifactor)\b/i.test(
      body,
    );
  if (!mandatesMfa) return false;
  if (!/\btotp_secret\b/i.test(body) && !/\bmfa_secrets?\b/i.test(body)) return false;
  const section3 = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section3) return false;
  const sqlMatch = section3.body.match(/```sql\s*([\s\S]*?)```/i);
  if (!sqlMatch?.[1]) return false;
  return !/\btotp_secret\b/i.test(sqlMatch[1]) && !/\bmfa_secrets\b/i.test(sqlMatch[1]);
}

function findCreateTableBlock(
  sql: string,
  tableNames: string[],
): { start: number; end: number; tableName: string; cols: string } | null {
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${tableNames.join("|")})\\s*\\(`,
    "i",
  );
  const m = re.exec(sql);
  if (!m || m.index == null) return null;
  const openParen = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openParen; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return {
          start: m.index,
          end: i + 1,
          tableName: m[1]!,
          cols: sql.slice(openParen + 1, i),
        };
      }
    }
  }
  return null;
}

function injectTotpSecretColumnIntoUserTable(sql: string): string {
  const block = findCreateTableBlock(sql, ["users", "usuarios", "user"]);
  if (!block || /\btotp_secret\b/i.test(block.cols)) return sql;
  const trimmedCols = block.cols.trimEnd().replace(/,\s*$/, "");
  const newCols = `${trimmedCols},\n  totp_secret BYTEA`;
  const newBlock = `CREATE TABLE ${block.tableName} (\n${newCols}\n)`;
  return sql.slice(0, block.start) + newBlock + sql.slice(block.end);
}

/**
 * Añade stubs DDL mínimos en §3 solo para tablas/columnas mencionadas en §6 y ausentes en SQL.
 */
export function ensureSecurityTableStubsFromSection6(draft: string): string {
  if (!draft?.trim()) return draft;
  const missing = detectSecurityTablesMissingInSection3(draft);
  const needsTotp = section6RequiresTotpSecretColumn(draft);
  if (missing.length === 0 && !needsTotp) return draft;

  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section) return draft;

  let body = section.body;
  const sqlRe = /```sql\s*([\s\S]*?)```/i;
  if (!sqlRe.test(body)) return draft;

  body = body.replace(sqlRe, (full, inner: string) => {
    let sql = inner.trimEnd();
    for (const table of missing) {
      const stub = SECURITY_TABLE_STUB_DDL[table as (typeof SEC6_EXPECTED_TABLES)[number]];
      if (stub) sql += `\n${stub}`;
    }
    if (needsTotp) sql = injectTotpSecretColumnIntoUserTable(sql);
    return sql === inner.trimEnd() ? full : "```sql\n" + sql + "\n```";
  });

  if (body === section.body) return draft;
  return draft.slice(0, section.start) + body + draft.slice(section.end);
}

/** Heurística: UNIQUE compuesto de estado sin índice parcial. */
export function detectSuspiciousUniqueConstraints(draft: string): string[] {
  const issues: string[] = [];
  const section = extractMddSectionBody(draft, "## 3. Modelo de Datos");
  if (!section) return issues;
  const uniqueRe = /UNIQUE\s*\(\s*([^)]+)\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = uniqueRe.exec(section.body)) !== null) {
    const cols = m[1].replace(/\s/g, "").toLowerCase();
    if (
      /negocio_id.*cliente_id.*estado|cliente_id.*negocio_id.*estado/.test(cols) &&
      !/WHERE/i.test(section.body.slice(m.index, m.index + 240))
    ) {
      issues.push(
        "§3: UNIQUE(negocio_id, cliente_id, estado) sin WHERE — considerar índice parcial único por estado activo.",
      );
      break;
    }
  }
  return issues;
}

function extractUatBulletLines(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").toLowerCase());
}

/** True si §1 y §5 repiten criterios UAT (warning de entrega, no bloqueante). */
export function detectDuplicateUatSections(draft: string): boolean {
  const sec1 = extractMddSectionBody(draft, "## 1. Contexto");
  const sec5 = extractMddSectionBody(draft, "## 5. Lógica y Edge Cases");
  if (!sec1 || !sec5) return false;
  return uatSectionsAreSimilar(sec1.body, sec5.body);
}

function uatSectionsAreSimilar(sec1Body: string, sec5Body: string): boolean {
  if (!/\bUAT\b|criterios\s+de\s+aceptaci[oó]n/i.test(sec1Body)) return false;
  if (!/\bUAT\b|criterios\s+de\s+aceptaci[oó]n/i.test(sec5Body)) return false;
  const lines1 = extractUatBulletLines(sec1Body);
  const lines5 = extractUatBulletLines(sec5Body);
  if (lines1.length < 2 || lines5.length < 2) return false;
  const shared = lines1.filter((l) => lines5.includes(l));
  return shared.length >= Math.min(3, Math.min(lines1.length, lines5.length));
}

/** Si §1 y §5 repiten criterios UAT, §5 referencia §1 en lugar de duplicar. */
export function deduplicateUatSections(draft: string): string {
  const sec1 = extractMddSectionBody(draft, "## 1. Contexto");
  const sec5 = extractMddSectionBody(draft, "## 5. Lógica y Edge Cases");
  if (!sec1 || !sec5 || !uatSectionsAreSimilar(sec1.body, sec5.body)) return draft;

  const uatHeadingRe =
    /(\n###[^\n]*(?:UAT|criterios\s+de\s+aceptaci[oó]n)[^\n]*\n)([\s\S]*?)(?=\n###|\n##|$)/i;
  const match = sec5.body.match(uatHeadingRe);
  if (!match || /Ver\s+§1/i.test(match[2] ?? "")) return draft;

  const replacement = `${match[1]}\n- Ver §1 (Criterios UAT / aceptación).\n`;
  const newBody = sec5.body.replace(uatHeadingRe, replacement);
  if (newBody === sec5.body) return draft;
  return draft.slice(0, sec5.start) + newBody + draft.slice(sec5.end);
}

/** True si algún bloque ```sql abrió fence sin cierre ``` antes del siguiente bloque o EOF. */
export function detectUnclosedSqlFences(draft: string): string | null {
  if (!draft) return null;
  const re = /```sql\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(draft)) !== null) {
    const contentStart = match.index + match[0].length;
    const rest = draft.slice(contentStart);
    const lines = rest.split(/\r?\n/);
    let offset = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "```") {
        break;
      }
      if (/^```\w+/.test(trimmed)) {
        return "Bloque ```sql sin cerrar: otro fence (```mermaid, ```TechnicalMetadata, etc.) antes del cierre.";
      }
      offset += line.length + 1;
    }
    if (offset >= rest.length || !/\n```[ \t]*(?:\r?\n|$)/.test(rest.slice(offset))) {
      return "Bloque ```sql sin cerrar con ``` antes del final del documento.";
    }
  }
  return null;
}

export function detectCrossConsistencyIssues(draft: string): string[] {
  if (!draft) return [];
  const issues: string[] = [];

  if (draftRequiresDualApproval(draft)) {
    const contratosDual = extractMddSectionBody(draft, "## 4. Contratos de API");
    if (contratosDual && !draftHasRequestIdDualApprovalApi(draft)) {
      const hasSingleApprove =
        /\/export(?:-requests)?\/[^|\s\n]*\/approve(?!-first|-second)/i.test(
          contratosDual.body,
        );
      const hasSplit =
        /approve-first/i.test(contratosDual.body) && /approve-second/i.test(contratosDual.body);
      if (hasSingleApprove && !hasSplit) {
        issues.push(
          "§4: aprobación dual requiere endpoints approve-first y approve-second (no un único /approve).",
        );
      }
    }
    const spanishExport = draft.match(
      /CREATE\s+TABLE\s+solicitudes_exportacion\s*\([\s\S]*?\)\s*;/i,
    );
    if (spanishExport && !/segundo_aprobador_id/i.test(spanishExport[0])) {
      issues.push(
        "Tabla solicitudes_exportacion: falta segundo_aprobador_id pese a aprobación dual.",
      );
    }
    for (const table of DUAL_APPROVAL_TABLES) {
      const tableRe = new RegExp(`CREATE\\s+TABLE\\s+${table}\\s*\\([\\s\\S]*?\\)\\s*;`, "i");
      const match = draft.match(tableRe);
      if (!match) continue;
      const block = match[0];
      if (!/second_approver_id/i.test(block)) {
        issues.push(
          `Tabla ${table}: falta second_approver_id pese a aprobación dual en el alcance.`,
        );
      }
      if (/\bapproved_by\b/i.test(block) && !/first_approver_id/i.test(block)) {
        issues.push(`Tabla ${table}: usa approved_by en lugar de first_approver_id/second_approver_id.`);
      }
    }
  }

  const arch = extractMddSectionBody(draft, "## 2. Arquitectura y Stack");
  const isModularMonolith =
    arch != null &&
    /monolito\s+modular|única unidad de despliegue|single deployment|único despliegue/i.test(
      arch.body,
    );
  if (isModularMonolith) {
    const infra = extractMddSectionBody(draft, "## 7. Infraestructura");
    if (infra && /entre\s+microservicios?/i.test(infra.body)) {
      issues.push("§7 menciona microservicios pero §2 define monolito modular.");
    }
  }

  const contratos = extractMddSectionBody(draft, "## 4. Contratos de API");
  if (contratos) {
    const v1Routes = (contratos.body.match(/\/api\/v1\/[a-zA-Z0-9_/-]+/g) ?? []).length;
    const plainRoutes = (contratos.body.match(/\/api\/(?!v1\/)[a-zA-Z0-9_/-]+/g) ?? []).length;
    const dominantPrefix = v1Routes > plainRoutes ? "/api/v1" : plainRoutes > 0 ? "/api" : null;
    if (dominantPrefix) {
      const manifestMatch = draft.match(/"api_prefix"\s*:\s*"([^"]+)"/);
      if (manifestMatch && manifestMatch[1] !== dominantPrefix) {
        issues.push(
          `Manifest api_prefix "${manifestMatch[1]}" no coincide con rutas dominantes (${dominantPrefix}).`,
        );
      }
    }
  }

  if (draftUsesLdapPrimaryAuth(draft)) {
    const sec6 = extractMddSectionBody(draft, "## 6. Seguridad");
    if (
      sec6 &&
      /contraseñas de los usuarios se almacenan hasheadas|hashing de contraseñas usa Argon2id/i.test(
        sec6.body,
      ) &&
      !/bootstrap|solo la cuenta/i.test(sec6.body)
    ) {
      issues.push(
        "§6: LDAP/AD es auth principal pero el texto aún documenta hash local de contraseñas de usuarios.",
      );
    }
    const manifestHash = draft.match(/"hashing_algorithm"\s*:\s*"([^"]+)"/i)?.[1];
    if (manifestHash?.toLowerCase() === "bcrypt") {
      issues.push('Manifest §7: hashing_algorithm "bcrypt" incoherente con LDAP/AD (usar Argon2id solo bootstrap).');
    }
  }

  if (draftReferencesOutboxTable(draft) && !draftHasOutboxTable(draft)) {
    issues.push("Se menciona tabla outbox (Outbox Pattern) pero falta CREATE TABLE outbox en §3.");
  }

  if (detectDuplicateOutboxTables(draft)) {
    const tables = listOutboxLikeTablesInDraft(draft);
    issues.push(
      `§3: tablas outbox-like duplicadas (${tables.join(", ")}); conservar una sola tabla canónica.`,
    );
  }

  if (detectJwtAlgorithmMismatch(draft)) {
    const s6 = extractJwtAlgorithmFromSection6(draft);
    const s7 = extractJwtAlgorithmFromSection7(draft);
    issues.push(
      `§6/§7: algoritmo JWT incoherente (§6=${s6}, §7=${s7}); §6 es SSOT.`,
    );
  }

  const nodeMismatchIssue = detectSection2Section7NodeVersionMismatchIssue(draft);
  if (nodeMismatchIssue) issues.push(nodeMismatchIssue);

  for (const table of detectSecurityTablesMissingInSection3(draft)) {
    issues.push(
      `§6 menciona tabla \`${table}\` pero falta CREATE TABLE correspondiente en §3.`,
    );
  }

  issues.push(...detectSuspiciousUniqueConstraints(draft));

  const sec6Argon2 = extractMddSectionBody(draft, "## 6. Seguridad");
  if (sec6Argon2 && /Argon2(?:id)?/i.test(sec6Argon2.body)) {
    const manifestHashArgon = draft.match(/"hashing_algorithm"\s*:\s*"([^"]+)"/i)?.[1];
    if (manifestHashArgon?.toLowerCase() === "bcrypt") {
      issues.push(
        'Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id documentado en §6.',
      );
    }
  }

  const sqlBlocks = [...draft.matchAll(/```sql\s*([\s\S]*?)```/gi)];
  for (const [, inner] of sqlBlocks) {
    if (!inner) continue;
    for (const line of inner.split("\n")) {
      if (isSqlProseArtifactLine(line)) {
        issues.push("Bloque SQL contiene prosa inválida (línea sin DDL válido).");
        break;
      }
    }
  }

  return issues;
}

/**
 * Paso determinista de consistencia cruzada (sin LLM): SQL, dual approval, coherencia §2/§4/§5/§7.
 */
export function applyDeterministicCrossConsistencyFixes(draft: string): string {
  if (!draft) return draft;
  let out = sanitizeAllSqlBlocksInDraft(draft);
  out = ensureOutboxTableInDraft(out);
  out = deduplicateOutboxTablesInDraft(out);
  out = fixSection7OutboxNarrative(out);
  out = fixDualApprovalSchemaInDraft(out);
  out = fixDeterministicMddCoherence(out);
  out = fixJwtAlgorithmCoherence(out);
  // Segunda pasada: rutas ya en /api/v1 y headings detalle pendientes
  if (draftRequiresDualApproval(out)) {
    out = fixDualApprovalSchemaInDraft(out);
  }
  return out;
}

/**
 * Formatea el contenido de un bloque ```sql al formato canónico:
 * - Una columna por renglón.
 * - 2 espacios antes del nombre de cada columna.
 * - Sin líneas en blanco entre columna y columna.
 * - Cierre ); en línea propia.
 */
export function formatSqlBlockWithNewlines(sqlContent: string): string {
  if (!sqlContent || typeof sqlContent !== "string") return sqlContent;
  let out = sqlContent.trim();
  // Separar tablas: ); CREATE TABLE → ); \n\n CREATE TABLE
  out = out.replace(/\)\s*;\s*CREATE\s+TABLE/gi, ");\n\nCREATE TABLE");
  out = out.replace(/\)\s*;\s*\n\s*(?=CREATE\s+TABLE)/gi, "\n);\n\n");
  out = out.replace(/\s*\)\s*;\s*$/, "\n);\n");

  // Apertura: CREATE TABLE name ( → CREATE TABLE name (\n  (para que la primera columna quede en su línea)
  out = out.replace(
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*)\(\s*/gi,
    "$1(\n  "
  );

  // Partir columnas que están en la misma línea: coma seguida de nombre de columna (identifier) → nueva línea + 2 espacios
  // Así no partimos tipos como decimal(10, 2) ni REFERENCES table(id).
  out = out.replace(/,\s*(?=[a-zA-Z_][a-zA-Z0-9_]*\s)/g, ",\n  ");

  // Quitar líneas en blanco entre columnas: ",\n\n" o ",\n  \n" → ",\n  "
  out = out.replace(/,\s*\n\s*\n+\s*/g, ",\n  ");

  // Asegurar 2 espacios antes de la primera columna tras (
  out = out.replace(/(\(\n)\s*([a-zA-Z_][a-zA-Z0-9_]*\s+)/g, "$1  $2");

  // Por línea: quitar líneas en blanco y normalizar columnas a "  " + contenido
  const lines = out.split("\n");
  const normalized: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === "") continue;
    if (t === ");" || /^CREATE\s+TABLE\s+/i.test(t)) {
      normalized.push(t);
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*\s+/.test(t)) {
      normalized.push("  " + t);
    } else {
      normalized.push(line);
    }
  }
  out = normalized.join("\n");

  // Cierre: ); en línea propia
  out = out.replace(/\s*\)\s*;/g, "\n);");
  return out;
}

/**
 * Corrige en la sección 2: (1) SQL no cerrado con ``` antes de ### Diagrama o ```mermaid;
 * (2) encabezado pegado "### Diagrama entidad-relaciónmermaid" → cierre sql + título + apertura ```mermaid.
 */
function fixSection2UnclosedSqlAndGluedMermaid(draft: string): string {
  const modeloHeading = "## 3. Modelo de Datos";
  const modeloIdx = draft.indexOf(modeloHeading);
  if (modeloIdx === -1) return draft;
  const sectionStart = modeloIdx + modeloHeading.length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  let newBody = body
    .replace(/\);\s*###\s*Diagrama entidad-relaciónmermaid/gi, ");\n```\n\n### Diagrama entidad-relación\n\n```mermaid")
    .replace(/\);\s*###\s*Diagrama\b/gi, ");\n```\n\n### Diagrama")
    .replace(/\);\s*```mermaid/gi, ");\n```\n\n```mermaid")
    .replace(/###\s*Diagrama entidad-relaciónmermaid/gi, "### Diagrama entidad-relación\n\n```mermaid");
  if (newBody === body) return draft;
  const afterSection = nextH2 !== -1 ? rest.slice(nextH2) : "";
  return draft.slice(0, sectionStart) + newBody + afterSection;
}

/**
 * Asegura que el bloque ```sql de la sección 2 esté cerrado con ``` antes de ```mermaid, ```TechnicalMetadata o ###.
 * Así formatSqlBlockWithNewlines puede encontrar el bloque y formatear columnas por línea.
 */
function ensureSection2SqlBlockClosed(draft: string): string {
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
function ensureSection2SqlFormattedInSection(draft: string): string {
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
function fixSection6BulletedJsonToMarkdown(sectionBody: string): string | null {
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
function fixSecuritySectionBullets(sectionBody: string): string {
  if (!sectionBody || typeof sectionBody !== "string") return sectionBody;
  return sectionBody
    .replace(/^-\s*##\s*6\.\s*Seguridad\s*$/gim, "")
    .replace(/^-\s*(6\.\d+\s+[^\n]*)$/gm, "### $1")
    .replace(/^-\s*\.\s+([^:\n]+):?\s*$/gm, "### $1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Línea H2 de §6 (con o sin número; admite título pegado sin espacio tras Seguridad). */
const RE_SECTION6_H2_LINE = /^##\s+(?:6\.\s+)?Seguridad/i;

/** Colapsa `--- --- ---` en la misma línea o consecutivos; normaliza `--`/`-` sueltos como separadores. */
function collapseInlineHorizontalRules(draft: string): string {
  let out = draft.replace(/(?:^|\n)\s*---(?:\s+---\s*)+(?=\s*(?:\n|$))/g, "\n---\n");
  out = out.replace(/\n\s*--\s*\n(?=\s*##\s+)/g, "\n---\n");
  out = out.replace(/\n\s*-\s*\n(?=\s*##\s+)/g, "\n");
  out = out.replace(/\n\s*--\s*$/gm, "");
  return collapseConsecutiveHorizontalRules(out);
}

/**
 * Cierra fences ``` sin cierre antes de `---` + ## o de otro H2 (manifest §7, SQL §3).
 */
export function closeUnclosedCodeFencesInDraft(draft: string): string {
  if (!draft?.trim()) return draft ?? "";
  const closeBeforeH2 = "(?=\\n---[\\s\\S]*?\\n##\\s|\\n##\\s+(?:UI\\/UX|\\d+\\.))";
  const langs = "json|sql|mermaid|TechnicalMetadata|dockerfile";
  return draft.replace(
    new RegExp(`(\\\`\\\`\\\`(?:${langs})\\s*\\n)([\\s\\S]*?)${closeBeforeH2}`, "gi"),
    (match, open: string, body: string) => {
      if (/\n```[ \t]*(?:\r?\n|$)/.test(body)) return match;
      return `${open}${body.trimEnd()}\n\`\`\`\n`;
    },
  );
}

/** Elimina fences ``` vacíos o de apertura suelta antes de H2/---. */
function stripEmptyBareCodeFences(draft: string): string {
  let result = draft
    .replace(/\n```[ \t]*\n\s*```[ \t]*\n/g, "\n");
  result = result.replace(/\n```[ \t]*\n(?=\s*---\s*\n|\s*##\s+|\s*###\s+(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+)/g, (match, offset) => {
    const before = result.slice(0, offset);
    const fenceCount = (before.match(/```/g) ?? []).length;
    if (fenceCount % 2 === 1) return match;
    return "\n";
  });
  return result;
}

/** Desenvuelve fences ``` sin lenguaje que encierran prosa tras un encabezado. */
function stripOrphanFenceWrappingProse(draft: string): string {
  return draft.replace(
    /(^#{2,4}\s+[^\n]+\n\n)```\s*\n([\s\S]*?)\n```(?=\n\n#{2,4}|\n\n---|\n*$)/gm,
    (_m, heading: string, prose: string) => {
      const trimmed = prose.trim();
      if (!trimmed) return _m;
      if (/^\s*(?:CREATE|import|FROM|SELECT|const |function |def |\{)/im.test(trimmed)) return _m;
      if (/^\{[\s\S]*"[\s\S]*\}/.test(trimmed)) return _m;
      return `${heading}${trimmed}\n`;
    },
  );
}

/** Quita `)` suelto en línea propia antes de §7 o cualquier H2. */
function stripStrayParenBeforeH2(draft: string): string {
  return draft
    .replace(/\n\s*\)\s*\n+(---\s*\n)(\s*##\s+7\.)/g, "\n$1$2")
    .replace(/\n\s*\)\s*\n+(?=\s*##\s+)/g, "\n");
}

/** Normaliza indentación de CREATE INDEX tras formateo SQL. */
function dedentCreateIndexLines(sql: string): string {
  return sql.replace(/^\s+(CREATE\s+INDEX\b)/gim, "$1");
}

/** Despega subtítulo del H2 (ej. `## 6. SeguridadGestión…:` o `## 6. Seguridad. Autenticación:` → H2 + ###). */
function fixGluedSection6Heading(draft: string): string {
  let out = repairGluedMarkdownHeadings(draft);
  out = out.replace(
    /^##\s*3\.\s*Modelo\s+de\s+Datos(?=[A-ZÁÉÍÓÚÑ])/gim,
    "## 3. Modelo de Datos\n\n",
  );
  out = out.replace(
    /^##\s*6\.\s*Seguridad([A-ZÁÉÍÓÚÑ][^\n]*?):?\s*$/gim,
    (_m: string, tail: string) => {
      const t = tail.trim().replace(/:$/, "");
      return t ? `## 6. Seguridad\n\n### ${t}` : _m;
    },
  );
  out = out.replace(
    /^##\s*6\.\s*Seguridad\.\s*([^:\n]+):?\s*$/gim,
    "## 6. Seguridad\n\n### $1",
  );
  return out.replace(/\n{3,}/g, "\n\n");
}

/** Cuenta ocurrencias de un heading H2 de sección canónica (§1–§7). */
function countMddSectionH2Occurrences(draft: string, section: 1 | 2 | 3 | 4 | 5 | 6 | 7): number {
  const patterns: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, RegExp> = {
    1: /^##\s+1\.\s*Contexto/im,
    2: /^##\s+2\.\s*Arquitectura\s+y\s*Stack/im,
    3: /^##\s+3\.\s*Modelo\s+(?:de\s+)?datos/im,
    4: /^##\s+4\.\s*Contratos\s+de\s+API/im,
    5: /^##\s+5\.\s*Lógica\s+y\s*Edge\s+Cases/im,
    6: /^##\s+(?:6\.\s+)?Seguridad/im,
    7: /^##\s+(?:7\.\s+)?(?:Infraestructura|Integraci[oó]n)/im,
  };
  return (draft.match(new RegExp(patterns[section].source, "gm")) ?? []).length;
}

/** True si el borrador repite algún heading canónico §1–§7 (corrupción por acumulación del pipeline). */
export function mddHasDuplicateSectionHeadings(draft: string): boolean {
  const trimmed = (draft ?? "").trim();
  if (!trimmed) return false;
  for (const section of [1, 2, 3, 4, 5, 6, 7] as const) {
    if (countMddSectionH2Occurrences(trimmed, section) > 1) return true;
  }
  return false;
}

/**
 * Trunca cola duplicada tras la primera §7 completa (p. ej. §5/§6/§7 repetidas en bucle).
 * Red de seguridad cuando deduplicate no pudo reconstruir por el guard del 50%.
 */
export function stripTrailingDuplicateMddSections(draft: string): string {
  const trimmed = (draft ?? "").trim();
  if (!trimmed || !mddHasDuplicateSectionHeadings(trimmed)) return draft;
  const range7 = getSection6Or7Range(trimmed, 7);
  if (!range7) return draft;
  const tail = trimmed.slice(range7.end).trim();
  if (!tail) return draft;
  const tailHasRepeatedCore =
    /^##\s+5\.\s*Lógica/im.test(tail) ||
    (tail.match(/^##\s+(?:6\.\s+)?Seguridad/im) ?? []).length >= 1 ||
    (tail.match(/^##\s+(?:7\.\s+)?(?:Infraestructura|Integraci[oó]n)/im) ?? []).length >= 1;
  if (!tailHasRepeatedCore) return draft;
  return trimmed.slice(0, range7.end).trim();
}

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

const CONTEXTO_HEADING = "## 1. Contexto y alcance";
const CONTEXTO_HEADINGS_EXTRACT = ["## 1. Contexto y alcance", "## 1. Contexto", "## Contexto y alcance"];

/** Extrae el cuerpo de la sección "## 1. Contexto" (hasta el siguiente ## o fin). */
export function extractContextSectionBody(draft: string): string | null {
  for (const heading of CONTEXTO_HEADINGS_EXTRACT) {
    const idx = draft.indexOf(heading);
    if (idx === -1) continue;
    const start = idx + heading.length;
    const after = draft.slice(start).replace(/^\s*\n+/, "");
    const nextHeading = after.search(/\n##\s+/);
    const body = nextHeading !== -1 ? after.slice(0, nextHeading).trim() : after.trim();
    return body || null;
  }
  return null;
}

/** Fusiona solo la sección 1 (Contexto y alcance) de newDraft en previousDraft; el resto del documento se mantiene de previousDraft. */
export function mergeSection1IntoDraft(previousDraft: string, newDraft: string): string {
  const section1Body = extractContextSectionBody(newDraft);
  if (!section1Body?.trim()) return previousDraft;
  return replaceContextSectionBody(previousDraft, section1Body);
}

/** Reemplaza el cuerpo de "## 1. Contexto y alcance" en draft por newBody. */
export function replaceContextSectionBody(draft: string, newBody: string): string {
  const idx = draft.indexOf(CONTEXTO_HEADING);
  if (idx === -1) return draft;
  const sectionStart = idx + CONTEXTO_HEADING.length;
  const rest = draft.slice(sectionStart);
  const nextHeadingInRest = rest.search(/\n##\s+/);
  const endOfSection = nextHeadingInRest !== -1 ? sectionStart + nextHeadingInRest : draft.length;
  const afterSection = endOfSection < draft.length ? draft.slice(endOfSection).trimStart() : "";
  return draft.slice(0, sectionStart) + "\n\n" + newBody.trim() + (afterSection ? "\n\n" + afterSection : "");
}

/** Reemplaza el cuerpo de la sección 1 (cualquier variante de título) por newBody. Para regenerar §1 sin depender del título exacto. */
export function replaceSection1BodyFromAnyHeading(draft: string, newBody: string): string {
  for (const heading of CONTEXTO_HEADINGS_EXTRACT) {
    const idx = draft.indexOf(heading);
    if (idx === -1) continue;
    const sectionStart = idx + heading.length;
    const rest = draft.slice(sectionStart);
    const nextHeadingInRest = rest.search(/\n##\s+/);
    const endOfSection = nextHeadingInRest !== -1 ? sectionStart + nextHeadingInRest : draft.length;
    const afterSection = endOfSection < draft.length ? draft.slice(endOfSection).trimStart() : "";
    return draft.slice(0, sectionStart) + "\n\n" + newBody.trim() + (afterSection ? "\n\n" + afterSection : "");
  }
  return draft;
}

const METADATA_KEYS = /^(section\d|toolPreference|diagramFormat|apiFormat|tool\s*:)$/i;

/** Detecta si el cuerpo de Contexto es solo metadatos (section3, toolPreference, etc.) sin prosa sustancial. */
function isContextOnlyMetadata(body: string): boolean {
  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const bulletKey = /^-\s*\*\*([^*]+)\*\*[::\s]/;
  let allMetadata = true;
  for (const line of lines) {
    const m = line.match(bulletKey);
    if (m && METADATA_KEYS.test(m[1].trim())) continue;
    if (line.length > 80 || !line.startsWith("-")) {
      allMetadata = false;
      break;
    }
  }
  return allMetadata && lines.length > 0;
}

/** Frases que indican que el "contexto" son instrucciones de conversación, no descripción del sistema. */
const CONTEXTO_INSTRUCTION_PATTERNS = [
  /regenerar\s+el\s+(mdd|master\s+design\s+document)/i,
  /incluir\s+metadatos\s*:\s*s[ií]/i,
  /objetivo\s*:\s*regenerar/i,
  /objetivo\s*:\s*generar\s+el\s+mdd/i,
  /instrucciones?\s*(del\s+usuario|de\s+conversaci[oó]n)/i,
];

/** Si "1. Contexto y alcance" contiene instrucciones de chat (regenerar MDD, incluir metadatos, etc.), reemplaza por placeholder para que se regenere. */
export function replaceContextWhenInstructions(draft: string): string {
  const body = extractContextSectionBody(draft);
  if (!body || body.length < 30) return draft;
  const combined = body.replace(/\s+/g, " ");
  const looksLikeInstructions = CONTEXTO_INSTRUCTION_PATTERNS.some((re) => re.test(combined));
  if (!looksLikeInstructions) return draft;
  return replaceContextSectionBody(
    draft,
    "(El contexto debe describir el **sistema**, la **audiencia** y el **alcance técnico**, no las instrucciones de la conversación. En la siguiente iteración el Clarificador/Arquitecto debe rellenar esta sección con el contexto real del proyecto.)",
  );
}

/** Si "1. Contexto y alcance" contiene solo metadatos (section3, toolPreference, diagramFormat, apiFormat), reemplaza por placeholder. */
export function replaceContextWhenOnlyMetadata(draft: string): string {
  const body = extractContextSectionBody(draft);
  if (!body || !isContextOnlyMetadata(body)) return draft;
  return replaceContextSectionBody(draft, "(Contexto pendiente de definir según alcance.)");
}

/** Inserta un bloque ## antes del primer heading núcleo (§2–§7). */
function insertSectionBlockBeforeFirstCoreHeading(
  draft: string,
  heading: string,
  body: string,
): string {
  const coreRe =
    /\n##\s+(?:[2-7]\.\s|Modelo\s+(?:de\s+)?datos|Contratos|Lógica|Seguridad|Infraestructura|Integraci[oó]n)/i;
  const m = draft.match(coreRe);
  const at = m?.index ?? draft.length;
  const block = `\n\n---\n\n${heading}\n\n${body.trim()}\n`;
  return draft.slice(0, at) + block + draft.slice(at);
}

function hasContextSectionHeading(draft: string): boolean {
  return CONTEXTO_HEADINGS_EXTRACT.some((h) => draft.includes(h));
}

function hasArquitecturaSectionHeading(draft: string): boolean {
  return /^##\s+2\.\s*(?:Arquitectura(?:\s+y\s*Stack)?|Stack)\b/im.test("\n" + draft);
}

const SECTION1_RESTORE_PLACEHOLDER =
  "(Pendiente: Clarificador — contexto y alcance del sistema.)";
const SECTION2_RESTORE_PLACEHOLDER =
  "(Pendiente: Arquitecto de Software — stack y arquitectura.)";

/** Restaura §1 desde baseline cuando el Arquitecto omitió el heading o el cuerpo. */
export function restoreContextSectionFromBaselineIfMissing(
  baseline: string,
  draft: string,
): string {
  const currentBody = extractContextSectionBody(draft);
  if (currentBody?.trim() && currentBody.length >= 20) return draft;
  const baselineBody = extractContextSectionBody(baseline);
  const body = baselineBody?.trim() || SECTION1_RESTORE_PLACEHOLDER;
  if (hasContextSectionHeading(draft)) {
    return replaceSection1BodyFromAnyHeading(draft, body);
  }
  return insertSectionBlockBeforeFirstCoreHeading(draft, "## 1. Contexto", body);
}

/** Restaura §2 desde baseline cuando el Arquitecto omitió el heading o el cuerpo. */
export function restoreArquitecturaSectionFromBaselineIfMissing(
  baseline: string,
  draft: string,
): string {
  const currentBody = extractArquitecturaSectionBody(draft);
  if (currentBody?.trim() && currentBody.length >= 20) return draft;
  const baselineBody = extractArquitecturaSectionBody(baseline);
  const body = baselineBody?.trim() || SECTION2_RESTORE_PLACEHOLDER;
  if (hasArquitecturaSectionHeading(draft)) {
    return replaceArquitecturaSectionBody(draft, body);
  }
  return insertSectionBlockBeforeFirstCoreHeading(draft, "## 2. Arquitectura y Stack", body);
}

/** Si el draft anterior tiene Contexto sustancial y el nuevo tiene uno peor (metadatos/key-value o más corto), preserva el anterior. */
export function preserveContextSectionIfSubstantial(previousDraft: string, newDraft: string): string {
  const prevBody = extractContextSectionBody(previousDraft);
  const newBody = extractContextSectionBody(newDraft);
  if (!prevBody || prevBody.length < 100) return newDraft;
  if (!newBody) return restoreContextSectionFromBaselineIfMissing(previousDraft, newDraft);
  if (newBody.length >= prevBody.length * 0.8) return newDraft;
  const looksLikeMetadata = /\b(section3|toolPreference|section\d|tool\s*:)\s*[:=]/i.test(newBody) || (newBody.split(/\n/).length <= 3 && newBody.length < 200);
  if (looksLikeMetadata || newBody.length < 80) {
    return replaceContextSectionBody(newDraft, prevBody);
  }
  return newDraft;
}

const ARQUITECTURA_HEADINGS = [
  /^##\s+2\.\s*Arquitectura\s+y\s*Stack\s*$/im,
  /^##\s+2\.\s*Arquitectura\s*$/im,
  /^##\s+2\.\s*Stack(?:\s+t[eé]cnico)?\s*$/im,
];

/** Extrae el cuerpo de la sección "## 2. Arquitectura y Stack" (hasta el siguiente ## o fin). */
export function extractArquitecturaSectionBody(draft: string): string | null {
  for (const re of ARQUITECTURA_HEADINGS) {
    re.lastIndex = 0;
    const match = re.exec(draft);
    if (!match) continue;
    const start = match.index + match[0].length;
    const after = draft.slice(start).replace(/^\s*\n+/, "");
    const nextH2 = after.search(/\n##\s+/);
    const body = nextH2 !== -1 ? after.slice(0, nextH2).trim() : after.trim();
    return body || null;
  }
  return null;
}

/**
 * Si la directiva pide Dokploy / no Kubernetes, actualiza la fila de contenedores en §2.1 de forma determinista.
 */
export function applyDeploymentStackDirectiveToDraft(draft: string, directive: string): string {
  if (!draft?.trim() || !directive?.trim()) return draft;
  const wantsDokploy = /\bdokploy\b/i.test(directive);
  const rejectsK8s =
    (/\b(no\s+se\s+usar[aá]?|sin\s+|reemplaz|sustitu|en\s+lugar\s+de)\b/i.test(directive) &&
      /\b(kubernetes|kubernets|k8s)\b/i.test(directive)) ||
    /\b(kubernetes|kubernets|k8s)\b[\s\S]{0,120}\b(dokploy)\b/i.test(directive);
  if (!wantsDokploy && !rejectsK8s) return draft;

  let body = extractArquitecturaSectionBody(draft);
  if (!body) return draft;

  body = body.replace(/\|\s*Contenedores\s*\|[^|\n]*\|[^|\n]*\|[^|\n]*\|/gi, (row) => {
    if (!/\bkubernetes|kubernets|k8s\b/i.test(row) && !/\bdokploy\b/i.test(row)) return row;
    return "| Contenedores | Docker + Dokploy | — | Despliegue con Dokploy; sin orquestación Kubernetes |";
  });
  body = body.replace(/Docker\s*\+\s*Kubernetes/gi, "Docker + Dokploy");
  body = body.replace(
    /\|\s*Infraestructura\s*\|[^|\n]*\b(?:kubernetes|kubernets|k8s)\b[^|\n]*\|/gi,
    "| Infraestructura | Docker / Dokploy | — |",
  );

  return replaceArquitecturaSectionBody(draft, body);
}

/** Reemplaza el cuerpo de "## 2. Arquitectura y Stack" en draft por newBody. */
export function replaceArquitecturaSectionBody(draft: string, newBody: string): string {
  for (const re of ARQUITECTURA_HEADINGS) {
    re.lastIndex = 0;
    const match = re.exec(draft);
    if (!match) continue;
    const sectionStart = match.index + match[0].length;
    const rest = draft.slice(sectionStart);
    const nextH2InRest = rest.search(/\n##\s+/);
    const endOfSection = nextH2InRest !== -1 ? sectionStart + nextH2InRest : draft.length;
    const afterSection = endOfSection < draft.length ? draft.slice(endOfSection).trimStart() : "";
    return draft.slice(0, sectionStart) + "\n\n" + newBody.trim() + (afterSection ? "\n\n" + afterSection : "");
  }
  return draft;
}

/** Si el draft anterior tiene §2 sustancial y el nuevo tiene (Pendiente) o muy corto, preserva el anterior. */
export function preserveArquitecturaSectionIfSubstantial(previousDraft: string, newDraft: string): string {
  const prevBody = extractArquitecturaSectionBody(previousDraft);
  const newBody = extractArquitecturaSectionBody(newDraft);
  if (!prevBody || prevBody.length < 80) return newDraft;
  if (!newBody) return newDraft;
  const newIsPlaceholder = /^\s*\(?\s*Pendiente\s*\)?\s*$/i.test(newBody.trim()) || newBody.trim().length < 100;
  if (!newIsPlaceholder) return newDraft;
  return replaceArquitecturaSectionBody(newDraft, prevBody);
}

/**
 * Rellena §1 (Contexto) y §2 (Arquitectura) en mddStructured desde el draft cuando el structured no los tiene.
 * Evita que cualquier agente que haga merge + toMarkdown borre Contexto y Arquitectura por no estar en structured.
 */
export function hydrateStructuredFromDraft(
  prev: MddStructured | null | undefined,
  draft: string,
): MddStructured {
  const base = (prev ?? {}) as MddStructured;
  const trimmed = (draft ?? "").trim();
  if (!trimmed) return base;
  const ctx = extractContextSectionBody(draft);
  const arch = extractArquitecturaSectionBody(draft);
  const out = { ...base };
  if (ctx && ctx.length >= 80 && !(base.contextoAlcance?.trim())) out.contextoAlcance = ctx;
  if (arch && arch.length >= 80 && !(base.arquitecturaStack?.trim())) out.arquitecturaStack = arch;
  return out as MddStructured;
}

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

/**
 * Normaliza headings H2 frecuentes del LLM al formato canónico del gate (§1–§7).
 * Debe ejecutarse antes de deduplicateAndReorderMddSections / validateMddStructure.
 */
export function normalizeCanonicalMddSectionHeadings(draft: string): string {
  if (!draft?.trim()) return draft;
  let out = repairInlineHorizontalRuleSectionBreaks(draft);
  out = out.replace(/^#{3,6}\s+(##\s+[1-7]\.\s+[^\n]+)$/gm, "$1");
  out = out.replace(/^##\s+Contexto(?:\s+y\s*alcance)?\s*$/gim, "## 1. Contexto");
  out = out.replace(
    /^##\s+2\.\s*Arquitectura(?!\s+y\s*Stack)\s*$/gim,
    "## 2. Arquitectura y Stack",
  );
  out = out.replace(/^##\s+2\.\s*Stack(?:\s+t[eé]cnico)?\s*$/gim, "## 2. Arquitectura y Stack");
  out = out.replace(/^##\s+Stack\s*$/gim, "## 2. Arquitectura y Stack");
  return out;
}

/** Títulos canónicos del MDD (7 secciones). */
const CANONICAL_HEADINGS: Array<{ pattern: RegExp; replacement: string }> = [
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
export function stripMermaidFences(content: string): string {
  if (!content || typeof content !== "string") return "";
  let s = content.trim();
  // Quitar uno o más ```mermaid (o ```) al inicio
  s = s.replace(/^(\s*```(?:mermaid)?\s*)+/i, "").trim();
  // Quitar uno o más ``` al final
  s = s.replace(/(\s*```\s*)+$/g, "").trim();
  return s;
}

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
function convertSection2JsonBodyToMarkdown(body: string): string | null {
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
function unwrapSection2SqlBlockContainingJson(draft: string): string {
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
function ensureTechnicalMetadataAtEndOfSection2(draft: string): string {
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
function stripJsonFromMermaidBlocks(body: string): string {
  return body.replace(/```mermaid\s*([\s\S]*?)```/gi, (_match, inner) => {
    const t = inner.trim();
    if (!t || /^erDiagram\b/i.test(t)) return _match;
    if (t.startsWith("##") || t.startsWith("{") || /"sqlPostgreSQL"\s*:/i.test(t)) {
      try {
        const firstBrace = t.indexOf("{");
        if (firstBrace !== -1) {
          const braceEnd = findBalancedBraceRespectingStrings(t, firstBrace);
          if (braceEnd !== -1) {
            const obj = JSON.parse(t.slice(firstBrace, braceEnd + 1)) as Record<string, unknown>;
            // erDiagram como string (clave "erDiagram") o diagramaER como array
            const erStr = (obj.erDiagram ?? obj.diagramaER ?? obj.diagrama_er) as string | string[] | undefined;
            if (typeof erStr === "string" && erStr.trim().length > 0 && /erDiagram|{\s*string\s+id/i.test(erStr)) {
              return "```mermaid\n" + erStr.trim() + "\n```";
            }
            const diagramaArr = erStr as string[] | undefined;
            if (Array.isArray(diagramaArr) && diagramaArr.length > 0) {
              const joined = diagramaArr.map((s) => (typeof s === "string" ? s : String(s)).trim()).filter(Boolean).join("\n");
              if (/erDiagram|{\s*string\s+id/i.test(joined)) return "```mermaid\n" + joined + "\n```";
            }
          }
        }
      } catch {
        // fall through to placeholder
      }
      return "```mermaid\nerDiagram\n  \n```";
    }
    return _match;
  });
}

/**
 * Dentro de bloques ```mermaid con erDiagram: relaciones : "id" con el nombre de FK correcto.
 * Anotaciones PK/FK: un solo marcador por línea (PK si es PK+FK); ver repairErDiagramPkFkCommas.
 */
function sanitizeErDiagramInMermaidBlocks(body: string): string {
  return body.replace(/```mermaid\s*([\s\S]*?)```/gi, (_match, inner) => {
    let content = inner.trim();
    if (!/erDiagram/i.test(content)) return _match;
    // Relaciones: etiquetar con la columna FK real (user_id, application_id, role_id)
    content = content.replace(
      /(users\s*\|\|--o\{\s*sessions\s*:\s*)"id"/gi,
      '$1"user_id"'
    );
    content = content.replace(
      /(applications\s*\|\|--o\{\s*roles\s*:\s*)"id"/gi,
      '$1"application_id"'
    );
    content = content.replace(
      /(users\s*\|\|--o\{\s*user_application_roles\s*:\s*)"id"/gi,
      '$1"user_id"'
    );
    content = content.replace(
      /(roles\s*\|\|--o\{\s*user_application_roles\s*:\s*)"id"/gi,
      '$1"role_id"'
    );
    content = content.replace(/(\|\|--o\{\s*sessions\s*:\s*)"id"/gi, '$1"user_id"');
    content = content.replace(/(\|\|--o\{\s*roles\s*:\s*)"id"/gi, '$1"application_id"');
    return "```mermaid\n" + content + "\n```";
  });
}

/**
 * En la sección 3: deja solo la primera ### Diagrama, primer ```mermaid y primer ```TechnicalMetadata.
 * Colapsa bloques TechnicalMetadata duplicados consecutivos y trunca tras el primero.
 */
function deduplicateSection3DiagramAndMetadata(body: string): string {
  let out = body.replace(
    /(```TechnicalMetadata\s*[\s\S]*?```)\s*(?:\s*```TechnicalMetadata\s*[\s\S]*?```\s*)+/gi,
    "$1\n\n"
  );
  const techMetaRe = /```TechnicalMetadata\s*[\s\S]*?```/gi;
  const firstTech = techMetaRe.exec(out);
  if (!firstTech) return out;
  const cutEnd = firstTech.index + firstTech[0].length;
  const rest = out.slice(cutEnd).replace(/^\s*\n+/, "").trim();
  if (!rest) return out;
  if (/```TechnicalMetadata|###\s*Diagrama\s+entidad-relación|```mermaid/i.test(rest)) {
    return out.slice(0, cutEnd).trim();
  }
  return out;
}

/**
 * Corrige doble fence en bloques Mermaid: ```mermaid\n```mermaid → ```mermaid; ```\n``` → ```.
 * Evita "Syntax error in text" en Mermaid cuando el LLM o el pipeline generó apertura/cierre duplicados.
 */
export function fixDoubleMermaidFences(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  let out = draft;
  // Doble apertura: ```mermaid seguido de ```mermaid en la siguiente línea
  out = out.replace(/```mermaid\s*\n+\s*```mermaid/gi, "```mermaid");
  // Doble cierre: ```\n``` al final de un bloque (deja solo un ```)
  out = out.replace(/\n```\s*\n+\s*```\s*(\n|$)/g, "\n```$1");
  return out;
}

/**
 * Dentro de cada bloque ```mermaid...``` reemplaza literales \n (backslash-n) por newline real.
 * El LLM a veces devuelve diagramaEr con \\n en el string; así Mermaid puede parsear el diagrama.
 */
export function unescapeMermaidLiteralNewlines(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  return draft.replace(/```mermaid\s*([\s\S]*?)```/gi, (_match, inner) => {
    const unescaped = inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
    return "```mermaid\n" + unescaped + "\n```";
  });
}

/**
 * Estandariza el formato del MDD: títulos canónicos, SQL en bloque ```sql, evita líneas sueltas como "3".
 * Se aplica al draft antes de mostrarlo para que cada regeneración se vea consistente.
 */
export function normalizeMddFormat(draft: string): string {
  let out = normalizeCanonicalMddSectionHeadings(stripTrailingDuplicateMddSections((draft || "").trim()));
  out = fixGluedSection6Heading(out);
  if (!out) return draft;
  // Muy al inicio: §6 pegada a ### (evita que deduplicateAndReorderMddSections tome heading+subheading como una línea)
  out = out.replace(/(6\.\s*Seguridad)\s*(#{1,6})/gi, "$1\n\n$2");

  out = unescapeLiteralNewlines(out);
  out = fixDoubleMermaidFences(out);
  out = unescapeMermaidLiteralNewlines(out);
  out = stripUserResponsesAndConversationHistory(out);
  out = sanitizeContextSection(out);
  out = replaceContextWhenInstructions(out);
  out = forceStripBrokenPrefix(out);
  out = collapseDuplicateMainTitle(out);
  out = out.replace(/\[object\s+Object\]/gi, "(contenido omitido)");
  out = stripBrokenMetadataDocumentBlock(out);
  out = sanitizeSeguridadIntegracionRawJson(out);
  // Quitar heading duplicado "### ## Integración" que a veces deja el LLM (dejar solo ## Integración)
  out = out.replace(/(##\s+Integración)\s*\n+\s*###\s*##\s*Integración\s*\n+/gi, "$1\n\n");
  out = stripInstructionAndFeedbackBlocks(out);
  out = replaceAwsProseWithGenericWhenInfraNotAws(out);

  for (const { pattern, replacement } of CANONICAL_HEADINGS) {
    out = out.replace(pattern, replacement);
  }
  out = normalizeMddEnglishSubheadings(out);
  // Dentro de ## 2. Arquitectura y Stack, normalizar 4.x → 2.x (subsecciones mal numeradas por el LLM)
  const archStackHeading = "## 2. Arquitectura y Stack";
  const archStackIdx = out.indexOf(archStackHeading);
  if (archStackIdx !== -1) {
    const afterArch = out.slice(archStackIdx + archStackHeading.length);
    const nextH2 = afterArch.search(/\n##\s+/);
    const body = nextH2 !== -1 ? afterArch.slice(0, nextH2) : afterArch;
    let normalizedBody = body
      .replace(/^\s*####\s+4\.(\d+)(\.?)(\s|$)/gim, (_, n, dot, rest) => `### 2.${n}${dot}${rest}`)
      .replace(/^\s*###\s+4\.(\d+)(\.?)(\s|$)/gim, (_, n, dot, rest) => `### 2.${n}${dot}${rest}`)
      .replace(/^\s*4\.(\d+)\./gm, "2.$1.");
    if (normalizedBody !== body) {
      out =
        out.slice(0, archStackIdx + archStackHeading.length) +
        normalizedBody +
        (nextH2 !== -1 ? afterArch.slice(nextH2) : "");
    }
  }
  // Quitar líneas huérfanas que son solo un número (ej. "3" entre Modelo de datos y Contratos)
  out = out.replace(/\n\s*\d+\s*\n/g, "\n");

  const modeloHeading = "## 3. Modelo de Datos";
  const modeloIdx = out.indexOf(modeloHeading);
  if (modeloIdx !== -1) {
    out = unwrapSection2SqlBlockContainingJson(out);
    out = fixSection2UnclosedSqlAndGluedMermaid(out);
    out = ensureSection2SqlBlockClosed(out);
    const sectionStart = modeloIdx + modeloHeading.length;
    const rest = out.slice(sectionStart);
    const nextH2 = rest.search(/\n##\s+/);
    const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
    let trimmedBody = body.replace(/^\s*\n+/, "").trim();
    // Quitar línea suelta "3" dentro del cuerpo por si no la pilló el replace global
    trimmedBody = trimmedBody.replace(/\n\s*\d+\s*\n/g, "\n").trim();
    trimmedBody = stripJsonFromMermaidBlocks(trimmedBody);
    trimmedBody = sanitizeErDiagramInMermaidBlocks(trimmedBody);
    trimmedBody = deduplicateSection3DiagramAndMetadata(trimmedBody);

    const fromJson = convertSection2JsonBodyToMarkdown(trimmedBody);
    if (fromJson) {
      out = out.slice(0, sectionStart) + fromJson + (nextH2 !== -1 ? rest.slice(nextH2) : "");
    } else if (trimmedBody && /CREATE\s+TABLE/i.test(trimmedBody) && !trimmedBody.includes("```sql")) {
      const sqlContent = trimmedBody
        .split(/\n/)
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter((l) => l.length > 0 && !/^\s*\d+\s*$/.test(l))
        .join("\n");
      if (sqlContent.length > 15) {
        const newBody = "\n\n```sql\n" + sqlContent + "\n```\n\n";
        out = out.slice(0, sectionStart) + newBody + (nextH2 !== -1 ? rest.slice(nextH2) : "");
      }
    } else if (
      !trimmedBody ||
      trimmedBody.length < 50 ||
      (!/CREATE\s+TABLE/i.test(trimmedBody) && /pendiente|placeholder/i.test(trimmedBody))
    ) {
      // Cuerpo vacío o solo placeholder: inyectar SQL mínimo (SSO/auth) para que la sección tenga contenido
      const minimalSql =
        "\n\n(Esquema mínimo; el Arquitecto debe completar con todas las tablas del dominio.)\n\n```sql\n" +
        "CREATE TABLE users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  username VARCHAR(255) NOT NULL UNIQUE,\n  password_hash VARCHAR(255) NOT NULL,\n  mfa_enabled BOOLEAN NOT NULL DEFAULT false,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE TABLE sessions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  token_hash VARCHAR(255) NOT NULL,\n  expires_at TIMESTAMPTZ NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n" +
        "```\n\n";
      out = out.slice(0, sectionStart) + minimalSql + (nextH2 !== -1 ? rest.slice(nextH2) : "");
    } else {
      // Aplicar cuerpo ya limpiado (JSON dentro de mermaid quitado, duplicados truncados)
      out = out.slice(0, sectionStart) + "\n\n" + trimmedBody + (nextH2 !== -1 ? rest.slice(nextH2) : "");
    }
    out = ensureTechnicalMetadataAtEndOfSection2(out);
    out = ensureSection2SqlFormattedInSection(out);
  }

  // Formatear sección Contratos de API: JSON en bloques ```json con indentación
  const contratosHeading = "## 4. Contratos de API";
  const contratosIdx = out.indexOf(contratosHeading);
  if (contratosIdx !== -1) {
    const sectionStart = contratosIdx + contratosHeading.length;
    const rest = out.slice(sectionStart);
    const nextH2 = rest.search(/\n##\s+/);
    const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
    let formatted = formatContratosBody(body);
    formatted = repairDisplacedJsonBracesInContratos(formatted);
    if (formatted !== body) {
      out = out.slice(0, sectionStart) + formatted + (nextH2 !== -1 ? rest.slice(nextH2) : "");
    }
  }

  out = fixGluedSection6Heading(out);

  // Sección 6 Seguridad: quitar "{:" o "{" pegado al heading (ej. "## 6. Seguridad{:")
  out = out.replace(/(##\s*6\.\s*Seguridad)\s*\{:\s*/gi, "$1\n\n");
  out = out.replace(/(##\s*6\.\s*Seguridad)\s*\{\s*\n/gi, "$1\n\n");
  // "6. Seguridad- Aspectos generales" → ## 6 + ## Aspectos Generales (formato canónico)
  out = out.replace(/(?:#+\s*)?6\.\s*Seguridad\s*-\s*Aspectos\s+generales:?\s*/gi, "## 6. Seguridad\n\n## Aspectos Generales\n\n");
  // Despegar "6. Seguridad-" genérico (solo en la misma línea; no tocar viñetas "- item" en líneas siguientes)
  out = out.replace(/(?:#+\s*)?6\.\s*Seguridad[^\S\n]*-\s*/gi, "## 6. Seguridad\n\n");
  // Corregir doble guion
  out = out.replace(/(##\s*6\.\s*Seguridad\n\n)-\s*-\s*/gi, "$1- ");
  // Si queda "## 6. Seguridad" o "6. Seguridad" pegado a "###", insertar salto (varias formas por si falla el regex anterior)
  out = out.replace(/6\.\s*Seguridad\s*###/gi, "6. Seguridad\n\n###");
  out = out.replace(/(##\s*6\.\s*Seguridad)([^\n]*?)(#{1,6}\s*)/gi, "$1\n\n$3");
  const seguridadHeading = "## 6. Seguridad";
  const seguridadIdx = out.indexOf(seguridadHeading);
  if (seguridadIdx !== -1) {
    const sectionStart = seguridadIdx + seguridadHeading.length;
    const rest = out.slice(sectionStart);
    const nextH2 = rest.search(/\n##\s+/);
    const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
    let fixed = body.replace(/\s*--\s*\n*$/, "").trim();
    fixed = fixSection6BulletedJsonToMarkdown(fixed) ?? fixed;
    fixed = fixSecuritySectionBullets(fixed);
    fixed = fixed.replace(/(\n\s*-\s*)+$/, "").replace(/\n\s*---\s*$/, "").trim();
    if (fixed !== body) {
      out =
        out.slice(0, sectionStart) + fixed + (nextH2 !== -1 ? rest.slice(nextH2) : "");
    }
  }

  // Deduplicar y reordenar secciones (1, 2, 3, 4, Seguridad, Integración)
  out = deduplicateAndReorderMddSections(out);

  // Separación visual: --- antes de cada ## (excepto si ya hay --- justo antes)
  out = ensureHorizontalRuleBeforeH2(out);

  // Colapsar múltiples líneas "---" consecutivas (con o sin líneas en blanco) en una sola
  out = collapseConsecutiveHorizontalRules(out);

  // Si la sección Integración tiene manifest con stack definido, quitar etiqueta "Nota/Pendiente"
  out = stripNotaPendienteHeadingWhenManifestComplete(out);

  // Si la sección 7 tiene manifest como texto plano (stack/pending sin ```json), envolver en ```json
  out = ensureManifestInJsonBlock(out);

  // En sección 7: quitar ### Integración redundante justo bajo ## 7. Infraestructura
  out = stripRedundantIntegracionHeadingInSection7(out);

  // Colapsar ### Manifest / ### Manifest de Infraestructura duplicados en sección 7
  out = collapseDuplicateManifestHeadings(out);

  // Eliminar sección errónea "## 4. Arquitectura Frontend" (estructura canónica: la 4 es Contratos de API)
  out = stripStandaloneArquitecturaFrontendSection(out);

  out = fixDeterministicMddCoherence(out);
  out = sanitizeAllSqlBlocksInDraft(out);
  out = stripMeshDirectivesFromDraft(out);

  if (mddHasDuplicateSectionHeadings(out)) {
    out = deduplicateAndReorderMddSections(out);
  }
  if (mddHasDuplicateSectionHeadings(out)) {
    out = stripTrailingDuplicateMddSections(out);
  }

  return out.trim();
}

/**
 * Pasada final antes de entregar al usuario: sin directivas mesh; deduplica y reordena §1–§7.
 * Preserva bloques añadidos tras §7 (p. ej. UI/UX) salvo que sean repetición de secciones núcleo.
 */
export function finalizeMddDeliverable(
  draft: string,
  options?: { baseline?: string | null },
): string {
  let out = sanitizeMddAtPersist(stripMeshDirectivesFromDraft(draft));

  const uiUxRe = /\n##\s+UI\/UX\s+Design\s+Intent\b[\s\S]*$/i;
  const uiUxMatch = out.match(uiUxRe);
  const uiUxSuffix = uiUxMatch?.[0]?.trim() ?? "";
  const core = uiUxSuffix ? out.slice(0, out.length - uiUxMatch![0].length).trim() : out;

  let fixedCore = ensureMissingCanonicalSections(
    stripTrailingDuplicateMddSections(core),
    options?.baseline?.trim() || undefined,
  );
  fixedCore = deduplicateAndReorderMddSections(fixedCore);
  if (mddHasDuplicateSectionHeadings(fixedCore)) {
    fixedCore = deduplicateAndReorderMddSections(stripTrailingDuplicateMddSections(fixedCore));
  }

  out = uiUxSuffix ? `${fixedCore}\n\n${uiUxSuffix}` : fixedCore;
  return stripMeshDirectivesFromDraft(out);
}

/** Elimina del draft la sección "## 4. Arquitectura Frontend" completa (hasta el siguiente ## o fin). Evita dos secciones 4. */
function stripStandaloneArquitecturaFrontendSection(draft: string): string {
  const re = /\n##\s+4\.\s*Arquitectura\s+Frontend\b[^\n]*/gi;
  const match = re.exec(draft);
  if (!match || match.index == null) return draft;
  const start = match.index + 1;
  const afterHeading = start + match[0].length;
  const rest = draft.slice(afterHeading);
  const nextH2 = rest.search(/\n##\s+/);
  const end = nextH2 !== -1 ? afterHeading + nextH2 : draft.length;
  const before = draft.slice(0, start).replace(/\n*---\s*\n*$/, "\n");
  const after = draft.slice(end).replace(/^\n*---\s*\n*/, "\n");
  return (before + after).trim();
}

/** En sección 7: si la primera subsección es ### Integración (redundante con el H2), reemplazarla por ### Resumen. */
function stripRedundantIntegracionHeadingInSection7(draft: string): string {
  const match = draft.match(/\n(##\s+(?:7\.\s+)?(?:Infraestructura|Integración)\b[^\n]*)/i);
  if (!match || match.index == null) return draft;
  const sectionStart = match.index + match[0].length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const fixed = body.replace(/^\s*###\s+Integración\s*\n+/i, "### Resumen\n\n");
  if (fixed === body) return draft;
  return draft.slice(0, sectionStart) + fixed + (nextH2 !== -1 ? rest.slice(nextH2) : "");
}

/** En sección 7: colapsa repeticiones de ### Manifest (incl. ### 7.5 Manifest...) y ### Manifest de Infraestructura en una sola. */
function collapseDuplicateManifestHeadings(draft: string): string {
  const match = draft.match(/\n(##\s+(?:7\.\s+)?(?:Infraestructura|Integración)\b[^\n]*)/i);
  if (!match || match.index == null) return draft;
  const sectionStart = match.index + match[0].length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const body = nextH2 !== -1 ? rest.slice(0, nextH2) : rest;
  const repeated = /(\n###\s*(?:\d+\.\d+\s+)?Manifest(?:\s+de\s+Infraestructura)?\s*\n*)+/gi;
  const collapsed = body.replace(repeated, "\n\n### Manifest de Infraestructura\n\n");
  if (collapsed === body) return draft;
  const newRest = collapsed + (nextH2 !== -1 ? rest.slice(nextH2) : "");
  return draft.slice(0, sectionStart) + newRest;
}

/** Reemplaza secuencias de líneas "---" (con o sin líneas en blanco entre ellas) por una sola "---". */
export function collapseConsecutiveHorizontalRules(draft: string): string {
  return draft.replace(/(\n---\s*\n)(\s*---\s*\n)*/g, "\n---\n");
}

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

/** Resultado de validación de estructura del MDD (para tools de Auditor/Redactor). */
export interface ValidateMddStructureResult {
  section3HasPayloads: boolean;
  missingSections: string[];
  hasTechnicalMetadata: boolean;
  sectionOrderCorrect: boolean;
  issues: string[];
}

const SECTION_HEADINGS_CANONICAL = [
  "1. Contexto",
  "2. Arquitectura y Stack",
  "3. Modelo de Datos",
  "4. Contratos de API",
  "5. Lógica y Edge Cases",
  "6. Seguridad",
  "7. Infraestructura",
];

function getSectionBody(draft: string, pattern: RegExp): string | null {
  const match = draft.match(pattern);
  if (!match) return null;
  const idx = draft.indexOf(match[0]);
  const start = idx + match[0].length;
  const rest = draft.slice(start).replace(/^\s*\n+/, "");
  const nextH2 = rest.search(/\n##\s+/);
  return (nextH2 !== -1 ? rest.slice(0, nextH2) : rest).trim();
}

/** Resumen del draft para logs: longitud y estado de la sección 3 (modelo de datos). */
export function getMddDraftSummary(draft: string): { length: number; section2: "sql" | "placeholder" | "empty" } {
  const trimmed = (draft ?? "").trim();
  const body = getSectionBody(trimmed, /##\s*3\.\s*Modelo\s+(?:de\s+)?datos|##\s*2\.\s*Modelo\s+(?:de\s+)?datos/i);
  let section2: "sql" | "placeholder" | "empty" = "empty";
  if (body && body.length > 10) {
    section2 = /CREATE\s+TABLE/i.test(body) ? "sql" : /pendiente|placeholder/i.test(body) ? "placeholder" : "empty";
  }
  return { length: trimmed.length, section2 };
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
export function getSection6Or7Range(
  draft: string,
  section: 6 | 7,
): { start: number; end: number; heading: string } | null {
  const trimmed = fixGluedSection6Heading((draft ?? "").trim());
  const re =
    section === 6
      ? /(?:^|\n)(##\s+(?:6\.\s+)?Seguridad[^\n]*)/im
      : /(?:^|\n)(##\s+(?:7\.\s+)?(?:Infraestructura|Integración)[^\n]*)/im;
  const m = trimmed.match(re);
  if (!m || m.index == null) return null;
  const heading = m[1] ?? (section === 6 ? "## 6. Seguridad" : "## 7. Infraestructura");
  const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
  const afterHeading = start + heading.length;
  const rest = trimmed.slice(afterHeading).replace(/^\s*\n+/, "");
  const nextH2 = rest.search(/\n##\s+/);
  const end = nextH2 >= 0 ? afterHeading + nextH2 : trimmed.length;
  return { start, end, heading };
}

/**
 * Reemplaza solo la sección 6 (Seguridad) o 7 (Infraestructura) en el draft por newSectionMarkdown.
 * newSectionMarkdown debe incluir el heading canónico (## 6. Seguridad o ## 7. Infraestructura) y el cuerpo.
 * Si la sección no existe, la inserta antes de la otra (§6 antes de §7) o al final.
 * Preserva §1–§5 del draft entrante (no reconstruye desde mddStructured).
 */
export function replaceSection6Or7InDraft(
  draft: string,
  section: 6 | 7,
  newSectionMarkdown: string,
): string {
  let sectionMd = newSectionMarkdown.trim();
  if (section === 6) {
    sectionMd = sectionMd.replace(/\s*--\s*\n*$/, "").trim();
  }
  const trimmed = (draft ?? "").trim();
  const range = getSection6Or7Range(trimmed, section);
  if (range) {
    const before = trimmed.slice(0, range.start);
    const after = range.end < trimmed.length ? trimmed.slice(range.end).trimStart() : "";
    return (before + sectionMd + (after ? "\n\n" + after : "")).trim();
  }
  const otherRange = getSection6Or7Range(trimmed, section === 6 ? 7 : 6);
  if (section === 6 && otherRange) {
    return (trimmed.slice(0, otherRange.start) + sectionMd + "\n\n" + trimmed.slice(otherRange.start)).trim();
  }
  if (section === 7 && otherRange) {
    return (trimmed.slice(0, otherRange.end) + "\n\n" + sectionMd + (otherRange.end < trimmed.length ? "\n\n" + trimmed.slice(otherRange.end) : "")).trim();
  }
  return (trimmed + "\n\n" + sectionMd).trim();
}

/** Placeholders explícitos del pipeline (sin umbral de longitud). */
export function isMddSectionPipelinePlaceholderBody(body: string | null | undefined): boolean {
  const b = (body ?? "").trim();
  if (!b) return true;
  if (/^\s*\(?\s*(Pendiente|TBD|\[Placeholder|\/\/ TODO)/i.test(b)) return true;
  if (/Pendiente:\s*Arquitecto/i.test(b)) return true;
  if (/Pendiente:\s*Ingeniero/i.test(b)) return true;
  return false;
}

/** Cuerpo de sección MDD que aún no tiene contenido real (placeholders del pipeline). */
export function isMddSectionPlaceholderBody(body: string | null | undefined): boolean {
  const b = (body ?? "").trim();
  if (!b || b.length < 30) return true;
  return isMddSectionPipelinePlaceholderBody(b);
}

export function extractSection6Body(draft: string): string | null {
  const range = getSection6Or7Range((draft ?? "").trim(), 6);
  if (!range) return null;
  const body = draft.slice(range.start + range.heading.length, range.end).replace(/^\s*\n+/, "").trim();
  return isMddSectionPlaceholderBody(body) ? null : body;
}

export function extractSection7Body(draft: string): string | null {
  const range = getSection6Or7Range((draft ?? "").trim(), 7);
  if (!range) return null;
  const body = draft.slice(range.start + range.heading.length, range.end).replace(/^\s*\n+/, "").trim();
  return isMddSectionPlaceholderBody(body) ? null : body;
}

function replaceH2SectionBody(draft: string, headingPattern: RegExp, newBody: string): string {
  headingPattern.lastIndex = 0;
  const match = headingPattern.exec(draft);
  if (!match || match.index == null) return draft;
  const sectionStart = match.index + match[0].length;
  const rest = draft.slice(sectionStart);
  const nextH2 = rest.search(/\n##\s+/);
  const endOfSection = nextH2 !== -1 ? sectionStart + nextH2 : draft.length;
  const afterSection = endOfSection < draft.length ? draft.slice(endOfSection).trimStart() : "";
  return draft.slice(0, sectionStart) + "\n\n" + newBody.trim() + (afterSection ? "\n\n" + afterSection : "");
}

function replaceSection3Body(draft: string, newBody: string): string {
  return replaceH2SectionBody(draft, /##\s*3\.\s*Modelo\s+(?:de\s+)?datos/i, newBody);
}

function replaceSection4Body(draft: string, newBody: string): string {
  return replaceH2SectionBody(
    draft,
    /##\s*4\.\s*Contratos\s+de\s+API|##\s*3\.\s*Contratos\s+de\s+API|##\s*Contratos\s+de\s+API/i,
    newBody,
  );
}

function replaceSection5Body(draft: string, newBody: string): string {
  return replaceH2SectionBody(draft, /##\s*5\.\s*Lógica\s+y\s*Edge\s+Cases/i, newBody);
}

/** Secciones 1–7 que no serán reescritas por los nodos del plan sections (sin format/diagram/auditor). */
export function getSectionsToPreserveFromExecutorPlan(sectionsToRun: string[] | undefined): number[] {
  if (!sectionsToRun?.length) return [];
  const touched = new Set<number>();
  for (const node of sectionsToRun) {
    if (node === "clarifier" || node === "merge_section1_only") touched.add(1);
    if (node === "software_architect") {
      touched.add(2);
      touched.add(3);
      touched.add(4);
      touched.add(5);
    }
    if (node === "security") touched.add(6);
    if (node === "integration") touched.add(7);
  }
  return [1, 2, 3, 4, 5, 6, 7].filter((n) => !touched.has(n));
}

/**
 * Restaura desde baseline las secciones listadas cuando el draft actual tiene placeholder o cuerpo peor.
 * Usado en planes acotados (executorControlled + sectionsToRun) para no vaciar §3–§6 fuera de alcance.
 */
export function preserveUntouchedMddSectionsFromBaseline(
  currentDraft: string,
  baselineDraft: string,
  sectionsToPreserve: number[],
): string {
  if (!baselineDraft.trim() || !sectionsToPreserve.length) return currentDraft;
  let out = currentDraft;
  for (const n of sectionsToPreserve) {
    const prevBody =
      n === 1
        ? extractContextSectionBody(baselineDraft)
        : n === 2
          ? extractArquitecturaSectionBody(baselineDraft)
          : n === 3
            ? extractSection3Body(baselineDraft)
            : n === 4
              ? extractSection4Body(baselineDraft)
              : n === 5
                ? getSectionBody(baselineDraft.trim(), /##\s*5\.\s*Lógica\s+y\s*Edge\s+Cases/i)
                : n === 6
                  ? extractSection6Body(baselineDraft)
                  : n === 7
                    ? extractSection7Body(baselineDraft)
                    : null;
    if (!prevBody || isMddSectionPlaceholderBody(prevBody)) continue;
    const curBody =
      n === 1
        ? extractContextSectionBody(out)
        : n === 2
          ? extractArquitecturaSectionBody(out)
          : n === 3
            ? extractSection3Body(out)
            : n === 4
              ? extractSection4Body(out)
              : n === 5
                ? getSectionBody(out.trim(), /##\s*5\.\s*Lógica\s+y\s*Edge\s+Cases/i)
                : n === 6
                  ? extractSection6Body(out) ?? getSectionBody(out.trim(), /##\s*6\.\s*Seguridad/i)
                  : n === 7
                    ? extractSection7Body(out) ?? getSectionBody(out.trim(), /##\s*7\.\s*Infraestructura/i)
                    : null;
    const curIsPlaceholder = isMddSectionPlaceholderBody(curBody);
    const curShorter = (curBody?.length ?? 0) < prevBody.length * 0.5;
    if (!curIsPlaceholder && !curShorter) continue;
    if (n === 1) out = replaceContextSectionBody(out, prevBody);
    else if (n === 2) out = replaceArquitecturaSectionBody(out, prevBody);
    else if (n === 3) out = replaceSection3Body(out, prevBody);
    else if (n === 4) out = replaceSection4Body(out, prevBody);
    else if (n === 5) out = replaceSection5Body(out, prevBody);
    else if (n === 6) out = replaceSection6Or7InDraft(out, 6, `## 6. Seguridad\n\n${prevBody}`);
    else if (n === 7) out = replaceSection6Or7InDraft(out, 7, `## 7. Infraestructura\n\n${prevBody}`);
  }
  return out;
}

/**
 * Restaura secciones desde el borrador baseline sin heurística de placeholder.
 * Usado en upstream-sync para no tocar §6 (u otras) fuera del alcance solicitado.
 */
export function restoreMddSectionsFromBaselineStrict(
  currentDraft: string,
  baselineDraft: string,
  sectionsToRestore: readonly number[],
): string {
  if (!baselineDraft.trim() || !sectionsToRestore.length) return currentDraft;
  let out = currentDraft;
  for (const n of sectionsToRestore) {
    const prevBody =
      n === 1
        ? extractContextSectionBody(baselineDraft)
        : n === 2
          ? extractArquitecturaSectionBody(baselineDraft)
          : n === 3
            ? extractSection3Body(baselineDraft)
            : n === 4
              ? extractSection4Body(baselineDraft)
              : n === 5
                ? getSectionBody(baselineDraft.trim(), /##\s*5\.\s*Lógica\s+y\s*Edge\s+Cases/i)
                : n === 6
                  ? extractSection6Body(baselineDraft)
                  : n === 7
                    ? extractSection7Body(baselineDraft)
                    : null;
    if (!prevBody?.trim()) continue;
    if (n === 1) out = replaceContextSectionBody(out, prevBody);
    else if (n === 2) out = replaceArquitecturaSectionBody(out, prevBody);
    else if (n === 3) out = replaceSection3Body(out, prevBody);
    else if (n === 4) out = replaceSection4Body(out, prevBody);
    else if (n === 5) out = replaceSection5Body(out, prevBody);
    else if (n === 6) out = replaceSection6Or7InDraft(out, 6, `## 6. Seguridad\n\n${prevBody}`);
    else if (n === 7) out = replaceSection6Or7InDraft(out, 7, `## 7. Infraestructura\n\n${prevBody}`);
  }
  return out;
}

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
export function extractSection3Body(draft: string): string | null {
  const body = getSectionBody((draft ?? "").trim(), /##\s*3\.\s*Modelo\s+(?:de\s+)?datos/i);
  return body && body.length > 0 ? body : null;
}

const DEBUG_S3_ENV = "DEBUG_MDD_SECTION3";
const DEBUG_S3_PREVIEW_LEN = 800;

/**
 * Si DEBUG_MDD_SECTION3=1, escribe en consola el cuerpo de §3 (longitud + preview) para comparar
 * post-SA vs final y localizar dónde se pierde el contenido.
 */
export function logSection3Debug(label: string, draft: string): void {
  if (process.env[DEBUG_S3_ENV] !== "1" && process.env[DEBUG_S3_ENV] !== "true") return;
  const body = extractSection3Body(draft);
  const len = body?.length ?? 0;
  const preview = body ? body.slice(0, DEBUG_S3_PREVIEW_LEN).replace(/\n/g, " ") + (body.length > DEBUG_S3_PREVIEW_LEN ? "…" : "") : "(sin §3)";
  const tables = body ? (body.match(/CREATE\s+TABLE\s+(\w+)/gi) ?? []).join(", ") : "";
  console.log(`[MDD:§3 DEBUG] ${label} len=${len} tables=[${tables}] preview=${preview}`);
}

/** Extrae el cuerpo de la sección ## 4. Contratos de API (hasta el siguiente ## o fin). */
export function extractSection4Body(draft: string): string | null {
  const body = getSectionBody(
    (draft ?? "").trim(),
    /##\s*4\.\s*Contratos\s+de\s+API|##\s*3\.\s*Contratos\s+de\s+API|##\s*Contratos\s+de\s+API/i,
  );
  return body && body.length > 0 ? body : null;
}

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
export function validateMddStructure(draft: string): ValidateMddStructureResult {
  const trimmed = repairInlineHorizontalRuleSectionBreaks((draft || "").trim());
  const issues: string[] = [];
  const missingSections: string[] = [];
  const foundOrder: string[] = [];
  const withNewline = "\n" + (trimmed.startsWith("#") ? trimmed : "# " + trimmed);

  for (let i = 0; i < SECTION_ORDER.length; i++) {
    const { pattern } = SECTION_ORDER[i];
    const re = /\n(##\s+[^\n]+)/gi;
    let match: RegExpExecArray | null = null;
    let sectionFound = false;
    while ((match = re.exec(withNewline)) !== null) {
      if (pattern.test(match[1])) {
        const bodyStart = match.index + match[0].length;
        const rest = withNewline.slice(bodyStart).replace(/^\s*\n+/, "");
        const nextH2 = rest.search(/\n##\s+/);
        const body = (nextH2 !== -1 ? rest.slice(0, nextH2) : rest).trim();
        if (body.length > 0) foundOrder.push(SECTION_HEADINGS_CANONICAL[i]);
        sectionFound = true;
        break;
      }
    }
    if (!sectionFound) missingSections.push(SECTION_HEADINGS_CANONICAL[i]);
  }

  const section4Body = getSectionBody(trimmed, /##\s*4\.\s*Contratos\s+de\s+API|##\s*3\.\s*Contratos\s+de\s+API|##\s*Contratos\s+de\s+API/i);
  const section3HasPayloads =
    !!section4Body &&
    section4Body.length >= 100 &&
    !/^\s*\(?\s*(Pendiente|Falta):\s*definir\s+endpoints/i.test(section4Body) &&
    (/```json/i.test(section4Body) || /\b(POST|GET|PUT|DELETE|PATCH)\s+[\"']?\//i.test(section4Body) || /###\s+(POST|GET|PUT|DELETE|PATCH)/i.test(section4Body));

  if (!section3HasPayloads && section4Body !== null) {
    issues.push("Sección 4. Contratos de API: debe incluir tabla de endpoints y al menos 2-3 endpoints con request/response en bloques ```json.");
  }
  if (missingSections.length > 0) {
    issues.push("Secciones faltantes: " + missingSections.join(", "));
  }

  const hasTechnicalMetadata =
    /TechnicalMetadata|\[high_security\]|\[external_api\]|\[multi_tenant\]|\[cicd_pipeline\]|\[real_time\]/i.test(trimmed);

  if (!hasTechnicalMetadata) {
    issues.push("Falta bloque TechnicalMetadata con etiquetas (ej. [high_security], [external_api]) en la sección 3. Modelo de Datos.");
  }

  const sectionOrderCorrect =
    foundOrder.length === 0 ||
    foundOrder.every((h, idx) => h === SECTION_HEADINGS_CANONICAL[idx]);

  if (mddHasDuplicateSectionHeadings(trimmed)) {
    issues.push("MDD repite headings de §5, §6 o §7; deduplicar antes de entregar.");
  }

  for (const q of collectMddQualityIssues(trimmed)) {
    if (!issues.includes(q)) issues.push(q);
  }

  return {
    section3HasPayloads,
    missingSections,
    hasTechnicalMetadata,
    sectionOrderCorrect,
    issues,
  };
}

/** Títulos canónicos en orden para reordenar y deduplicar el MDD (7 secciones). */
const SECTION_ORDER = [
  { pattern: /^##\s+1\.\s*Contexto\b/i, heading: "## 1. Contexto" },
  { pattern: /^##\s+2\.\s*(?:Arquitectura(?:\s+y\s*Stack)?|Stack(?:\s+t[eé]cnico)?)\b/i, heading: "## 2. Arquitectura y Stack" },
  { pattern: /^##\s+3\.\s*Modelo\s+(?:de\s+)?datos/i, heading: "## 3. Modelo de Datos" },
  { pattern: /^##\s+4\.\s*Contratos\s+de\s+API/i, heading: "## 4. Contratos de API" },
  { pattern: /^##\s+5\.\s*Lógica\s+y\s*Edge\s+Cases/i, heading: "## 5. Lógica y Edge Cases" },
  // §6: acepta numbered (## 6. Seguridad) y bare (## Seguridad); sin \b (admite SeguridadGestión pegado)
  { pattern: RE_SECTION6_H2_LINE, heading: "## 6. Seguridad" },
  // §7: acepta Infraestructura o Integración, con o sin número
  { pattern: /^##\s+(?:7\.\s*)?(?:Infraestructura|Integración)\b/i, heading: "## 7. Infraestructura" },
];

/** Safety net: reinserta §1/§2 desde baseline (p. ej. Clarificador) antes del gate/dedupe. */
export function ensureMissingCanonicalSections(draft: string, baseline?: string): string {
  let out = normalizeCanonicalMddSectionHeadings((draft ?? "").trim());
  if (!out) return draft;
  const base = baseline?.trim() ? normalizeCanonicalMddSectionHeadings(baseline) : "";

  let missing = validateMddStructure(out).missingSections;
  if (missing.includes("1. Contexto")) {
    out = base
      ? restoreContextSectionFromBaselineIfMissing(base, out)
      : insertSectionBlockBeforeFirstCoreHeading(out, "## 1. Contexto", SECTION1_RESTORE_PLACEHOLDER);
    missing = validateMddStructure(out).missingSections;
  }
  if (missing.includes("2. Arquitectura y Stack")) {
    out = base
      ? restoreArquitecturaSectionFromBaselineIfMissing(base, out)
      : insertSectionBlockBeforeFirstCoreHeading(out, "## 2. Arquitectura y Stack", SECTION2_RESTORE_PLACEHOLDER);
    missing = validateMddStructure(out).missingSections;
  }
  if (missing.includes("6. Seguridad") && base) {
    const baseRepaired = repairInlineHorizontalRuleSectionBreaks(base);
    const range = getSection6Or7Range(baseRepaired, 6);
    if (range) {
      const sectionMd = baseRepaired.slice(range.start, range.end).trim();
      if (sectionMd.length > 100 && !isMddSectionPipelinePlaceholderBody(sectionMd.replace(/^##[^\n]+\n+/, ""))) {
        out = replaceSection6Or7InDraft(out, 6, sectionMd);
      }
    }
    missing = validateMddStructure(out).missingSections;
  }
  if (missing.includes("7. Infraestructura") && base) {
    const baseRepaired = repairInlineHorizontalRuleSectionBreaks(base);
    const range = getSection6Or7Range(baseRepaired, 7);
    if (range) {
      const sectionMd = baseRepaired.slice(range.start, range.end).trim();
      const bodyOnly = sectionMd.replace(/^##[^\n]+\n+/, "").trim();
      if (bodyOnly.length > 100 && !isMddSectionPipelinePlaceholderBody(bodyOnly)) {
        out = replaceSection6Or7InDraft(out, 7, sectionMd);
      }
    }
  }
  return out;
}

/**
 * Índice del siguiente ## que NO está dentro de un bloque con fences (```...```).
 * Así no cortamos una sección en un ## que sea contenido literal (ej. dentro de ```markdown).
 */
function indexOfNextH2OutsideFenced(text: string, fromIndex: number): number {
  const rest = text.slice(fromIndex);
  const re = /\n##\s+/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(rest)) !== null) {
    const pos = fromIndex + match.index;
    const before = text.slice(0, pos);
    const fences = (before.match(/```/g) || []).length;
    if (fences % 2 === 0) return pos;
  }
  return -1;
}

/**
 * Extrae el contenido de una sección (desde la línea del heading hasta el siguiente ## o fin).
 * No considera ## que estén dentro de bloques ```...``` para no partir en contenido embebido.
 */
function extractSection(draft: string, startIndex: number): { heading: string; body: string } {
  const afterStart = draft.slice(startIndex).replace(/^\s*\n+/, "");
  const firstNewline = afterStart.indexOf("\n");
  const heading = firstNewline !== -1 ? afterStart.slice(0, firstNewline).trim() : afterStart.trim();
  const bodyStartRel = firstNewline !== -1 ? firstNewline + 1 : afterStart.length;
  const rest = afterStart.slice(bodyStartRel);
  const nextH2 = indexOfNextH2OutsideFenced(draft, startIndex + bodyStartRel);
  const bodyEnd = nextH2 !== -1 ? nextH2 - startIndex - bodyStartRel : rest.length;
  const body = rest.slice(0, bodyEnd).replace(/^\s*\n+/, "").trim();
  return { heading, body };
}

/** Si el cuerpo de la sección 2 contiene ## 3, ## 4 (Contratos o Arquitectura Frontend), ### 4.x (frontend) o bloque ```markdown con ##, es contenido desplazado; reemplazar por placeholder. */
function sanitizeArquitecturaStackBody(body: string): string {
  const hasMisplaced =
    /##\s*3\.\s*Modelo\s+(?:de\s+)?datos/i.test(body) ||
    /##\s*4\.\s*Contratos\s+de\s+API/i.test(body) ||
    /##\s*4\.\s*Arquitectura\s+Frontend/i.test(body) ||
    /###\s*4\.\d+/i.test(body) ||
    /###\s*4\.\s/i.test(body) ||
    /```markdown\s*[\s\S]*?##\s*[34]\./i.test(body);
  if (hasMisplaced) return "(Pendiente: Arquitecto de Software)";
  return body;
}

/** Número canónico 1–7 a partir del heading ## N. … */
function canonicalSectionNumber(heading: string): number | null {
  const m = heading.match(/^##\s+(\d+)\./);
  if (m) {
    const n = parseInt(m[1]!, 10);
    return n >= 1 && n <= 7 ? n : null;
  }
  if (RE_SECTION6_H2_LINE.test(heading)) return 6;
  if (/^##\s+(?:Infraestructura|Integraci[oó]n)\b/i.test(heading)) return 7;
  return null;
}

const SECTION6_MISSING_PLACEHOLDER = "(Pendiente: Arquitecto de Seguridad)";

/**
 * Si hay §7 (o §5) pero falta el heading canónico ## 6. Seguridad, lo inserta antes de §7.
 * Evita el salto visible 5 → 7 cuando el plan omitió al agente security o el LLM no emitió §6.
 */
export function ensureSection6WhenSection7Present(draft: string): string {
  const trimmed = fixGluedSection6Heading((draft ?? "").trim());
  if (!trimmed || getSection6Or7Range(trimmed, 6)) return draft;
  if (!getSection6Or7Range(trimmed, 7)) return draft;
  if (!/\n##\s+5\.\s*Lógica\s+y\s*Edge\s+Cases\b/i.test(trimmed)) return draft;
  return replaceSection6Or7InDraft(
    trimmed,
    6,
    `## 6. Seguridad\n\n${SECTION6_MISSING_PLACEHOLDER}`,
  );
}

/**
 * Reordena el MDD a 1..7 y elimina secciones duplicadas.
 * No parte en ## que estén dentro de bloques ```. Si la sección 2 contiene ## 3/## 4 embebidos, la reemplaza por placeholder.
 */
export function deduplicateAndReorderMddSections(draft: string): string {
  let trimmed = stripTrailingDuplicateMddSections((draft || "").trim());
  trimmed = fixGluedSection6Heading(trimmed);
  trimmed = ensureSection6WhenSection7Present(trimmed);
  if (!trimmed) return draft;
  const hadDuplicates = mddHasDuplicateSectionHeadings(trimmed);
  // Corregir §6 pegada a ### antes de extraer (evita que extractSection tome "## 6. Seguridad###..." como una sola línea)
  trimmed = trimmed.replace(/(6\.\s*Seguridad)\s*(#{1,6})/gi, "$1\n\n$2");
  const titleMatch = trimmed.match(/^#\s+Master\s+Design\s+Document[^\n]*/i);
  const title = titleMatch ? titleMatch[0] : "# Master Design Document";
  const afterTitle = titleMatch ? trimmed.slice(titleMatch[0].length).replace(/^\s*\n+/, "") : trimmed;
  const withNewline = "\n" + afterTitle;
  const sections: Array<{ heading: string; body: string }> = [];
  for (const { pattern } of SECTION_ORDER) {
    const re = /\n(##\s+[^\n]+)/gi;
    let match: RegExpExecArray | null = null;
    const candidates: Array<{ heading: string; body: string }> = [];
    while ((match = re.exec(withNewline)) !== null) {
      const line = match[1];
      if (pattern.test(line)) {
        const { heading: actualHeading, body } = extractSection(withNewline, match.index);
        let bodyToUse = body;
        if (/^##\s*2\.\s*Arquitectura\s+y\s*Stack/i.test(actualHeading))
          bodyToUse = sanitizeArquitecturaStackBody(body);
        candidates.push({ heading: actualHeading, body: bodyToUse });
      }
    }
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (a.body.length >= b.body.length ? a : b));
    sections.push(best);
  }
  // El escaneo por SECTION_ORDER puede perder §6/§7 recién insertadas (p. ej. tras /seguridad).
  // Recuperarlas del borrador original con getSection6Or7Range antes de reconstruir.
  for (const sectionNum of [6, 7] as const) {
    const range = getSection6Or7Range(trimmed, sectionNum);
    if (!range) continue;
    const canonical = sectionNum === 6 ? "## 6. Seguridad" : "## 7. Infraestructura";
    const already = sections.some((s) =>
      sectionNum === 6
        ? RE_SECTION6_H2_LINE.test(s.heading)
        : /^##\s+(?:7\.\s+)?(?:Infraestructura|Integraci[oó]n)/i.test(s.heading),
    );
    if (already) continue;
    const body = trimmed
      .slice(range.start + range.heading.length, range.end)
      .replace(/^\s*\n+/, "")
      .trim();
    if (body.length > 0) sections.push({ heading: canonical, body });
  }
  const byNumber = new Map<number, { heading: string; body: string }>();
  for (const s of sections) {
    const num = canonicalSectionNumber(s.heading);
    if (num == null) continue;
    const prev = byNumber.get(num);
    if (!prev || s.body.length >= prev.body.length) byNumber.set(num, s);
  }
  const orderedSections = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, s]) => s);
  if (orderedSections.length === 0) return draft;
  const out = [title, "", ...orderedSections.flatMap((s) => ["---", s.heading, "", s.body, ""])];
  let result = out.join("\n").trim();
  // Con duplicados conocidos, forzar dedup aunque el resultado sea mucho más corto.
  if (!hadDuplicates && result.length < trimmed.length * 0.5) return draft;
  result = ensureSection6WhenSection7Present(result);
  if (mddHasDuplicateSectionHeadings(result)) {
    result = stripTrailingDuplicateMddSections(result);
  }
  return result;
}

/** Inserta `---` antes de cada `##` que no tenga ya una línea `---` inmediatamente anterior. */
function ensureHorizontalRuleBeforeH2(draft: string): string {
  const lines = draft.split("\n");
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isH2 = /^##\s+/.test(line);
    const prevLine = result[result.length - 1] ?? "";
    if (isH2 && prevLine.trim() !== "---") {
      // No insertar --- antes del primer ## si va justo tras el título # (opcional: siempre insertar)
      if (result.length > 0) result.push("---");
    }
    result.push(line);
  }
  return result.join("\n");
}

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
function formatContratosBody(body: string): string {
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
