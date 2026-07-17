import type { MDDStateType } from "../state/index.js";
import { mddNeedsSection5Pass } from "../utils/mdd-sanitize.js";

export function shouldRunSecIntNode(state: MDDStateType, nodeName: "security" | "integration"): boolean {
  if (state.delegateTarget === "sections" && state.sectionsToRun?.length) {
    if (state.sectionsToRun.includes("fanout_sec_int")) return true;
    return state.sectionsToRun.includes(nodeName);
  }
  return true;
}

export type LeanRoutingState = Pick<
  MDDStateType,
  "delegateTarget" | "sectionsToRun" | "mddDraft" | "architectSection5PassPending"
>;

export function nextInSections(
  state: Pick<MDDStateType, "delegateTarget" | "sectionsToRun">,
  currentNode: string,
): string | null {
  if (state.delegateTarget !== "sections" || !state.sectionsToRun?.length) return null;
  const idx = state.sectionsToRun.indexOf(currentNode);
  if (idx === -1) return null;
  const next = state.sectionsToRun[idx + 1];
  return next ?? "manager";
}

/** Igual que nextInSections pero sin destino manager (grafo lean sin nodo Manager). */
export function nextInCorrectionPipeline(state: LeanRoutingState, currentNode: string): string | null {
  const next = nextInSections(state, currentNode);
  if (!next || next === "manager") return null;
  return next;
}

export function shouldRunSecIntPass(state: Pick<MDDStateType, "delegateTarget" | "sectionsToRun">): boolean {
  if (state.delegateTarget === "sections" && state.sectionsToRun?.length) {
    return state.sectionsToRun.includes("security") || state.sectionsToRun.includes("integration");
  }
  return true;
}

/** Destinos válidos registrados en addConditionalEdges del grafo lean (sin manager). */
export const LEAN_SOFTWARE_ARCHITECT_DESTINATIONS = [
  "architect_section5_prep",
  "formatter",
  "security",
  "integration",
  "diagram_injector",
  "quality_gate",
] as const;

export const LEAN_FORMATTER_DESTINATIONS = ["fanout_sec_int", "diagram_injector", "quality_gate"] as const;

export const LEAN_SECURITY_DESTINATIONS = [
  "integration",
  "format_sec_int",
  "formatter",
  "diagram_injector",
  "quality_gate",
] as const;

export const LEAN_INTEGRATION_DESTINATIONS = [
  "format_sec_int",
  "formatter",
  "diagram_injector",
  "quality_gate",
] as const;

export const LEAN_FORMAT_SEC_INT_DESTINATIONS = ["diagram_injector", "quality_gate"] as const;

export const LEAN_DIAGRAM_DESTINATIONS = ["quality_gate"] as const;

export const LEAN_QUALITY_GATE_DESTINATIONS = [
  "graph_populator",
  "clarifier",
  "software_architect",
  "fanout_sec_int",
  "security",
  "integration",
] as const;

export function routeAfterSoftwareArchitectLean(state: LeanRoutingState): string {
  if (!state.architectSection5PassPending && mddNeedsSection5Pass(state.mddDraft ?? "")) {
    return "architect_section5_prep";
  }
  const next = nextInCorrectionPipeline(state, "software_architect");
  if (next) return next;
  return "formatter";
}

export function routeAfterFormatterPreSecIntLean(state: LeanRoutingState): string {
  const next = nextInCorrectionPipeline(state, "formatter");
  if (next) return next;
  if (shouldRunSecIntPass(state)) return "fanout_sec_int";
  return "diagram_injector";
}

export function routeAfterSecurityLean(state: LeanRoutingState): string {
  return nextInCorrectionPipeline(state, "security") ?? "format_sec_int";
}

export function routeAfterIntegrationLean(state: LeanRoutingState): string {
  return nextInCorrectionPipeline(state, "integration") ?? "format_sec_int";
}

export function routeAfterFormatSecIntLean(state: LeanRoutingState): string {
  const next = nextInCorrectionPipeline(state, "format_sec_int");
  if (next) return next;
  return "diagram_injector";
}

export function routeAfterDiagramLean(state: LeanRoutingState): string {
  const next = nextInCorrectionPipeline(state, "diagram_injector");
  if (next) return next;
  return "quality_gate";
}

export type LeanRouteResolver = {
  router: string;
  resolve: (state: LeanRoutingState) => string;
  validDestinations: readonly string[];
};

export const LEAN_ROUTE_RESOLVERS: LeanRouteResolver[] = [
  {
    router: "routeAfterSoftwareArchitect",
    resolve: routeAfterSoftwareArchitectLean,
    validDestinations: LEAN_SOFTWARE_ARCHITECT_DESTINATIONS,
  },
  {
    router: "routeAfterFormatterPreSecInt",
    resolve: routeAfterFormatterPreSecIntLean,
    validDestinations: LEAN_FORMATTER_DESTINATIONS,
  },
  {
    router: "routeAfterSecurity",
    resolve: routeAfterSecurityLean,
    validDestinations: LEAN_SECURITY_DESTINATIONS,
  },
  {
    router: "routeAfterIntegration",
    resolve: routeAfterIntegrationLean,
    validDestinations: LEAN_INTEGRATION_DESTINATIONS,
  },
  {
    router: "routeAfterFormatSecInt",
    resolve: routeAfterFormatSecIntLean,
    validDestinations: LEAN_FORMAT_SEC_INT_DESTINATIONS,
  },
  {
    router: "routeAfterDiagram",
    resolve: routeAfterDiagramLean,
    validDestinations: LEAN_DIAGRAM_DESTINATIONS,
  },
];

/** Simula el hop siguiente en la cadena de corrección y valida que el destino esté registrado. */
export function resolveCorrectionHop(
  sectionsToRun: string[],
  currentNode: string,
  resolver: LeanRouteResolver,
): string {
  const state = {
    delegateTarget: "sections" as const,
    sectionsToRun,
    mddDraft: "",
    architectSection5PassPending: true,
  };
  const destination = resolver.resolve(state);
  if (!resolver.validDestinations.includes(destination)) {
    throw new Error(
      `${resolver.router}: hop ${currentNode} → ${destination} not in [${resolver.validDestinations.join(", ")}]`,
    );
  }
  return destination;
}
