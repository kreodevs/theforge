/**
 * Auditoría determinista de calidad MDD (agnóstica al dominio).
 * Usado por delivery gate, auditor y sanitize.
 */

import { extractSection } from "./conformance.service.js";

const PLACEHOLDER_NOISE_RE = /(?:^|\n)#+\s*[^\n]*(?:---\s*){3,}/m;

/** §4: bloques ```json con fences desbalanceados. */
export function detectUnbalancedJsonFences(draft: string): string | null {
  const section4 = extractSection(
    draft,
    /^#+\s*(?:4\.\s*)?(?:contratos\s+de\s+api|api\s+contracts|endpoints)/im,
  );
  if (!section4) return null;
  const fences = (section4.match(/```/g) ?? []).length;
  if (fences % 2 !== 0) {
    return "§4 Contratos de API: bloques ```json con fences desbalanceados (respuestas intercaladas).";
  }
  const jsonBlocks = section4.match(/```json[\s\S]*?```/gi) ?? [];
  for (const block of jsonBlocks) {
    const inner = block.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    if (!inner) continue;
    try {
      JSON.parse(inner);
    } catch {
      return "§4 Contratos de API: bloque ```json con JSON inválido o truncado.";
    }
  }
  return null;
}

/** Diagramas Mermaid sin fence ```mermaid. */
export function detectBareMermaidBlocks(draft: string): string[] {
  const issues: string[] = [];
  const lines = (draft ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (/^mermaid\s*$/i.test(line)) {
      const next = lines[i + 1]?.trim() ?? "";
      if (/^(flowchart|sequenceDiagram|erDiagram|graph\s)/i.test(next)) {
        issues.push(`Línea ${i + 1}: diagrama Mermaid sin fence \`\`\`mermaid.`);
      }
    }
    if (/^(flowchart|sequenceDiagram)\s/i.test(line)) {
      const prev = lines[i - 1]?.trim() ?? "";
      if (!/^```\s*mermaid/i.test(prev) && prev !== "mermaid") {
        issues.push(`Línea ${i + 1}: ${line.split(/\s/)[0]} suelto sin \`\`\`mermaid.`);
      }
    }
  }
  return issues.slice(0, 6);
}

/** Tablas SQL con ≤2 columnas de negocio y sin FK referenciada en el ER. */
export function detectOrphanSqlTables(draft: string): string[] {
  const sqlMatch = draft.match(/```sql\s*([\s\S]*?)```/i);
  if (!sqlMatch?.[1]) return [];
  const sql = sqlMatch[1];
  const orphans: string[] = [];
  const createRe = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    const name = m[1]!.toLowerCase();
    const body = m[2] ?? "";
    const colLines = body
      .split(/,\s*\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(primary\s+key|constraint|unique|check|foreign\s+key)/i.test(l));
    const businessCols = colLines.filter(
      (l) => !/^(id|created_at|updated_at)\b/i.test(l.split(/\s+/)[0] ?? ""),
    );
    if (businessCols.length <= 1 && colLines.length <= 3) {
      orphans.push(name);
    }
  }
  if (orphans.length === 0) return [];
  const erBlock = draft.match(/```mermaid\s*([\s\S]*?)```/i)?.[1] ?? "";
  const unreferenced = orphans.filter((t) => {
    const inEr = new RegExp(`\\b${t}\\b`, "i").test(erBlock);
    const fkRef = new RegExp(`references\\s+${t}\\b`, "i").test(sql);
    return !inEr && !fkRef;
  });
  return unreferenced.map((t) => `Tabla huérfana en §3: \`${t}\` (sin columnas de negocio ni relaciones útiles).`);
}

/** Manifest JSON en §7 truncado o inválido. */
export function detectInvalidInfraManifest(draft: string): string | null {
  const section7 = extractSection(
    draft,
    /^#+\s*(?:7\.\s*)?(?:infraestructura|infra|integraci[oó]n)/im,
  );
  if (!section7 || section7.length < 80) return null;
  const jsonMatch = section7.match(/```json\s*\n([\s\S]*?)```/);
  if (!jsonMatch?.[1]) {
    if (/manifest\s+de\s+infraestructura/i.test(section7) && /"stack"\s*:/i.test(section7)) {
      return "§7: Manifest de Infraestructura presente pero sin bloque ```json válido.";
    }
    return null;
  }
  try {
    const obj = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    const stack = obj.stack;
    if (stack == null || (typeof stack === "object" && Object.keys(stack as object).length === 0)) {
      return "§7: Manifest JSON sin objeto `stack` definido.";
    }
    const security = (stack as Record<string, unknown>)?.security ?? obj.security;
    if (security && typeof security === "object" && "hashing_algorithm" in (security as object)) {
      return null;
    }
    if (/hashing_algorithm|Argon2/i.test(section7) && !/"hashing_algorithm"/i.test(jsonMatch[1])) {
      return "§7: Manifest JSON truncado (falta security.hashing_algorithm u otros campos).";
    }
  } catch {
    return "§7: Manifest de Infraestructura con JSON inválido o truncado.";
  }
  return null;
}

