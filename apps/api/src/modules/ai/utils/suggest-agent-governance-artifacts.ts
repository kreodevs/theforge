import type { ComplexityLevel } from "@theforge/shared-types";
import { selectedPatternIdsFromMdd } from "@theforge/shared-types/mdd-governance-patterns";
import {
  complexityAtLeast,
  GOVERNANCE_ARCHETYPES,
  RULE_CATALOG,
  SKILL_CATALOG,
  type GovernanceArtifactStrength,
  type RuleCatalogEntry,
  type SkillCatalogEntry,
  type ArtifactTemplateContext,
} from "./agent-governance-catalog.js";

export interface RuleSpec {
  id: string;
  path: string;
  purpose: string;
  strength: GovernanceArtifactStrength;
}

export interface SkillSpec {
  id: string;
  path: string;
  folder: string;
  purpose: string;
  strength: GovernanceArtifactStrength;
}

export interface AgentGovernanceSuggestions {
  archetypes: string[];
  suggestedRules: RuleSpec[];
  suggestedSkills: SkillSpec[];
  rationale: string[];
}

export interface SuggestAgentGovernanceInput {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  tasksMarkdown?: string | null;
  architectureMarkdown?: string | null;
  specMarkdown?: string | null;
  complexity: ComplexityLevel;
}

export interface ProjectGovernanceFacts {
  backendStack?: string;
  frontendStack?: string;
  mobileStack?: string;
  infraStack?: string;
  docPaths: string[];
  taskHeadings: string[];
  architectureLayers: string[];
  blueprintModules: string[];
}

