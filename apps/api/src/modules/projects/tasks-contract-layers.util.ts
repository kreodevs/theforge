/**
 * Extracción determinista de contratos livianos por capa (Paso 1 del algoritmo Tasks).
 * Transforma documentos SDD completos en índices densos — sin dump masivo al LLM.
 */

import type {
  TasksBusinessRule,
  TasksContractManifest,
  TasksEndpointContract,
  TasksGlossaryEntry,
  TasksLayerContract,
  TasksScreenContract,
  TasksTechStackContract,
  TasksUserStoryContract,
} from "@theforge/shared-types";
import { extractEntities } from "../engine/conformance.service.js";
import { extractSectionByNumber } from "../engine/mdd-markdown-parser.js";
import {
  extractHttpEndpointsFromMarkdown,
  matchEndpointsForEntity,
} from "../ui-mcp/api-contract-endpoints.util.js";
import {
  parseUserStoriesMarkdown,
  type ParsedUserStory,
} from "../ui-mcp/ui-screens-plan.util.js";
import { extractPantallaPlanMetaFromMarkdown } from "../ui-mcp/ui-screens-v1-scope.util.js";

export type TasksContractExtractionInput = {
  mddMarkdown: string;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  specMarkdown?: string | null;
  blueprintMarkdown?: string | null;
  architectureMarkdown?: string | null;
  agentGovernanceMarkdown?: string | null;
  infraMarkdown?: string | null;
  userStoriesMarkdown?: string | null;
  useCasesMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  logicFlowsMarkdown?: string | null;
  uxUiGuideMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  aemMarkdown?: string | null;
  integrationMarkdown?: string | null;
};

const NOISE_PATTERNS = [
  /\bROI\b/i,
  /\bTAM\b|\bSAM\b|\bSOM\b/i,
  /\banálisis de mercado\b/i,
  /\bmarket analysis\b/i,
  /\bjustificación de mercado\b/i,
  /\bcontexto histórico\b/i,
  /\balternativa descartada\b/i,
  /\brejected alternative\b/i,
];

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) return true;
  return NOISE_PATTERNS.some((p) => p.test(t));
}

function extractBulletLines(body: string, max = 40): string[] {
  const lines: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line)) continue;
    const text = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
    if (text.length < 6 || isNoiseLine(text)) continue;
    lines.push(text);
    if (lines.length >= max) break;
  }
  return lines;
}

function extractGlossaryFromMdd(mdd: string): TasksGlossaryEntry[] {
  const s1 = extractSectionByNumber(mdd, 1);
  const glossMatch = s1.match(
    /###\s*(?:glosario\s+de\s+dominio|lenguaje\s+ubicuo|ubiquitous\s+language)[^\n]*\n([\s\S]*?)(?=^###\s|^##\s*\d+\.|\z)/im,
  );
  const body = (glossMatch?.[1] ?? s1).trim();
  const entries: TasksGlossaryEntry[] = [];

  for (const line of body.split("\n")) {
    const bold = line.match(/^[-*]?\s*\*\*([^*]+)\*\*[:\s—-]+(.+)?$/);
    if (bold) {
      entries.push({ term: bold[1]!.trim(), definition: bold[2]?.trim() });
      continue;
    }
    const table = line.match(/^\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (table && !/^[-:]/.test(table[1]!)) {
      entries.push({ term: table[1]!.trim(), definition: table[2]?.trim() });
    }
  }

  if (entries.length === 0) {
    for (const entity of extractEntities(extractSectionByNumber(mdd, 3) || mdd)) {
      entries.push({ term: entity });
    }
  }
  return entries.slice(0, 48);
}

function extractBusinessRules(input: TasksContractExtractionInput): TasksBusinessRule[] {
  const rules: TasksBusinessRule[] = [];
  const mdd = input.mddMarkdown.trim();

  const blockMatch = extractSectionByNumber(mdd, 1).match(
    /###\s*bloqueantes?\s+de\s+negocio[^\n]*\n([\s\S]*?)(?=^###\s|^##\s*2\.|\z)/im,
  );
  for (const line of extractBulletLines(blockMatch?.[1] ?? "", 20)) {
    rules.push({ rule: line, source: "MDD §1" });
  }

  for (const line of extractBulletLines(extractSectionByNumber(mdd, 5), 24)) {
    if (
      /^(dado|cuando|entonces|given|when|then)\b/i.test(line) ||
      /\b(debe|must|shall|expira|requiere|validar|obligatorio|mínimo|máximo)\b/i.test(line)
    ) {
      rules.push({ rule: line, source: "MDD §5" });
    }
  }

  for (const line of extractBulletLines(extractSectionByNumber(mdd, 1), 16)) {
    if (/\b(debe|expira|requiere|validar|obligatorio|invariante)\b/i.test(line)) {
      rules.push({ rule: line, source: "MDD §1" });
    }
  }

  const spec = (input.specMarkdown ?? "").trim();
  if (spec) {
    const invariantSection = spec.match(
      /##\s*(?:reglas|invariantes|business rules)[^\n]*\n([\s\S]*?)(?=^##\s|\z)/im,
    );
    for (const line of extractBulletLines(invariantSection?.[1] ?? spec.slice(0, 4_000), 16)) {
      rules.push({ rule: line, source: "Spec" });
    }
  }

  const brd = (input.brdMarkdown ?? "").trim();
  if (brd) {
    const brdRules = brd.match(
      /##\s*(?:reglas|políticas|UAT)[^\n]*\n([\s\S]*?)(?=^##\s|\z)/im,
    );
    for (const line of extractBulletLines(brdRules?.[1] ?? "", 12)) {
      rules.push({ rule: line, source: "BRD" });
    }
  }

  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = r.rule.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return !isNoiseLine(r.rule);
  });
}

