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
  complexity: ComplexityLevel;
}

function corpus(input: SuggestAgentGovernanceInput): string {
  return [input.mddMarkdown, input.blueprintMarkdown ?? ""].filter(Boolean).join("\n\n");
}

function matchesSignals(text: string, signals: RegExp[]): boolean {
  return signals.some((re) => re.test(text));
}

function detectArchetypes(text: string, complexity: ComplexityLevel): string[] {
  const found = new Set<string>();

  const hasBackend = /nestjs|express|fastify|django|laravel|spring/i.test(text);
  const hasFrontend = /react|vue|svelte|angular|next\.js/i.test(text);
  const isMonorepo = /monorepo|lerna|pnpm\s+workspace|turborepo|packages\//i.test(text);

  if (hasBackend && hasFrontend && isMonorepo) found.add("nestjs-react-monorepo");
  if (hasBackend && !hasFrontend) found.add("api-only");
  if (hasFrontend && !hasBackend) found.add("spa-only");
  if (/design\s+system|paquete\s+ui|@\w+\/ui\b|storybook/i.test(text)) {
    found.add("design-system-ui");
  }
  if (/ariadne|falkor|legacy|código\s+existente|strangler/i.test(text)) {
    found.add("legacy-ariadne");
  }
  if (/\bjwt\b|oauth|§\s*6|autenticaci[oó]n/i.test(text)) found.add("auth-jwt");
  if (/docker|dokploy|kubernetes|\bk8s\b|§\s*7/i.test(text)) found.add("docker-dokploy");
  if (/\bmcp\b|model\s+context\s+protocol|figma\s+mcp/i.test(text)) found.add("mcp-enabled");

  if (complexity === "LOW" && found.size === 0) {
    if (hasBackend || hasFrontend) found.add(hasBackend && hasFrontend ? "nestjs-react-monorepo" : hasBackend ? "api-only" : "spa-only");
  }

  return [...found].filter((a) =>
    (GOVERNANCE_ARCHETYPES as readonly string[]).includes(a),
  );
}

function inferStacks(text: string): { backend?: string; frontend?: string } {
  const backendMatch = text.match(
    /(?:backend|servidor|api)[:\s]+([A-Za-z][A-Za-z0-9.\s]{1,40})/i,
  );
  const frontendMatch = text.match(
    /(?:frontend|cliente|ui)[:\s]+([A-Za-z][A-Za-z0-9.\s]{1,40})/i,
  );
  const nest = /nestjs/i.test(text) ? "NestJS" : undefined;
  const react = /react/i.test(text) ? "React" : undefined;
  return {
    backend: nest ?? backendMatch?.[1]?.trim().split(/\s/)[0],
    frontend: react ?? frontendMatch?.[1]?.trim().split(/\s/)[0],
  };
}

function inferDomainSkillFolder(text: string): string | undefined {
  const pkg = text.match(/packages\/([a-z0-9_-]+)/i)?.[1];
  if (pkg) return `${pkg}-package`;
  const scope = text.match(/@([\w-]+)\/([\w-]+)/)?.[2];
  if (scope) return `${scope}-package`;
  return undefined;
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
 * Detecta arquetipos y artefactos (rules/skills) sugeridos desde MDD, Blueprint y complejidad.
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
      "Puedes enriquecer el contenido con datos del MDD/Blueprint; **no** inventes otros skills " +
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
  mddMarkdown: string,
): ArtifactTemplateContext {
  const stacks = inferStacks(mddMarkdown);
  return {
    complexity,
    archetypes: suggestions.archetypes,
    domainSkillFolder: inferDomainSkillFolder(mddMarkdown),
    backendStack: stacks.backend,
    frontendStack: stacks.frontend,
  };
}