/** Placeholders tipo `--- ---` en §1. */
export function detectPlaceholderNoise(draft: string): string | null {
  const section1 = extractSection(
    draft,
    /^#+\s*(?:1\.\s*)?(?:contexto\s+y\s+alcance|contexto\b)/im,
  );
  if (!section1) return null;
  if (PLACEHOLDER_NOISE_RE.test(section1)) {
    return "§1 Contexto: línea placeholder con guiones repetidos (---); completar objetivos comerciales.";
  }
  if (/^#+\s*[^\n]*\s+---\s+---/m.test(section1)) {
    return "§1 Contexto: heading con separadores --- sin contenido sustancial.";
  }
  if (/(?:^|\n)[^\n]*---\s+---\s+---/m.test(section1)) {
    return "§1 Contexto: placeholder con guiones repetidos (---); completar contenido.";
  }
  return null;
}

/** Envuelve bloques mermaid sueltos en fences. */
export function fixBareMermaidFences(draft: string): string {
  let out = draft ?? "";
  out = out.replace(
    /(?:^|\n)(mermaid)\s*\n((?:flowchart|sequenceDiagram|erDiagram|graph\s)[\s\S]*?)(?=\n```|\n##\s|\n---\s*\n|$)/gim,
    (_full, _kw, body) => `\n\`\`\`mermaid\n${String(body).trim()}\n\`\`\``,
  );
  out = out.replace(
    /(?:^|\n)((?:flowchart|sequenceDiagram)\s[\s\S]*?)(?=\n```|\n##\s|\n---\s*\n|$)/gim,
    (match, body, offset: number) => {
      const before = out.slice(0, offset).trimEnd();
      if (/```\s*mermaid\s*$/i.test(before.split("\n").pop() ?? "")) return match;
      return `\n\`\`\`mermaid\n${String(body).trim()}\n\`\`\``;
    },
  );
  return out;
}

/** Agrega issues de calidad MDD para validateMddStructure / delivery gate. */
export function collectMddQualityIssues(draft: string): string[] {
  const issues: string[] = [];
  const jsonIssue = detectUnbalancedJsonFences(draft);
  if (jsonIssue) issues.push(jsonIssue);
  issues.push(...detectBareMermaidBlocks(draft));
  issues.push(...detectOrphanSqlTables(draft));
  const manifestIssue = detectInvalidInfraManifest(draft);
  if (manifestIssue) issues.push(manifestIssue);
  const placeholderIssue = detectPlaceholderNoise(draft);
  if (placeholderIssue) issues.push(placeholderIssue);
  return issues;
}

export type InfraManifestRequirement = {
  hashingAlgorithm?: string;
  rateLimitEndpoints?: string[];
  dlqRequired?: boolean;
  celeryHealthPath?: string;
  staticDeploy?: "cloudfront_s3" | "nginx_container";
};

