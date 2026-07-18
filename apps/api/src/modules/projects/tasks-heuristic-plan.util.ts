/**
 * Plan de Tasks determinista cuando el Tasks Planner LLM no devuelve JSON válido.
 */

import type { DomainInventory, TasksGenerationPlan, TasksPlanItem } from "@theforge/shared-types";
import { extractEntities } from "../engine/conformance.service.js";
import { extractSectionByNumber } from "../engine/mdd-markdown-parser.js";
import {
  extractHttpEndpointsFromMarkdown,
} from "../ui-mcp/api-contract-endpoints.util.js";
import { extractPantallaRoutes } from "./tasks-generation-structure.util.js";

export type HeuristicTasksPlanInput = {
  mddMarkdown: string;
  apiContractsMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  inventory?: DomainInventory | null;
  hasUxTeam?: boolean;
};

function nextTaskId(counter: { n: number }): string {
  counter.n += 1;
  return `T-${String(counter.n).padStart(3, "0")}`;
}

function filterPlannerRoutes(routes: string[]): string[] {
  return routes.filter(
    (r) =>
      !/\/admin\/proc-cap/i.test(r) &&
      !/^\/gestion-/i.test(r) &&
      r.length >= 2,
  );
}

/** Construye un plan mínimo trazable desde API + pantallas + MDD §3. */
export function buildHeuristicTasksPlan(input: HeuristicTasksPlanInput): TasksGenerationPlan {
  const counter = { n: 0 };
  const items: TasksPlanItem[] = [];
  const sections = new Set<string>(["Backend", "Infra", "QA"]);

  const endpoints = extractHttpEndpointsFromMarkdown(input.apiContractsMarkdown ?? "");
  for (const ep of endpoints) {
    items.push({
      id: nextTaskId(counter),
      title: `Implementar endpoint ${ep.method} ${ep.path}`,
      layer: "Backend",
      mddRefs: [`§4 ${ep.path}`],
      storyRefs: [],
      upstreamRefs: [`api-contracts:${ep.method} ${ep.path}`],
      dependsOn: [],
      targetFilesHint: [
        `apps/api/src/modules/${ep.path.split("/").filter(Boolean).pop()?.replace(/-/g, "_") ?? "domain"}/`,
      ],
    });
  }

  const mddEntities = extractEntities(
    extractSectionByNumber(input.mddMarkdown ?? "", 3) || input.mddMarkdown || "",
  );
  if (items.length === 0 && mddEntities.size > 0) {
    for (const entity of [...mddEntities].slice(0, 20)) {
      items.push({
        id: nextTaskId(counter),
        title: `Modelo y persistencia ${entity} (MDD §3)`,
        layer: "Backend",
        mddRefs: [`§3 ${entity}`],
        storyRefs: [],
        upstreamRefs: [`mdd:entity:${entity}`],
        dependsOn: [],
        targetFilesHint: [`apps/api/src/modules/${entity.replace(/_/g, "-")}/`],
      });
    }
  }

  for (const cap of input.inventory?.capabilities.filter((c) => !c.isAuthRelated).slice(0, 8) ?? []) {
    if (items.some((i) => i.title.toLowerCase().includes(cap.title.toLowerCase().slice(0, 24)))) continue;
    items.push({
      id: nextTaskId(counter),
      title: `Implementar capacidad: ${cap.title}`,
      layer: "Backend",
      mddRefs: [cap.title],
      storyRefs: [],
      upstreamRefs: [`brd:${cap.id}`],
      dependsOn: [],
      targetFilesHint: [],
    });
  }

  const routes = filterPlannerRoutes(extractPantallaRoutes(input.uiScreensMarkdown ?? ""));
  if (routes.length > 0 || input.hasUxTeam) {
    sections.add("Frontend");
    for (const route of routes.slice(0, 30)) {
      items.push({
        id: nextTaskId(counter),
        title: `Implementar pantalla ${route}`,
        layer: "Frontend",
        mddRefs: ["§2 Frontend"],
        storyRefs: [],
        upstreamRefs: [`pantallas:${route}`],
        dependsOn: [],
        targetFilesHint: [`apps/web/src/views/`],
      });
    }
  }

  if (/docker|dokploy|redis|rabbitmq/i.test(input.mddMarkdown ?? "")) {
    items.push({
      id: nextTaskId(counter),
      title: "Configurar infraestructura y despliegue (MDD §7)",
      layer: "Infra",
      mddRefs: ["§7 Infraestructura"],
      storyRefs: [],
      upstreamRefs: ["mdd:§7"],
      dependsOn: items.length > 0 ? [items[0]!.id] : [],
      targetFilesHint: ["Dockerfile", "docker-compose.yml"],
    });
  }

  items.push({
    id: nextTaskId(counter),
    title: "Smoke tests E2E del MVP",
    layer: "QA",
    mddRefs: ["§5 Lógica"],
    storyRefs: [],
    upstreamRefs: ["spec:criterios-exito"],
    dependsOn: items.length > 1 ? [items[items.length - 2]!.id] : [],
    targetFilesHint: ["apps/api/test/"],
  });

  if (items.length === 0) {
    items.push({
      id: nextTaskId(counter),
      title: "Implementar MVP según MDD §1–§7",
      layer: "Backend",
      mddRefs: ["§1 Contexto"],
      storyRefs: [],
      upstreamRefs: ["mdd"],
      dependsOn: [],
      targetFilesHint: ["apps/api/src/"],
    });
  }

  return {
    sections: [...sections],
    items,
  };
}
