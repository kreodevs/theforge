/**
 * Estructura de export compatible con github/spec-kit:
 * `.specify/memory/constitution.md` + `specs/{NNN}-{slug}/`.
 */

import { formatDocumentPathMapTable } from "./document-layout.js";
import { splitPantallasAndUiProject } from "./ui-screens-export.js";
import { extractTaskCheckpoints } from "./tasks-parse.js";

export interface SpecKitBundleFile {
  path: string;
  content: string;
}

export interface SpecKitBundleInput {
  projectName: string;
  /** Número de feature (default 1 → `001-`). */
  featureOrdinal?: number;
  mddContent: string;
  specContent?: string | null;
  blueprintContent?: string | null;
  tasksContent?: string | null;
  apiContractsContent?: string | null;
  logicFlowsContent?: string | null;
  infraContent?: string | null;
  phase0SummaryContent?: string | null;
  dbgaContent?: string | null;
  uxUiGuideContent?: string | null;
  /** Pantallas / UI Screens Spec (MCP gráfico). Distinto de design-system.md (Guía UX/UI). */
  uiScreensContent?: string | null;
  architectureContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  /** Guía para agentes implementadores (p. ej. THEFORGE-DOC-CONSUMPTION-GUIDE). */
  consumptionGuideContent?: string | null;
  /** Stage delta change spec (stage 2+ brownfield). */
  changeSpecContent?: string | null;
  /** Acceptance criteria lines from spec or change spec. */
  acceptanceCriteriaLines?: string[] | null;
}

/** Resumen para handoff de implementación (equivalente a `/speckit.implement` + consumo The Forge). */
export function buildSddImplementReadme(featureDir: string): string {
  const pathMapTable = formatDocumentPathMapTable(featureDir);
  return `# Implementation from The Forge (spec-kit style)

## Document order (mandatory)

1. Read \`.specify/memory/constitution.md\` (MDD) — single source of truth.
2. Read \`spec.md\` (what/why) and \`plan.md\` (blueprint / technical plan) under \`${featureDir}/\`.
3. Use \`tasks.md\` as the execution checklist; always cross-check MDD §3–§4 and \`contracts/\`.
4. API contracts are binding (methods, paths, DTOs).
5. On conflict between artifacts, **the MDD wins**.

## Path map (spec-kit primary ↔ governance mirror)

${pathMapTable}

**The spec-kit layout is canonical.** Files under \`docs/sdd/\` mirror content for agent rules/skills — not an alternate SSOT.

## Installation order

1. Extract all bundled files at **repo root** (\`.specify/\`, \`${featureDir}/\`, \`AGENTS.md\`, \`docs/agent-governance/\`, \`docs/sdd/\`, \`scripts/\`). The human unpacks the ZIP; the agent confirms layout at repo root.
2. **Agent — first terminal action:** install governance (request shell permission if prompted):

\`\`\`bash
chmod +x scripts/install-agent-governance.sh
./scripts/install-agent-governance.sh
\`\`\`

Verify \`.cursor/rules/\` exists before coding. Do not ask the user to run the script unless it fails. See \`docs/agent-governance/INSTALACION.md\` for manual fallback.
3. Verify \`docs/sdd/*\` mirrors match spec-kit artifacts (optional cross-check).

## Executing tasks (agent workflow)

1. Open \`${featureDir}/tasks.md\` and find the first open item (\`- [ ]\`).
2. Tasks marked \`[P]\` may run **in parallel** within the same user-story **Checkpoint** block.
3. Each task should list target **file paths** (e.g. \`src/...\`); edit only those files unless the task explicitly expands scope.
4. After completing a Checkpoint section, run smoke checks from \`${featureDir}/quickstart.md\` for that user story.
5. Mark completed items as \`- [x]\` in \`tasks.md\` (or track in your agent session) before moving to the next task.
6. If implementation diverges from spec, stop and run **converge** (The Forge) or update the MDD first — do not silently drift.

## Agent governance (if bundled)

If this ZIP includes governance docs at repo root, the **agent** must run \`scripts/install-agent-governance.sh\` (see Installation order) before coding.
The \`docs/sdd/\` folder is a **mirror** for rules that reference SDD paths — always prefer spec-kit paths when both exist.

## Git branch naming

Create feature branches as \`{NNN}-{slug}\` where \`NNN\` is the 3-digit stage ordinal from The Forge (e.g. \`002-discount-module\`). One branch per stage change; see \`openspec/BRANCH-POLICY.md\` when bundled.

## Full consumption rules

See \`THEFORGE-DOC-CONSUMPTION-GUIDE.md\` at repo root (next to this file) for complete agent consumption rules.
`;
}