function extractTechStack(input: TasksContractExtractionInput): TasksTechStackContract {
  const mddS2 = extractSectionByNumber(input.mddMarkdown, 2);
  const blueprint = (input.blueprintMarkdown ?? "").trim();
  const architecture = (input.architectureMarkdown ?? "").trim();
  const corpus = `${mddS2}\n${blueprint.slice(0, 8_000)}\n${architecture.slice(0, 6_000)}`;

  const frameworkMatch = corpus.match(
    /\*\*(?:Frontend|Backend|Stack|Framework)[^*]*\*\*[:\s]*([^\n]+)/i,
  );
  const framework =
    frameworkMatch?.[1]?.trim() ||
    (/nestjs/i.test(corpus) && /react/i.test(corpus) ? "NestJS / React" : undefined);

  const patterns: string[] = [];
  if (/clean architecture|arquitectura limpia/i.test(corpus)) patterns.push("Clean Architecture");
  if (/\bSDD\b|spec-driven/i.test(corpus)) patterns.push("SDD");
  if (/DDD|domain-driven/i.test(corpus)) patterns.push("DDD");
  if (/hexagonal|ports and adapters/i.test(corpus)) patterns.push("Hexagonal");

  const conventions = extractBulletLines(
    blueprint.match(/##\s*(?:convenciones|conventions|estructura)[^\n]*\n([\s\S]*?)(?=^##\s|\z)/im)?.[1] ??
      architecture.slice(0, 3_000),
    12,
  );

  const boundaries: string[] = [];
  const scopeMatch = mddS2.match(
    /(?:boundaries|límites|alcance)[^\n]*\n([\s\S]*?)(?=^###\s|^##\s|\z)/im,
  );
  for (const line of extractBulletLines(scopeMatch?.[1] ?? "", 8)) {
    boundaries.push(line);
  }

  return { framework, patterns, conventions, boundaries };
}

function extractAcceptanceCriteria(storyChunk: string): string[] {
  const acMatch = storyChunk.match(
    /\*\*(?:Criterios de aceptación|Acceptance Criteria)\*\*[:\s]*\n([\s\S]*?)(?=^#{2,3}\s|\*\*[A-Z]|\z)/im,
  );
  if (acMatch) return extractBulletLines(acMatch[1]!, 12);
  return extractBulletLines(storyChunk, 6).filter((l) => /debe|must|shall|validar|expira|requiere/i.test(l));
}

function parseUserStoryContracts(userStoriesMarkdown: string): TasksUserStoryContract[] {
  const text = (userStoriesMarkdown ?? "").trim();
  if (!text) return [];

  const headerRe = /^#{2,3}\s+(?:Historia\s+de\s+usuario|HU)\s*:/gim;
  const headers: { index: number; line: string }[] = [];
  for (const match of text.matchAll(headerRe)) {
    if (match.index == null) continue;
    const lineEnd = text.indexOf("\n", match.index);
    headers.push({ index: match.index, line: text.slice(match.index, lineEnd === -1 ? undefined : lineEnd) });
  }

  const stories: TasksUserStoryContract[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    const parsed = parseUserStoriesMarkdown(chunk);
    const story: ParsedUserStory | undefined = parsed[0];
    if (!story?.id) continue;
    stories.push({
      id: story.id,
      title: story.title,
      role: story.role,
      want: story.want,
      acceptanceCriteria: extractAcceptanceCriteria(chunk),
    });
  }
  return stories;
}

function extractScreenContracts(uiScreensMarkdown: string): TasksScreenContract[] {
  const meta = extractPantallaPlanMetaFromMarkdown(uiScreensMarkdown);
  const screens: TasksScreenContract[] = [];
  for (const row of meta) {
    if (!row.v1InScope || !row.route) continue;
    const states = ["loading", "error", "empty", "success"];
    screens.push({
      route: row.route,
      name: row.screenName,
      userStoryId: row.userStoryId,
      components: row.screenName ? [row.screenName] : [],
      states,
      primaryApi: row.primaryApi,
    });
  }
  return screens;
}

function extractEndpointContracts(apiMarkdown: string): TasksEndpointContract[] {
  const text = (apiMarkdown ?? "").trim();
  if (!text) return [];
  const endpoints = extractHttpEndpointsFromMarkdown(text);
  return endpoints.map((ep) => {
    const section = text.split("\n").find((l) => l.includes(ep.path) && l.includes(ep.method));
    const dtoHints: string[] = [];
    const dtoMatch = text.match(
      new RegExp(`${ep.method}\\s+${ep.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]{0,800}`, "i"),
    );
    if (dtoMatch) {
      for (const m of dtoMatch[0].matchAll(/`([A-Za-z][A-Za-z0-9]*Dto)`/g)) {
        if (m[1]) dtoHints.push(m[1]);
      }
    }
    return {
      method: ep.method,
      path: ep.path,
      summary: section?.slice(0, 120),
      dtoHints: [...new Set(dtoHints)],
    };
  });
}

function extractExternalServices(input: TasksContractExtractionInput): string[] {
  const corpus = [
    input.integrationMarkdown,
    input.aemMarkdown,
    input.mddMarkdown,
    input.specMarkdown,
  ]
    .filter(Boolean)
    .join("\n");
  const services = new Set<string>();
  for (const m of corpus.matchAll(/\b(?:integraci[oó]n|integration|servicio externo|third[- ]party)\s*[:\-—]\s*([^\n]+)/gi)) {
    services.add(m[1]!.trim().slice(0, 80));
  }
  for (const m of corpus.matchAll(/\b(Stripe|SendGrid|Twilio|WhatsApp|Banxico|Polygon|OpenRouter|S3|Redis|RabbitMQ)\b/gi)) {
    services.add(m[1]!);
  }
  return [...services].slice(0, 24);
}

function extractInfraServices(infraMarkdown: string, mddMarkdown: string): string[] {
  const corpus = `${infraMarkdown}\n${extractSectionByNumber(mddMarkdown, 7)}`;
  const services = new Set<string>();
  for (const label of ["Docker", "Dokploy", "PostgreSQL", "Redis", "Nginx", "Traefik", "CI/CD", "Sentry"]) {
    if (new RegExp(label, "i").test(corpus)) services.add(label);
  }
  return [...services];
}

function extractDesignSystemComponents(uxMarkdown: string): string[] {
  const text = (uxMarkdown ?? "").trim();
  if (!text) return [];
  const components: string[] = [];
  for (const m of text.matchAll(/`([A-Z][A-Za-z0-9]+(?:Form|Table|Modal|Layout|Panel|Chart|Wizard)?)`/g)) {
    if (m[1]) components.push(m[1]);
  }
  for (const m of text.matchAll(/\|\s*`?([A-Z][A-Za-z0-9]+)`?\s*\|/g)) {
    if (m[1] && !/Componente|Nombre|Token/i.test(m[1])) components.push(m[1]);
  }
  return [...new Set(components)].slice(0, 40);
}

/** Paso 1: extrae manifiesto de contratos por las 4 capas de abstracción. */
export function extractTasksContractManifest(
  input: TasksContractExtractionInput,
): TasksContractManifest {
  const userStories = parseUserStoryContracts(input.userStoriesMarkdown ?? "");
  const screens = extractScreenContracts(input.uiScreensMarkdown ?? "");
  const endpoints = extractEndpointContracts(input.apiContractsMarkdown ?? "");
  const designComponents = extractDesignSystemComponents(input.uxUiGuideMarkdown ?? "");

  for (const screen of screens) {
    screen.components = [...new Set([...screen.components, ...designComponents.slice(0, 8)])];
  }

  const domainLayer: TasksLayerContract = {
    layer: "domain",
    glossary: extractGlossaryFromMdd(input.mddMarkdown),
    businessRules: extractBusinessRules(input),
    userStories,
    screens: [],
    endpoints: [],
    externalServices: [],
    infraServices: [],
  };

  const architectureLayer: TasksLayerContract = {
    layer: "architecture",
    glossary: [],
    businessRules: [],
    techStack: extractTechStack(input),
    userStories: [],
    screens: [],
    endpoints: [],
    externalServices: [],
    infraServices: extractInfraServices(input.infraMarkdown ?? "", input.mddMarkdown),
  };

  const experienceLayer: TasksLayerContract = {
    layer: "experience",
    glossary: [],
    businessRules: [],
    userStories,
    screens,
    endpoints: [],
    externalServices: [],
    infraServices: [],
  };

  const integrationLayer: TasksLayerContract = {
    layer: "integration",
    glossary: [],
    businessRules: [],
    userStories: [],
    screens: [],
    endpoints,
    externalServices: extractExternalServices(input),
    infraServices: [],
  };

  return {
    version: 1,
    layers: [domainLayer, architectureLayer, experienceLayer, integrationLayer],
    extractedAt: new Date().toISOString(),
  };
}

/** Serializa el manifiesto como JSON compacto para system/context prompt. */
export function serializeTasksContractManifest(manifest: TasksContractManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/** Endpoints asociados heurísticamente a una HU (pantalla + texto). */
export function matchEndpointsForStory(
  story: TasksUserStoryContract,
  screens: TasksScreenContract[],
  endpoints: TasksEndpointContract[],
): TasksEndpointContract[] {
  const storyScreens = screens.filter((s) => s.userStoryId === story.id);
  const matched = new Set<string>();
  const out: TasksEndpointContract[] = [];

  for (const screen of storyScreens) {
    if (screen.primaryApi) {
      const [method, ...pathParts] = screen.primaryApi.split(/\s+/);
      const path = pathParts.join(" ");
      const key = `${method} ${path}`;
      if (!matched.has(key)) {
        matched.add(key);
        out.push({ method: method ?? "GET", path, dtoHints: [] });
      }
    }
    for (const ep of endpoints) {
      if (screen.route && ep.path.includes(screen.route.replace(/^\//, "").split("/")[0] ?? "")) {
        const key = `${ep.method} ${ep.path}`;
        if (!matched.has(key)) {
          matched.add(key);
          out.push(ep);
        }
      }
    }
  }

  const haystack = `${story.title} ${story.want ?? ""}`.toLowerCase();
  for (const ep of endpoints) {
    const slug = ep.path.split("/").filter(Boolean).pop() ?? "";
    if (slug.length >= 3 && haystack.includes(slug.replace(/-/g, " "))) {
      const key = `${ep.method} ${ep.path}`;
      if (!matched.has(key)) {
        matched.add(key);
        out.push(ep);
      }
    }
  }

  for (const ep of matchEndpointsForEntity(story.id.replace(/^US-/, ""), endpoints.map((e) => ({ method: e.method, path: e.path })))) {
    const key = `${ep.method} ${ep.path}`;
    if (!matched.has(key)) {
      matched.add(key);
      out.push({ method: ep.method, path: ep.path, dtoHints: [] });
    }
  }

  return out;
}

/** Reglas de negocio relevantes para una HU (matching por términos del glosario). */
export function matchBusinessRulesForStory(
  story: TasksUserStoryContract,
  rules: TasksBusinessRule[],
  glossary: TasksGlossaryEntry[],
): string[] {
  const matched: string[] = [];

  for (const ac of story.acceptanceCriteria) {
    if (ac.trim()) matched.push(ac.trim());
  }

  const haystack = `${story.title} ${story.want ?? ""} ${story.id}`.toLowerCase();
  for (const rule of rules) {
    if (matched.length >= 8) break;
    const ruleLower = rule.rule.toLowerCase();
    if (haystack.split(/\s+/).some((w) => w.length > 4 && ruleLower.includes(w))) {
      matched.push(rule.rule);
    }
  }

  for (const term of glossary) {
    if (matched.length >= 8) break;
    if (term.term.length >= 4 && haystack.includes(term.term.toLowerCase())) {
      for (const rule of rules) {
        if (rule.rule.toLowerCase().includes(term.term.toLowerCase()) && !matched.includes(rule.rule)) {
          matched.push(rule.rule);
        }
      }
    }
  }

  return matched.slice(0, 8);
}
