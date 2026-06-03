import type { ComponentMapping, ScreenDefinition } from "../state/index.js";
import { screenDefinitionSchema } from "../state/index.js";
import { contentDigestHash } from "./wireframe-screen-sketch.util.js";
import { parseWireframeScreensFromMarkdown } from "./wireframe-screen-sketch.util.js";

export const WIREFRAMES_PIPELINE_CACHE_VERSION = 1 as const;

export type WireframesPipelineCache = {
  v: typeof WIREFRAMES_PIPELINE_CACHE_VERSION;
  inputsHash: string;
  screens: ScreenDefinition[];
};

export type StreamWireframesOptions = {
  /** Refresca solo mapeo/composición contra DS nuevo; reutiliza pantallas si casos/HU no cambiaron. */
  dsOnly?: boolean;
};

/** Hash estable de insumos del screen analyzer (casos de uso + historias). */
export function wireframesInputsHash(useCases: string, userStories: string): string {
  return contentDigestHash(`${useCases.trim()}\n---WIREFRAMES-INPUTS---\n${userStories.trim()}`);
}

export function buildWireframesPipelineCache(
  inputsHash: string,
  screens: ScreenDefinition[],
): WireframesPipelineCache {
  return { v: WIREFRAMES_PIPELINE_CACHE_VERSION, inputsHash, screens };
}

export function readWireframesPipelineCache(raw: unknown): WireframesPipelineCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== WIREFRAMES_PIPELINE_CACHE_VERSION) return null;
  if (typeof o.inputsHash !== "string" || !Array.isArray(o.screens)) return null;

  const screens: ScreenDefinition[] = [];
  for (const item of o.screens) {
    const parsed = screenDefinitionSchema.safeParse(item);
    if (parsed.success) screens.push(parsed.data);
  }
  if (screens.length === 0) return null;

  return { v: WIREFRAMES_PIPELINE_CACHE_VERSION, inputsHash: o.inputsHash, screens };
}

/** Reconstruye pantallas solo desde mappings persistidos (sin depender del markdown). */
export function reconstructScreensFromMappings(mappings: ComponentMapping[]): ScreenDefinition[] {
  const byScreenId = new Map<string, { components: Set<string> }>();
  for (const m of mappings) {
    const sid = m.screenId?.trim();
    if (!sid) continue;
    const bucket = byScreenId.get(sid) ?? { components: new Set<string>() };
    if (m.requiredComponent?.trim()) bucket.components.add(m.requiredComponent.trim());
    byScreenId.set(sid, bucket);
  }

  return [...byScreenId.entries()].map(([id, { components }]) => ({
    id,
    name: id,
    description: id,
    sourceUseCases: [],
    sourceUserStories: [],
    requiredComponents: [...components],
    navigationFlow: [],
  }));
}

export function resolveReusableScreens(options: {
  inputsHash: string;
  cache: WireframesPipelineCache | null;
  wireframesMarkdown: string;
  componentMappings: ComponentMapping[];
}): ScreenDefinition[] | null {
  const { inputsHash, cache, wireframesMarkdown, componentMappings } = options;

  if (cache && cache.inputsHash === inputsHash && cache.screens.length > 0) {
    return cache.screens;
  }

  const markdown = wireframesMarkdown.trim();
  if (markdown) {
    const reconstructed = reconstructScreensFromWireframes(markdown, componentMappings);
    if (reconstructed.length > 0) return reconstructed;
  }

  const fromMappings = reconstructScreensFromMappings(componentMappings);
  return fromMappings.length > 0 ? fromMappings : null;
}

/** Reconstruye pantallas mínimas desde wireframes persistidos (proyectos sin caché previa). */
export function reconstructScreensFromWireframes(
  markdown: string,
  mappings: ComponentMapping[],
): ScreenDefinition[] {
  const sections = parseWireframeScreensFromMarkdown(markdown);
  if (sections.length === 0) return [];

  const componentsByScreenId = new Map<string, Set<string>>();
  for (const m of mappings) {
    const sid = m.screenId?.trim();
    if (!sid) continue;
    const set = componentsByScreenId.get(sid) ?? new Set<string>();
    if (m.requiredComponent?.trim()) set.add(m.requiredComponent.trim());
    componentsByScreenId.set(sid, set);
  }

  const screens: ScreenDefinition[] = [];
  for (const section of sections) {
    const idMatch = section.body.match(/\*\*ID\*\*:\s*`([^`]+)`/);
    const id =
      idMatch?.[1]?.trim() ||
      section.screenName
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      "screen";

    const requiredFromMappings = [...(componentsByScreenId.get(id) ?? [])];
    screens.push({
      id,
      name: section.screenName,
      description: section.description || section.screenName,
      sourceUseCases: section.useCases,
      sourceUserStories: section.userStories,
      requiredComponents: requiredFromMappings,
      navigationFlow: [],
    });
  }

  return screens;
}
