/**
 * Context Anchors por Historia de Usuario (Pasos 2–3 del algoritmo Tasks).
 * Inyección focalizada: solo fragmentos asociados a cada HU.
 */

import type {
  TasksContextAnchor,
  TasksContractManifest,
  TasksGenerationLayer,
  TasksPlanItem,
} from "@theforge/shared-types";
import {
  matchBusinessRulesForStory,
  matchEndpointsForStory,
} from "./tasks-contract-layers.util.js";

function layerContract(manifest: TasksContractManifest, layer: "domain" | "architecture" | "experience" | "integration") {
  return manifest.layers.find((l) => l.layer === layer);
}

/** Paso 2: construye un Context Anchor por cada HU del manifiesto. */
export function buildTasksContextAnchors(manifest: TasksContractManifest): TasksContextAnchor[] {
  const domain = layerContract(manifest, "domain");
  const architecture = layerContract(manifest, "architecture");
  const experience = layerContract(manifest, "experience");
  const integration = layerContract(manifest, "integration");

  const stories = domain?.userStories ?? experience?.userStories ?? [];
  const screens = experience?.screens ?? [];
  const endpoints = integration?.endpoints ?? [];
  const glossary = domain?.glossary ?? [];
  const rules = domain?.businessRules ?? [];
  const tech = architecture?.techStack;

  return stories.map((story) => {
    const storyEndpoints = matchEndpointsForStory(story, screens, endpoints);
    const storyScreens = screens.filter((s) => s.userStoryId === story.id);
    const components = [
      ...new Set(storyScreens.flatMap((s) => s.components)),
    ];

    return {
      story_id: story.id,
      feature: story.title,
      business_rules: matchBusinessRulesForStory(story, rules, glossary),
      tech_stack: tech
        ? {
            framework: tech.framework,
            patterns: tech.patterns.join(" / ") || undefined,
          }
        : undefined,
      contracts: {
        endpoints: storyEndpoints.map((e) => `${e.method} ${e.path}`),
        ui_components: components,
        screens: storyScreens.map((s) => s.route),
      },
      acceptance_criteria: story.acceptanceCriteria,
    };
  });
}

/** Context anchors relevantes para ítems del plan (por storyRefs). */
export function selectContextAnchorsForPlanItems(
  anchors: TasksContextAnchor[],
  items: TasksPlanItem[],
): TasksContextAnchor[] {
  const storyIds = new Set<string>();
  for (const item of items) {
    for (const ref of item.storyRefs ?? []) {
      if (ref.trim()) storyIds.add(ref.trim());
    }
  }
  if (storyIds.size === 0) return anchors.slice(0, 3);
  return anchors.filter((a) => storyIds.has(a.story_id));
}

/** Serializa anchors como bloque JSON para el prompt del redactor. */
export function serializeTasksContextAnchors(anchors: TasksContextAnchor[]): string {
  if (anchors.length === 0) return "";
  return JSON.stringify(anchors, null, 2);
}

/** Agrupa ítems del plan por capa de generación map-reduce. */
export function partitionPlanItemsByGenerationLayer(
  items: TasksPlanItem[],
): Map<TasksGenerationLayer, TasksPlanItem[]> {
  const map = new Map<TasksGenerationLayer, TasksPlanItem[]>();
  for (const item of items) {
    const layer = normalizeGenerationLayer(item.layer);
    const bucket = map.get(layer) ?? [];
    bucket.push(item);
    map.set(layer, bucket);
  }
  return map;
}

function normalizeGenerationLayer(layer: string): TasksGenerationLayer {
  if (/^frontend$/i.test(layer)) return "Frontend";
  if (/^infra/i.test(layer)) return "Infra";
  if (/^qa$/i.test(layer)) return "QA";
  if (/integraci/i.test(layer)) return "Integración";
  return "Backend";
}

/** Orden canónico de secciones al mergear salidas map-reduce. */
export const TASKS_GENERATION_LAYER_ORDER: TasksGenerationLayer[] = [
  "Backend",
  "Frontend",
  "Infra",
  "Integración",
  "QA",
];