function corpus(input: SuggestAgentGovernanceInput): string {
  return [
    input.mddMarkdown,
    input.blueprintMarkdown ?? "",
    input.tasksMarkdown ?? "",
    input.architectureMarkdown ?? "",
    input.specMarkdown ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function matchesSignals(text: string, signals: RegExp[]): boolean {
  return signals.some((re) => re.test(text));
}

function detectArchetypes(text: string, complexity: ComplexityLevel): string[] {
  const found = new Set<string>();

  const hasBackend =
    /nestjs|express|fastify|fastapi|django|laravel|spring|hono|cloudflare\s+workers?|workers?\s+api/i.test(
      text,
    );
  const hasFrontend = /react|vue|svelte|angular|next\.js/i.test(text);
  const hasMobile = /expo|react\s*native|react-native/i.test(text);
  const isMonorepo = /monorepo|lerna|pnpm\s+workspace|turborepo|packages\//i.test(text);

  if (hasBackend && (hasFrontend || hasMobile) && isMonorepo) found.add("nestjs-react-monorepo");
  if (hasBackend && !hasFrontend && !hasMobile) found.add("api-only");
  if ((hasFrontend || hasMobile) && !hasBackend) found.add("spa-only");
  if (/design\s+system|paquete\s+ui|@\w+\/ui\b|storybook/i.test(text)) {
    found.add("design-system-ui");
  }
  if (/ariadne|falkor|legacy|código\s+existente|strangler/i.test(text)) {
    found.add("legacy-ariadne");
  }
  if (/\bjwt\b|oauth|§\s*6|autenticaci[oó]n/i.test(text)) found.add("auth-jwt");
  if (/docker|dokploy|kubernetes|\bk8s\b|§\s*7|serverless|cloudflare/i.test(text)) {
    found.add("docker-dokploy");
  }
  if (/\bmcp\b|model\s+context\s+protocol|figma\s+mcp/i.test(text)) found.add("mcp-enabled");

  if (complexity === "LOW" && found.size === 0) {
    if (hasBackend || hasFrontend || hasMobile) {
      found.add(
        hasBackend && (hasFrontend || hasMobile)
          ? "nestjs-react-monorepo"
          : hasBackend
            ? "api-only"
            : "spa-only",
      );
    }
  }

  return [...found].filter((a) =>
    (GOVERNANCE_ARCHETYPES as readonly string[]).includes(a),
  );
}

function firstMatchLabel(text: string, patterns: Array<[RegExp, string]>): string | undefined {
  for (const [re, label] of patterns) {
    if (re.test(text)) return label;
  }
  return undefined;
}

export function inferStacks(text: string): {
  backend?: string;
  frontend?: string;
  mobile?: string;
  infra?: string;
} {
  const backend = firstMatchLabel(text, [
    [/fastapi/i, "FastAPI"],
    [/nestjs/i, "NestJS"],
    [/cloudflare\s+workers?|workers?\s+api/i, "Cloudflare Workers"],
    [/\bhono\b/i, "Hono"],
    [/express/i, "Express"],
    [/fastify/i, "Fastify"],
    [/django/i, "Django"],
    [/laravel/i, "Laravel"],
    [/spring\s*boot/i, "Spring Boot"],
    [/go\s*\/\s*gin|\bgin\b.*go/i, "Go (Gin)"],
    [/supabase\s+edge/i, "Supabase Edge Functions"],
  ]);

  const mobile = firstMatchLabel(text, [
    [/react\s*native|react-native/i, "React Native"],
    [/\bexpo\b/i, "Expo"],
    [/flutter/i, "Flutter"],
  ]);

  const frontend = mobile
    ? undefined
    : firstMatchLabel(text, [
        [/next\.js/i, "Next.js"],
        [/react/i, "React"],
        [/\bvue\b/i, "Vue"],
        [/svelte/i, "Svelte"],
        [/angular/i, "Angular"],
      ]);

  const infra = firstMatchLabel(text, [
    [/serverless/i, "Serverless"],
    [/cloudflare/i, "Cloudflare"],
    [/dokploy/i, "Dokploy"],
    [/kubernetes|\bk8s\b/i, "Kubernetes"],
    [/docker/i, "Docker"],
  ]);

  const backendMatch = text.match(
    /(?:backend|servidor|api)[:\s]+([A-Za-z][A-Za-z0-9.\s/]{1,48})/i,
  );
  const frontendMatch = text.match(
    /(?:frontend|cliente|ui|mobile)[:\s]+([A-Za-z][A-Za-z0-9.\s/]{1,48})/i,
  );

  return {
    backend: backend ?? backendMatch?.[1]?.trim().split(/\s/)[0],
    frontend: frontend ?? frontendMatch?.[1]?.trim().split(/\s/)[0],
    mobile,
    infra,
  };
}

function inferDomainSkillFolder(text: string): string | undefined {
  const pkg = text.match(/packages\/([a-z0-9_-]+)/i)?.[1];
  if (pkg) return `${pkg}-package`;
  const scope = text.match(/@([\w-]+)\/([\w-]+)/)?.[2];
  if (scope) return `${scope}-package`;
  return undefined;
}

/** Extrae hechos estructurados del proyecto para inyectar en plantillas de gobernanza. */
export function extractProjectGovernanceFacts(
  input: SuggestAgentGovernanceInput,
): ProjectGovernanceFacts {
  const text = corpus(input);
  const stacks = inferStacks(text);

  const docPaths = [
    "docs/sdd/mdd.md",
    input.blueprintMarkdown?.trim() ? "docs/sdd/blueprint.md" : null,
    input.specMarkdown?.trim() ? "docs/sdd/spec.md" : null,
    input.architectureMarkdown?.trim() ? "docs/sdd/architecture.md" : null,
    input.tasksMarkdown?.trim() ? "docs/sdd/tasks.md" : null,
    "docs/agent-governance/COMO-USAR-GOBERNANZA-IA.md",
    "AGENTS.md",
  ].filter((p): p is string => !!p);

  const taskHeadings: string[] = [];
  const tasksText = input.tasksMarkdown ?? "";
  for (const line of tasksText.split("\n")) {
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h?.[1]) taskHeadings.push(h[1].trim().slice(0, 120));
    if (taskHeadings.length >= 12) break;
  }

  const architectureLayers: string[] = [];
  const archText = input.architectureMarkdown ?? "";
  for (const line of archText.split("\n")) {
    const h = line.match(/^#{2,3}\s+(.+)/);
    if (h?.[1]) architectureLayers.push(h[1].trim().slice(0, 100));
    if (architectureLayers.length >= 10) break;
  }

  const blueprintModules: string[] = [];
  const bpText = input.blueprintMarkdown ?? "";
  for (const line of bpText.split("\n")) {
    const bullet = line.match(/^[-*]\s+`?([^`\n]+)`?/);
    if (bullet?.[1] && /apps\/|packages\/|src\//i.test(bullet[1])) {
      blueprintModules.push(bullet[1].trim().slice(0, 80));
    }
    if (blueprintModules.length >= 8) break;
  }

  return {
    backendStack: stacks.backend,
    frontendStack: stacks.frontend,
    mobileStack: stacks.mobile,
    infraStack: stacks.infra,
    docPaths,
    taskHeadings,
    architectureLayers,
    blueprintModules,
  };
}

function wizardArchitectureActive(mdd: string): boolean {
  const ids = selectedPatternIdsFromMdd(mdd);
  const archIds = new Set([
    "hexagonal",
    "clean-architecture",
    "microservices",
    "monolith-modular",
    "cqrs",
    "event-driven",
    "soa",
    "serverless",
  ]);
  for (const id of ids) {
    if (archIds.has(id)) return true;
  }
  return false;
}

function ruleStrength(
  rule: RuleCatalogEntry,
  text: string,
  archetypes: string[],
  complexity: ComplexityLevel,
): GovernanceArtifactStrength | null {
  if (!complexityAtLeast(complexity, rule.minComplexity)) return null;

  if (rule.id === "git-commits") return "strong";
  if (rule.id === "orchestrator" && complexity !== "LOW") return "weak";

  const signalHit = matchesSignals(text, rule.signals);
  const archetypeHit = rule.archetypes?.some((a) => archetypes.includes(a)) ?? false;
  const wizardHit = rule.id === "architecture-patterns" && wizardArchitectureActive(text);

  if (!signalHit && !archetypeHit && !wizardHit) return null;

  if (rule.id === "git-commits" || rule.id === "stack-backend" || rule.id === "stack-frontend") {
    return signalHit || archetypeHit ? "strong" : "weak";
  }
  if (rule.id === "mcp-governance" && /ariadne|falkor/i.test(text)) return "strong";
  if (rule.id === "security-auth" && /\bjwt\b|oauth/i.test(text)) return "strong";
  if (wizardHit) return "strong";

  return signalHit && archetypeHit ? "strong" : signalHit || archetypeHit ? "weak" : null;
}

function skillStrength(
  skill: SkillCatalogEntry,
  text: string,
  archetypes: string[],
  complexity: ComplexityLevel,
): GovernanceArtifactStrength | null {
  if (!complexityAtLeast(complexity, skill.minComplexity)) return null;

  const signalHit = matchesSignals(text, skill.signals);
  const archetypeHit = skill.archetypes?.some((a) => archetypes.includes(a)) ?? false;

  if (skill.id === "domain-package" && complexity !== "LOW") {
    return complexity === "HIGH" || signalHit ? "strong" : "weak";
  }

  if (!signalHit && !archetypeHit) return null;

  if (skill.id === "mcp-ariadne" && /ariadne/i.test(text)) return "strong";
  if (skill.id === "design-system-ui" && archetypes.includes("design-system-ui")) return "strong";

  return signalHit && archetypeHit ? "strong" : "weak";
}

function capByComplexity(
  rules: RuleSpec[],
  skills: SkillSpec[],
  complexity: ComplexityLevel,
): { rules: RuleSpec[]; skills: SkillSpec[] } {
  if (complexity === "LOW") {
    const git = rules.find((r) => r.id === "git-commits");
    const stack = rules.find((r) => r.id === "stack-backend" || r.id === "stack-frontend");
    return {
      rules: [git, stack].filter((r): r is RuleSpec => !!r).slice(0, 2),
      skills: [],
    };
  }
  if (complexity === "MEDIUM") {
    return {
      rules: rules.slice(0, 5),
      skills: skills.slice(0, 2),
    };
  }
  return {
    rules: rules.slice(0, 8),
    skills: skills.slice(0, 5),
  };
}

function resolveSkillPath(skill: SkillCatalogEntry, folder?: string): string {
  if (skill.dynamicFolder && folder) {
    return `docs/agent-governance/skills/${folder}/SKILL.md`;
  }
  return skill.path;
}

/**
 * Detecta arquetipos y artefactos (rules/skills) sugeridos desde MDD, Blueprint, Tasks, Architecture y complejidad.
 */
export function suggestAgentGovernanceArtifacts(
  input: SuggestAgentGovernanceInput,
): AgentGovernanceSuggestions {
  const text = corpus(input);
  const archetypes = detectArchetypes(text, input.complexity);
  const rationale: string[] = [];
  const domainFolder = inferDomainSkillFolder(text);

  if (archetypes.length > 0) {
    rationale.push(`Arquetipos detectados: ${archetypes.join(", ")}.`);
  }

  const stacks = inferStacks(text);
  const stackParts = [stacks.backend, stacks.frontend, stacks.mobile, stacks.infra].filter(Boolean);
  if (stackParts.length > 0) {
    rationale.push(`Stack inferido: ${stackParts.join(", ")}.`);
  }

  const suggestedRules: RuleSpec[] = [];
  for (const rule of RULE_CATALOG) {
    const strength = ruleStrength(rule, text, archetypes, input.complexity);
    if (!strength) continue;
    suggestedRules.push({
      id: rule.id,
      path: rule.path,
      purpose: rule.description,
      strength,
    });
    rationale.push(
      `Rule \`${rule.id}\`: ${rule.description} (señal ${strength === "strong" ? "fuerte" : "moderada"}, min ${rule.minComplexity}).`,
    );
  }

  const suggestedSkills: SkillSpec[] = [];
  for (const skill of SKILL_CATALOG) {
    const strength = skillStrength(skill, text, archetypes, input.complexity);
    if (!strength) continue;
    const folder = skill.dynamicFolder && domainFolder ? domainFolder : skill.folder;
    const path = resolveSkillPath(skill, folder);
    suggestedSkills.push({
      id: skill.id,
      path,
      folder,
      purpose: skill.description,
      strength,
    });
    rationale.push(
      `Skill \`${skill.id}\`: ${skill.description} (señal ${strength === "strong" ? "fuerte" : "moderada"}).`,
    );
  }

  const capped = capByComplexity(suggestedRules, suggestedSkills, input.complexity);

  if (input.complexity === "LOW") {
    rationale.push("Complejidad LOW: máximo 2 rules, sin skills obligatorias.");
  } else if (input.complexity === "HIGH" && archetypes.includes("nestjs-react-monorepo")) {
    rationale.push("Complejidad HIGH + monorepo: considerar AGENTS.md anidados bajo packages/.");
  }

  if (input.tasksMarkdown?.trim()) {
    rationale.push("Tasks disponibles: PROMPT-INICIAL y PROGRESO derivados del checklist.");
  }

  return {
    archetypes,
    suggestedRules: capped.rules,
    suggestedSkills: capped.skills,
    rationale,
  };
}