/** @deprecated Use {@link buildSddImplementReadme} with a concrete featureDir. */
export const SDD_IMPLEMENT_README = buildSddImplementReadme("specs/NNN-slug");

export function slugifySpecKitFeature(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "feature";
}

export function specKitFeatureDir(ordinal: number, projectName: string): string {
  const n = String(Math.max(1, ordinal)).padStart(3, "0");
  return `specs/${n}-${slugifySpecKitFeature(projectName)}`;
}

/** Extrae una sección H2 del MDD (## N. Título). */
export function extractMddSection(mdd: string, sectionNumber: number): string {
  const content = (mdd ?? "").trim();
  if (!content) return "";
  const pattern = new RegExp(`^##\\s*${sectionNumber}\\.[^\\n]*`, "im");
  const m = content.match(pattern);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  const rest = content.slice(start);
  const next = rest.match(/\n##\s+\d+\./m);
  const end = next?.index !== undefined ? next.index + 1 : rest.length;
  return rest.slice(0, end).trim();
}

const MAX_SMOKE_CHECKPOINTS = 10;

function detectPackageManager(
  mdd: string,
  blueprint?: string | null,
  spec?: string | null,
): "pnpm" | "npm" | "yarn" {
  const section2 = extractMddSection(mdd, 2);
  const corpus = [section2, blueprint, spec].filter(Boolean).join("\n");
  if (/\byarn\b/i.test(corpus)) return "yarn";
  if (/\bnpm\b/i.test(corpus) && !/\bpnpm\b/i.test(corpus)) return "npm";
  return "pnpm";
}

/** Quita marcadores `**` residuales del parseo de checkpoints en tasks.md. */
function normalizeCheckpointText(raw: string): string {
  return raw.replace(/^\*+|\*+$/g, "").trim();
}

function resolveHealthEndpoint(
  apiContracts: string | null | undefined,
  mdd: string | null | undefined,
): string | null {
  const sources = [
    (apiContracts ?? "").trim(),
    extractMddSection(mdd ?? "", 4),
    extractMddSection(mdd ?? "", 2),
  ].filter(Boolean);

  const found: string[] = [];
  const patterns = [
    /(?:^|[\s|])(?:GET|HEAD)\s+(\/api\/v\d+\/health\b[^\s|`]*)/gim,
    /(\/api\/v\d+\/health\b)/gi,
    /(?:^|[\s|])(?:GET|HEAD)\s+(\/health\b[^\s|`]*)/gim,
    /(\/(?:health|ready|healthz)\b)/gi,
  ];

  for (const src of sources) {
    for (const re of patterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(src)) !== null) {
        const path = (match[1] ?? "").replace(/[`|).,;]+$/, "");
        if (path) found.push(path);
      }
    }
  }

  const unique = [...new Set(found)];
  unique.sort((a, b) => {
    const score = (p: string) => (/\/api\/v\d+\//.test(p) ? 100 : 0) + p.length;
    return score(b) - score(a);
  });
  return unique[0] ?? null;
}

function checkpointPriority(cp: string): number {
  const t = cp.toLowerCase();
  let score = 0;
  if (/auth|login|jwt|sesión|session|register|oauth|signup/.test(t)) score += 10;
  if (/health|ready|readiness|liveness|\/api\/v\d+\/health/.test(t)) score += 9;
  if (/mvp|core|principal|smoke|crud|flujo/.test(t)) score += 4;
  if (/suite de pruebas sintéticas|modo sombra/i.test(t)) score -= 100;
  return score;
}

function selectSmokeCheckpoints(tasksContent: string, max = MAX_SMOKE_CHECKPOINTS): string[] {
  const all = extractTaskCheckpoints(tasksContent)
    .map(normalizeCheckpointText)
    .filter((cp) => cp.length > 3 && checkpointPriority(cp) > -50);

  const seen = new Set<string>();
  const selected: string[] = [];

  for (const cp of [...all].sort((a, b) => checkpointPriority(b) - checkpointPriority(a))) {
    if (checkpointPriority(cp) <= 0) continue;
    if (seen.has(cp)) continue;
    seen.add(cp);
    selected.push(cp);
    if (selected.length >= max) return selected;
  }

  for (const cp of all) {
    if (seen.has(cp)) continue;
    seen.add(cp);
    selected.push(cp);
    if (selected.length >= max) break;
  }

  return selected;
}

function buildQuickstart(
  spec: string | null | undefined,
  changeSpec?: string | null,
  acceptanceLines?: string[] | null,
  tasksContent?: string | null,
  blueprintContent?: string | null,
  mddContent?: string | null,
  apiContractsContent?: string | null,
): string {
  const lines: string[] = ["# Quickstart", ""];

  const mdd = (mddContent ?? "").trim();
  const corpus = [mdd, blueprintContent, spec].filter(Boolean).join("\n\n");
  const devSteps: string[] = [];
  const pm = detectPackageManager(mdd, blueprintContent, spec);
  devSteps.push(`- Instalar dependencias: \`${pm} install\``);
  if (/docker\s+compose|docker-compose/i.test(corpus)) {
    devSteps.push("- Levantar servicios: `docker compose up -d`");
  }
  const devScript = corpus.match(/(?:pnpm|npm|yarn)\s+(?:run\s+)?(?:dev|start:dev)\b/i)?.[0];
  if (devScript) devSteps.push(`- Arrancar API/app: \`${devScript.trim()}\``);
  const healthRoute = resolveHealthEndpoint(apiContractsContent, mdd);
  if (healthRoute) {
    devSteps.push(`- Verificar readiness: GET \`${healthRoute}\` (ver contratos API)`);
  }

  lines.push("## Arranque local", "", ...devSteps, "");

  const bullets: string[] = [];
  const tasksText = (tasksContent ?? "").trim();
  if (tasksText) {
    for (const cp of selectSmokeCheckpoints(tasksText)) {
      const item = `- [ ] Checkpoint: ${cp}`;
      if (!bullets.includes(item)) bullets.push(item);
    }
  }

  if (acceptanceLines?.length) {
    for (const line of acceptanceLines.slice(0, 10)) {
      if (bullets.length >= 12) break;
      const item = `- [ ] ${line.replace(/^[-*#\s]+/, "").trim()}`;
      if (!bullets.includes(item)) bullets.push(item);
    }
  }

  const s = (spec ?? "").trim();
  if (s) {
    const specLines = s
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        if (!/^[-*]\s/.test(t)) return false;
        const body = t.replace(/^[-*]\s+(\[[ xX]\]\s+)?/, "");
        if (/^\d+\.\s+\S/.test(body)) return false;
        if (/(?:ambigu|ambiguity|No se identifican marcadores)/i.test(t)) return false;
        return /criterios?\s+de\s+(?:éxito|aceptación)|acceptance\s+criteria/i.test(t);
      })
      .slice(0, 8);
    for (const l of specLines) {
      if (bullets.length >= 12) break;
      const item = `- [ ] ${l.replace(/^[-*#\s]+/, "").replace(/^\[[ xX]\]\s+/, "").trim()}`;
      if (!bullets.includes(item)) bullets.push(item);
    }
  }

  const delta = (changeSpec ?? "").trim();
  if (delta) {
    const deltaChecks = delta
      .split("\n")
      .filter((l) => l.startsWith("- ") || l.startsWith("* "))
      .slice(0, 6);
    for (const l of deltaChecks) {
      if (bullets.length >= 12) break;
      const item = `- [ ] Validar: ${l.replace(/^[-*]\s*/, "").trim()}`;
      if (!bullets.includes(item)) bullets.push(item);
    }
  }

  if (bullets.length === 0) {
    bullets.push("- [ ] Validar criterios de éxito del spec.md en entorno local");
    bullets.push("- [ ] Ejecutar smoke test del flujo principal descrito en plan.md");
    bullets.push("- [ ] Ejecutar lint, typecheck y tests del paquete tocado");
  }

  lines.push("## Escenarios de validación", "", ...bullets, "");
  lines.push(
    "## Referencias",
    "",
    "- Checklist completo: `tasks.md`",
    "- Plan técnico: `plan.md`",
    "- Constitución (MDD): `.specify/memory/constitution.md`",
    "",
  );

  return `${lines.join("\n")}`;
}

/**
 * Genera entradas path → contenido para ZIP spec-kit.
 * Omite archivos vacíos salvo constitution (siempre si hay MDD).
 */
export function buildSpecKitBundleFiles(input: SpecKitBundleInput): SpecKitBundleFile[] {
  const featureDir = specKitFeatureDir(input.featureOrdinal ?? 1, input.projectName);
  const files: SpecKitBundleFile[] = [];

  const mdd = (input.mddContent ?? "").trim();
  if (mdd) {
    files.push({ path: ".specify/memory/constitution.md", content: mdd });
  }

  const pushIf = (rel: string, content: string | null | undefined) => {
    const t = (content ?? "").trim();
    if (t) files.push({ path: `${featureDir}/${rel}`, content: t });
  };

  pushIf("spec.md", input.specContent);
  pushIf("plan.md", input.blueprintContent);
  pushIf("tasks.md", input.tasksContent);
  pushIf("contracts/api-contracts.md", input.apiContractsContent);
  pushIf("logic-flows.md", input.logicFlowsContent);
  pushIf("infra.md", input.infraContent);
  pushIf("design-system.md", input.uxUiGuideContent);

  const uiScreensRaw = (input.uiScreensContent ?? "").trim();
  if (uiScreensRaw) {
    const { pantallas, uiProjectJson } = splitPantallasAndUiProject(uiScreensRaw);
    pushIf("pantallas.md", pantallas || uiScreensRaw);
    pushIf("ui-project.json", uiProjectJson);
  }
  pushIf("architecture.md", input.architectureContent);
  pushIf("use-cases.md", input.useCasesContent);
  pushIf("user-stories.md", input.userStoriesContent);

  const research =
    (input.phase0SummaryContent ?? "").trim() || (input.dbgaContent ?? "").trim();
  pushIf("research.md", research || null);

  const dataModel = extractMddSection(mdd, 3);
  if (dataModel) {
    files.push({
      path: `${featureDir}/data-model.md`,
      content: `# Modelo de datos\n\n${dataModel}\n`,
    });
  }

  files.push({
    path: `${featureDir}/quickstart.md`,
    content: buildQuickstart(
      input.specContent,
      input.changeSpecContent,
      input.acceptanceCriteriaLines,
      input.tasksContent,
      input.blueprintContent,
      mdd,
      input.apiContractsContent,
    ),
  });

  const guide = (input.consumptionGuideContent ?? "").trim();
  if (guide) {
    files.push({ path: "THEFORGE-DOC-CONSUMPTION-GUIDE.md", content: guide });
  }

  files.push({ path: "IMPLEMENT.md", content: buildSddImplementReadme(featureDir) });

  return files;
}