/** Extrae requisitos del manifest / prosa §7 para conformance Infra. */
export function extractMddInfraRequirements(mddContent: string): InfraManifestRequirement {
  const section7 = extractSection(
    mddContent,
    /^#+\s*(?:7\.\s*)?(?:infraestructura|infra|integraci[oó]n)/im,
  );
  const req: InfraManifestRequirement = {};
  if (!section7) return req;

  const jsonMatch = section7.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      const obj = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      const stack = (obj.stack ?? {}) as Record<string, unknown>;
      const security = (stack.security ?? obj.security) as Record<string, unknown> | undefined;
      if (typeof security?.hashing_algorithm === "string") {
        req.hashingAlgorithm = security.hashing_algorithm;
      }
    } catch {
      // prose fallback below
    }
  }

  if (/Argon2id/i.test(section7)) req.hashingAlgorithm = "Argon2id";
  if (/dead[- ]?letter|DLQ/i.test(section7)) req.dlqRequired = true;
  if (/\/health.*Celery|Celery.*\/health/i.test(section7)) req.celeryHealthPath = "/health";
  if (/CloudFront|S3.*origen/i.test(section7)) req.staticDeploy = "cloudfront_s3";
  if (/nginx.*contenedor|nginx.*frontend/i.test(section7) && !req.staticDeploy) {
    req.staticDeploy = "nginx_container";
  }

  const rateLimits: string[] = [];
  if (/POST\s+\/api\/v1\/auth\/token.*\d+\s*req/i.test(section7)) rateLimits.push("POST /api/v1/auth/token");
  if (/POST\s+\/api\/v1\/auth\/refresh.*\d+\s*req/i.test(section7)) rateLimits.push("POST /api/v1/auth/refresh");
  if (rateLimits.length > 0) req.rateLimitEndpoints = rateLimits;

  return req;
}

/** Gaps Infra vs manifest §7 (determinista). */
export function checkInfraManifestConformance(
  mddContent: string,
  infraContent: string,
): string[] {
  const gaps: string[] = [];
  const req = extractMddInfraRequirements(mddContent);
  const infraLower = (infraContent ?? "").trim().toLowerCase();
  if (!infraLower || infraLower.length < 80) return gaps;

  if (req.hashingAlgorithm && !infraLower.includes(req.hashingAlgorithm.toLowerCase())) {
    gaps.push(
      `MDD §7 exige hashing ${req.hashingAlgorithm}; no aparece en el doc de Infra`,
    );
  }
  if (req.dlqRequired && !/\b(dlq|dead[- ]?letter)\b/i.test(infraLower)) {
    gaps.push("MDD §7 exige Dead Letter Queue (DLQ) para Celery; no aparece en Infra");
  }
  if (req.celeryHealthPath && !/\/health\b/i.test(infraContent)) {
    gaps.push("MDD §7 exige healthcheck HTTP /health en worker Celery; no documentado en Infra");
  }
  if (req.rateLimitEndpoints?.length) {
    for (const ep of req.rateLimitEndpoints) {
      const slug = ep.replace(/\s+/g, " ").toLowerCase();
      if (!infraLower.includes(slug.split(" ").pop() ?? "") && !/rate\s*limit/i.test(infraLower)) {
        gaps.push(`MDD §7 exige rate limiting en ${ep}; no reflejado en Infra`);
        break;
      }
    }
  }
  if (req.staticDeploy === "cloudfront_s3" && /\bnginx\b/i.test(infraLower) && !/cloudfront|s3/i.test(infraLower)) {
    gaps.push("MDD §7 especifica CloudFront+S3 para frontend; Infra documenta nginx en contenedor");
  }

  return gaps;
}

/** Alias semánticos de rutas API (warning, no missing). */
export const API_PATH_SEMANTIC_ALIASES: Array<{ mdd: RegExp; api: RegExp; label: string }> = [
  {
    mdd: /POST\s+\/api\/v1\/auth\/token/i,
    api: /POST\s+\/api\/v1\/auth\/login/i,
    label: "auth/token ↔ auth/login",
  },
  {
    mdd: /GET\s+\/api\/v1\/audit-logs/i,
    api: /GET\s+\/api\/v1\/audit-trail/i,
    label: "audit-logs ↔ audit-trail",
  },
  {
    mdd: /POST\s+\/api\/v1\/webhook\/whatsapp/i,
    api: /POST\s+\/api\/v1\/whatsapp\/webhook/i,
    label: "webhook/whatsapp ↔ whatsapp/webhook",
  },
];

export function findApiSemanticAliasWarnings(
  mddContent: string,
  apiContent: string,
): string[] {
  const warnings: string[] = [];
  for (const alias of API_PATH_SEMANTIC_ALIASES) {
    if (alias.mdd.test(mddContent) && alias.api.test(apiContent)) {
      warnings.push(`Alias de ruta detectado (${alias.label}); alinear API Contracts con MDD §4 canónico.`);
    }
  }
  return warnings;
}

export type ConformanceSummary = {
  ok: boolean;
  api: { ok: boolean; missingCount: number; extraCount: number; aliasWarnings: string[] };
  infra: { ok: boolean; gapCount: number; gaps: string[] };
  blueprint: { ok: boolean };
  logicFlows: { ok: boolean };
};