/** Bloque para inyectar en el user prompt del LLM. */
export function formatSuggestedArtifactsPromptBlock(
  suggestions: AgentGovernanceSuggestions,
): string {
  const lines = [
    "## ARTEFACTOS SUGERIDOS (detector TheForge — obligatorio)",
    "",
    "Genera **exactamente** estos artefactos del catálogo (paths y propósito). " +
      "Puedes enriquecer el contenido con datos del MDD/Blueprint/Tasks/Architecture; **no** inventes otros skills " +
      "salvo **1** skill de dominio nombrada explícitamente en §1.",
    "",
  ];

  if (suggestions.archetypes.length > 0) {
    lines.push(`**Arquetipos:** ${suggestions.archetypes.join(", ")}`, "");
  }

  if (suggestions.suggestedRules.length > 0) {
    lines.push("### Rules a generar", "");
    for (const r of suggestions.suggestedRules) {
      lines.push(`- \`${r.path}\` — ${r.purpose} (señal: ${r.strength})`);
    }
    lines.push("");
  }

  if (suggestions.suggestedSkills.length > 0) {
    lines.push("### Skills a generar", "");
    for (const s of suggestions.suggestedSkills) {
      lines.push(`- \`${s.path}\` — ${s.purpose} (señal: ${s.strength})`);
    }
    lines.push("");
  }

  if (suggestions.rationale.length > 0) {
    lines.push("### Rationale (incluir resumen en COMO-USAR § tabla)", "");
    for (const r of suggestions.rationale.slice(0, 12)) {
      lines.push(`- ${r}`);
    }
  }

  return lines.join("\n");
}

export function buildArtifactTemplateContext(
  suggestions: AgentGovernanceSuggestions,
  complexity: ComplexityLevel,
  input: SuggestAgentGovernanceInput,
): ArtifactTemplateContext {
  const text = corpus(input);
  const stacks = inferStacks(text);
  const facts = extractProjectGovernanceFacts(input);
  return {
    complexity,
    archetypes: suggestions.archetypes,
    domainSkillFolder: inferDomainSkillFolder(text),
    backendStack: stacks.backend,
    frontendStack: stacks.frontend ?? stacks.mobile,
    mobileStack: stacks.mobile,
    infraStack: stacks.infra,
    projectFacts: facts,
  };
}
