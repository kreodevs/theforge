import { StateGraph, START, END, Command } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph/web";
import type { LivePrecisionCalculator } from "../estimation/estimation.types.js";
import { createMddClarifierNode } from "../nodes/mdd-clarifier.node.js";
import { createMddSoftwareArchitectNode } from "../nodes/mdd-software-architect.node.js";
import { createMddFormatterNode } from "../nodes/mdd-formatter.node.js";
import { createMddDiagramInjectorNode } from "../nodes/mdd-diagram-injector.node.js";
import { createMddSecurityNode } from "../nodes/mdd-security.node.js";
import { createMddIntegrationNode } from "../nodes/mdd-integration.node.js";
import { createMddFormatSecIntNode } from "../nodes/mdd-format-sec-int.node.js";
import { createMddQualityGateNode } from "../nodes/mdd-quality-gate.node.js";
import { createMddManagerNode, type MddManagerToolDeps } from "../nodes/mdd-manager.node.js";
import { createMddMergeSection1Node } from "../nodes/mdd-merge-section1.node.js";
import { createMddGraphPopulatorNode } from "../nodes/mdd-graph-populator.node.js";
import { resolveCorrectionAgentsFromQualityGate, inferAgentsFromQualityGaps } from "../utils/mdd-manager-routing.util.js";
import { mddNeedsSection5Pass } from "../utils/mdd-sanitize.js";
import { GraphMemoryService } from "../graph-memory/graph-memory.service.js";
import { createArchitectLLM, createDbgaLLM, createGraphLLM } from "../llm/create-dbga-llm.js";
import type { AIFactory } from "../../ai/ai.factory.js";
import { getMddArchitectTools } from "../tools/tool-registry.js";
import type { TheForgeService } from "../../theforge/theforge.service.js";
import { MDDStateAnnotation, type MDDStateType } from "../state/index.js";
import type { NodeCacheService } from "../checkpoint/node-cache.service.js";
import {
  clarifierInput,
  softwareArchitectInput,
  securityInput,
  integrationInput,
} from "../checkpoint/node-input-hash.js";
import type { MddFlowTraceOpts, MddFlowTraceService } from "../mdd/mdd-flow-trace.service.js";
import {
  shouldRunSecIntNode,
  nextInSections,
  shouldRunSecIntPass,
  routeAfterSoftwareArchitectLean,
  routeAfterFormatterPreSecIntLean,
  routeAfterSecurityLean,
  routeAfterIntegrationLean,
  routeAfterFormatSecIntLean,
  routeAfterDiagramLean,
  LEAN_SOFTWARE_ARCHITECT_DESTINATIONS,
  LEAN_FORMATTER_DESTINATIONS,
  LEAN_SECURITY_DESTINATIONS,
  LEAN_INTEGRATION_DESTINATIONS,
  LEAN_FORMAT_SEC_INT_DESTINATIONS,
  LEAN_DIAGRAM_DESTINATIONS,
} from "./mdd-graph-routing.util.js";

const MAX_MDD_ITERATIONS = 2;

const SILENT_STEPS = new Set(["fanout_sec_int"]);

/** Temperatura baja para nodos estructurales (architect/security/integration): reproducibilidad de diseño. */
const STRUCTURAL_TEMPERATURE = 0.2;

type NodeFn = (state: MDDStateType) => Promise<Partial<MDDStateType>>;
type AnyNodeFn = (state: MDDStateType) => Promise<Partial<MDDStateType>> | Partial<MDDStateType>;
type ManagerNodeFn = (state: MDDStateType) => Promise<Partial<MDDStateType> | Command>;
type InputHashFn = (state: MDDStateType) => Record<string, unknown>;

function wrapTraced(
  trace: MddFlowTraceService | null | undefined,
  correlationId: string | null | undefined,
  stepName: string,
  nodeFn: AnyNodeFn | ManagerNodeFn,
  shouldAbort?: () => void,
): NodeFn | ManagerNodeFn {
  if (!trace || !correlationId || SILENT_STEPS.has(stepName)) {
    return nodeFn as NodeFn | ManagerNodeFn;
  }
  const run = async (state: MDDStateType) => {
    const stepStart = Date.now();
    trace.stepStart(correlationId, stepName, { projectId: state.projectId });
    try {
      const result = await trace.runWithStepHeartbeats(correlationId, stepName, () =>
        Promise.resolve(nodeFn(state)),
      shouldAbort,
      );
      trace.stepEnd(correlationId, stepName, {
        durationMs: Date.now() - stepStart,
        projectId: state.projectId,
      });
      return result;
    } catch (err) {
      trace.stepEnd(correlationId, stepName, {
        durationMs: Date.now() - stepStart,
        projectId: state.projectId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
  return run as NodeFn | ManagerNodeFn;
}

function traceNode(
  trace: MddFlowTraceService | null | undefined,
  correlationId: string | null | undefined,
  stepName: string,
  nodeFn: AnyNodeFn,
  shouldAbort?: () => void,
): NodeFn {
  return wrapTraced(trace, correlationId, stepName, nodeFn, shouldAbort) as NodeFn;
}

function traceManagerNode(
  trace: MddFlowTraceService | null | undefined,
  correlationId: string | null | undefined,
  stepName: string,
  nodeFn: ManagerNodeFn,
  shouldAbort?: () => void,
): ManagerNodeFn {
  return wrapTraced(trace, correlationId, stepName, nodeFn, shouldAbort) as ManagerNodeFn;
}

function wrapCache(
  cache: NodeCacheService | null,
  nodeName: string,
  getInput: InputHashFn,
  nodeFn: AnyNodeFn,
  trace?: MddFlowTraceService | null,
  correlationId?: string | null,
  shouldAbort?: () => void,
): NodeFn {
  const tracedFn = traceNode(trace, correlationId, nodeName, nodeFn, shouldAbort);
  if (!cache) return tracedFn;
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const projectId = state.projectId;
    const key = cache.key(nodeName, projectId, getInput(state));
    const cached = cache.get(key);
    if (cached !== undefined) {
      if (trace && correlationId) {
        trace.cacheHit(correlationId, nodeName, { key, projectId });
      }
      return cached;
    }
    const result = await tracedFn(state);
    cache.set(key, result);
    return result;
  };
}

function wrapSecIntGuard(nodeName: "security" | "integration", nodeFn: AnyNodeFn): NodeFn {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    if (!shouldRunSecIntNode(state, nodeName)) return {};
    return Promise.resolve(nodeFn(state));
  };
}

function routeTracePayload(state: MDDStateType): Record<string, unknown> {
  return {
    sectionsToRun: state.sectionsToRun,
    managerRound: state.managerRound,
    delegateTarget: state.delegateTarget,
    mddIteration: state.mddIteration,
    qualityGateOk: state.qualityGate?.ok,
  };
}

function makeTracedRouter(
  trace: MddFlowTraceService | null,
  correlationId: string | null,
  routerName: string,
  routeFn: (state: MDDStateType) => string,
  validDestinations: readonly string[],
): (state: MDDStateType) => string {
  return (state: MDDStateType) => {
    const destination = routeFn(state);
    if (trace && correlationId) {
      trace.routeDecision(correlationId, routerName, destination, routeTracePayload(state));
      if (!validDestinations.includes(destination)) {
        trace.graphRouteCrash(correlationId, routerName, destination, {
          validDestinations: [...validDestinations],
          ...routeTracePayload(state),
        });
      }
    }
    return destination;
  };
}

function inferAgentsFromQualityFeedback(feedback: string): string[] {
  return inferAgentsFromQualityGaps([{ section: "General", issue: feedback, fix: feedback }]);
}

/** Opciones al compilar el grafo MDD (p. ej. TheForge MCP para herramientas del Arquitecto en legacy). */
export type MddGraphCompileOptions = {
  theforge?: TheForgeService | null;
  /** Cache por nodo para evitar re-ejecutar LLM si el input no cambió. */
  nodeCache?: NodeCacheService | null;
  /** Librería del MCP gráfico activo (§2 Frontend → UI Library). */
  uiMcpFrontendLibraryLabel?: string | null;
  /** Tracing estructurado del flujo MDD (siempre activo en producción). */
  flowTrace?: MddFlowTraceOpts | null;
  /** Lanzar si el usuario canceló el job (cooperativo entre pasos LLM). */
  shouldAbort?: () => void;
};

/**
 * Builds and compiles the MDD StateGraph (one-shot, no Manager).
 * Flow lean: Clarifier → Architect → Formatter → (Security ∥ Integration) → Formatter → Diagram → Quality Gate → GraphPopulator.
 * Salida: qualityGate.ok o máx. 2 iteraciones de corrección (sin umbrales 85/90).
 */
export async function createMddGraph(
  aiFactory: AIFactory,
  userId: string,
  graphMemory: GraphMemoryService,
  options?: MddGraphCompileOptions,
) {
  const chatLlm = await createDbgaLLM(aiFactory, userId);
  const graphLlm = await createGraphLLM(aiFactory, userId);
  const graphStructuralLlm = await createGraphLLM(aiFactory, userId, { temperature: STRUCTURAL_TEMPERATURE });
  const architectLlm = await createArchitectLLM(aiFactory, userId, { temperature: STRUCTURAL_TEMPERATURE });
  const nodeCache = options?.nodeCache ?? null;
  const flowTrace = options?.flowTrace ?? null;
  const trace = flowTrace?.service ?? null;
  const correlationId = flowTrace?.correlationId ?? null;
  const shouldAbort = options?.shouldAbort;
  const t = (name: string, fn: AnyNodeFn): NodeFn => traceNode(trace, correlationId, name, fn, shouldAbort);

  const clarifierNode = wrapCache(
    nodeCache,
    "clarifier",
    clarifierInput,
    createMddClarifierNode(graphLlm),
    trace,
    correlationId,
    shouldAbort,
  );
  const softwareArchitectNode = wrapCache(
    nodeCache,
    "software_architect",
    softwareArchitectInput,
    createMddSoftwareArchitectNode(architectLlm, getMddArchitectTools(), {
      theforge: options?.theforge ?? null,
      uiMcpFrontendLibraryLabel: options?.uiMcpFrontendLibraryLabel ?? null,
    }),
    trace,
    correlationId,
    shouldAbort,
  );
  const formatterNode = t("formatter", createMddFormatterNode());
  const securityNode = wrapCache(
    nodeCache,
    "security",
    securityInput,
    wrapSecIntGuard("security", createMddSecurityNode(graphStructuralLlm)),
    trace,
    correlationId,
    shouldAbort,
  );
  const integrationNode = wrapCache(
    nodeCache,
    "integration",
    integrationInput,
    wrapSecIntGuard("integration", createMddIntegrationNode(graphStructuralLlm)),
    trace,
    correlationId,
    shouldAbort,
  );
  const formatSecIntNode = t("format_sec_int", createMddFormatSecIntNode());
  const diagramInjectorNode = t("diagram_injector", createMddDiagramInjectorNode());
  const qualityGateNode = t("quality_gate", createMddQualityGateNode(graphLlm));
  const graphPopulatorNode = t("graph_populator", createMddGraphPopulatorNode(chatLlm, graphMemory));

  const fanoutSecIntNode = async (_state: MDDStateType): Promise<Partial<MDDStateType>> => ({});

  const routeAfterSoftwareArchitect = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterSoftwareArchitect",
    (state) => {
      const destination = routeAfterSoftwareArchitectLean(state);
      if (trace && correlationId && destination === "architect_section5_prep") {
        trace.section5PassTriggered(correlationId, {
          reason: "mddNeedsSection5Pass",
          ...routeTracePayload(state),
        });
      }
      return destination;
    },
    LEAN_SOFTWARE_ARCHITECT_DESTINATIONS,
  );

  const routeAfterFormatterPreSecInt = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterFormatterPreSecInt",
    routeAfterFormatterPreSecIntLean,
    LEAN_FORMATTER_DESTINATIONS,
  );

  const routeAfterFormatSecInt = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterFormatSecInt",
    routeAfterFormatSecIntLean,
    LEAN_FORMAT_SEC_INT_DESTINATIONS,
  );

  const routeAfterDiagram = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterDiagram",
    routeAfterDiagramLean,
    LEAN_DIAGRAM_DESTINATIONS,
  );

  const routeAfterSecurity = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterSecurity",
    routeAfterSecurityLean,
    LEAN_SECURITY_DESTINATIONS,
  );

  const routeAfterIntegration = makeTracedRouter(
    trace,
    correlationId,
    "routeAfterIntegration",
    routeAfterIntegrationLean,
    LEAN_INTEGRATION_DESTINATIONS,
  );

  const architectSection5PrepNode = async (state: MDDStateType): Promise<Partial<MDDStateType>> => ({
    architectSection5PassPending: true,
    previousMddDraftForMerge: state.mddDraft ?? "",
    currentStepGoal:
      "Genera ÚNICAMENTE ## 5. Lógica y Edge Cases con reglas Dado/Cuando/Entonces y edge cases del dominio. " +
      "Preserva §1–§4 sin cambios; no reescribas SQL ni contratos API.",
    executorControlled: true,
  });

  function routeAfterQualityGate(state: MDDStateType): string {
    if (state.qualityGate?.ok === true) return "graph_populator";
    const iteration = state.mddIteration ?? 0;
    if (iteration >= MAX_MDD_ITERATIONS) return "graph_populator";
    if (state.delegateTarget === "clarifier_only") return "clarifier";
    let destination: string;
    if (state.delegateTarget === "sections" && state.sectionsToRun?.length) {
      destination = state.sectionsToRun[0]!;
    } else {
      const agents = resolveCorrectionAgentsFromQualityGate(state.qualityGate, inferAgentsFromQualityFeedback);
      if (agents.includes("clarifier")) destination = "clarifier";
      else if (agents.includes("software_architect")) destination = "software_architect";
      else if (agents.includes("security")) destination = "security";
      else if (agents.includes("integration")) destination = "integration";
      else destination = "clarifier";
    }
    if (trace && correlationId) {
      trace.correctionStart(correlationId, {
        mddIteration: iteration,
        gapCount: state.qualityGate?.gaps?.length ?? 0,
        blockerCount: state.qualityGate?.blockers?.length ?? 0,
        firstNode: destination,
        ...routeTracePayload(state),
      });
      trace.routeDecision(correlationId, "routeAfterQualityGate", destination, routeTracePayload(state));
    }
    return destination;
  }

  const builder = new StateGraph(MDDStateAnnotation)
    .addNode("clarifier", clarifierNode)
    .addNode("software_architect", softwareArchitectNode)
    .addNode("architect_section5_prep", t("architect_section5_prep", architectSection5PrepNode))
    .addNode("formatter", formatterNode)
    .addNode("fanout_sec_int", fanoutSecIntNode)
    .addNode("security", securityNode)
    .addNode("integration", integrationNode)
    .addNode("format_sec_int", formatSecIntNode)
    .addNode("diagram_injector", diagramInjectorNode)
    .addNode("quality_gate", qualityGateNode)
    .addNode("graph_populator", graphPopulatorNode)
    .addEdge(START, "clarifier")
    .addEdge("clarifier", "software_architect")
    .addConditionalEdges("software_architect", routeAfterSoftwareArchitect, {
      architect_section5_prep: "architect_section5_prep",
      formatter: "formatter",
      security: "security",
      integration: "integration",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
    })
    .addEdge("architect_section5_prep", "software_architect")
    .addConditionalEdges("formatter", routeAfterFormatterPreSecInt, {
      fanout_sec_int: "fanout_sec_int",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
    })
    .addEdge("fanout_sec_int", "security")
    .addEdge("fanout_sec_int", "integration")
    .addConditionalEdges("security", routeAfterSecurity, {
      integration: "integration",
      format_sec_int: "format_sec_int",
      formatter: "formatter",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
    })
    .addConditionalEdges("integration", routeAfterIntegration, {
      format_sec_int: "format_sec_int",
      formatter: "formatter",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
    })
    .addConditionalEdges("format_sec_int", routeAfterFormatSecInt, {
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
    })
    .addConditionalEdges("diagram_injector", routeAfterDiagram, {
      quality_gate: "quality_gate",
    })
    .addConditionalEdges("quality_gate", routeAfterQualityGate, {
      graph_populator: "graph_populator",
      clarifier: "clarifier",
      software_architect: "software_architect",
      security: "security",
      integration: "integration",
    })
    .addEdge("graph_populator", END);

  return builder.compile();
}

/**
 * Builds and compiles the MDD StateGraph with Manager delgado.
 * Manager absorbe ask_initial_topic y plan_approval; sin executor 8-step ni auditor/prepare_output.
 * Salida END: qualityGate.ok o máx. 2 rondas Manager → generador.
 */
export async function createMddGraphWithManager(
  aiFactory: AIFactory,
  userId: string,
  checkpointer: BaseCheckpointSaver | null,
  graphMemory: GraphMemoryService,
  precisionCalculator?: LivePrecisionCalculator | null,
  managerToolDeps?: MddManagerToolDeps | null,
  compileOptions?: MddGraphCompileOptions,
) {
  const chatLlm = await createDbgaLLM(aiFactory, userId);
  const graphLlm = await createGraphLLM(aiFactory, userId);
  const graphStructuralLlm = await createGraphLLM(aiFactory, userId, { temperature: STRUCTURAL_TEMPERATURE });
  const architectLlm = await createArchitectLLM(aiFactory, userId, { temperature: STRUCTURAL_TEMPERATURE });
  const nodeCache = compileOptions?.nodeCache ?? null;
  const flowTrace = compileOptions?.flowTrace ?? null;
  const trace = flowTrace?.service ?? null;
  const correlationId = flowTrace?.correlationId ?? null;
  const shouldAbort = compileOptions?.shouldAbort;
  const t = (name: string, fn: AnyNodeFn): NodeFn => traceNode(trace, correlationId, name, fn, shouldAbort);

  const managerNode = traceManagerNode(
    trace,
    correlationId,
    "manager",
    createMddManagerNode(
      graphLlm,
      graphMemory,
      precisionCalculator,
      managerToolDeps ?? null,
      flowTrace,
    ),
    shouldAbort,
  );
  const clarifierNode = wrapCache(
    nodeCache,
    "clarifier",
    clarifierInput,
    createMddClarifierNode(graphLlm),
    trace,
    correlationId,
    shouldAbort,
  );
  const theForgeForArchitect = compileOptions?.theforge ?? managerToolDeps?.theforge ?? null;
  const softwareArchitectNode = wrapCache(
    nodeCache,
    "software_architect",
    softwareArchitectInput,
    createMddSoftwareArchitectNode(architectLlm, getMddArchitectTools(), {
      theforge: theForgeForArchitect,
      uiMcpFrontendLibraryLabel: compileOptions?.uiMcpFrontendLibraryLabel ?? null,
    }),
    trace,
    correlationId,
    shouldAbort,
  );
  const formatterNode = t("formatter", createMddFormatterNode());
  const securityNode = wrapCache(
    nodeCache,
    "security",
    securityInput,
    wrapSecIntGuard("security", createMddSecurityNode(graphStructuralLlm)),
    trace,
    correlationId,
    shouldAbort,
  );
  const integrationNode = wrapCache(
    nodeCache,
    "integration",
    integrationInput,
    wrapSecIntGuard("integration", createMddIntegrationNode(graphStructuralLlm)),
    trace,
    correlationId,
    shouldAbort,
  );
  const formatSecIntNode = t("format_sec_int", createMddFormatSecIntNode());
  const diagramInjectorNode = t("diagram_injector", createMddDiagramInjectorNode());
  const qualityGateNode = t("quality_gate", createMddQualityGateNode(graphLlm));
  const graphPopulatorNode = t("graph_populator", createMddGraphPopulatorNode(chatLlm, graphMemory));
  const mergeSection1Node = t("merge_section1_only", createMddMergeSection1Node());
  const fanoutSecIntNode = async (_state: MDDStateType): Promise<Partial<MDDStateType>> => ({});

  function routeAfterClarifier(state: MDDStateType): "manager" | "merge_section1_only" | "software_architect" {
    if (state.clarifierJustGeneratedQuestions === true) return "manager";
    if (state.delegateTarget === "clarifier_only") return "merge_section1_only";
    return "software_architect";
  }

  function routeAfterSoftwareArchitect(state: MDDStateType): string {
    if (!state.architectSection5PassPending && mddNeedsSection5Pass(state.mddDraft ?? "")) {
      if (trace && correlationId) {
        trace.section5PassTriggered(correlationId, {
          reason: "mddNeedsSection5Pass",
          ...routeTracePayload(state),
        });
      }
      return "architect_section5_prep";
    }
    const next = nextInSections(state, "software_architect");
    if (next) return next;
    return "formatter";
  }

  const architectSection5PrepNode = async (state: MDDStateType): Promise<Partial<MDDStateType>> => ({
    architectSection5PassPending: true,
    previousMddDraftForMerge: state.mddDraft ?? "",
    currentStepGoal:
      "Genera ÚNICAMENTE ## 5. Lógica y Edge Cases con reglas Dado/Cuando/Entonces y edge cases del dominio. " +
      "Preserva §1–§4 sin cambios; no reescribas SQL ni contratos API.",
    executorControlled: true,
  });

  function routeAfterFormatterPreSecInt(state: MDDStateType): string {
    const next = nextInSections(state, "formatter");
    if (next) return next;
    if (shouldRunSecIntPass(state)) return "fanout_sec_int";
    return "diagram_injector";
  }

  function routeAfterFormatSecInt(state: MDDStateType): string {
    const next = nextInSections(state, "format_sec_int");
    if (next) return next;
    return "diagram_injector";
  }

  function routeAfterDiagram(state: MDDStateType): string {
    const next = nextInSections(state, "diagram_injector");
    if (next) return next;
    return "quality_gate";
  }

  function routeAfterQualityGate(state: MDDStateType): string {
    if (state.qualityGate?.ok === true) return "graph_populator";
    if ((state.managerRound ?? 0) >= MAX_MDD_ITERATIONS) return END;
    return "manager";
  }

  function routeAfterGraphPopulator(_state: MDDStateType): string {
    return "manager";
  }

  const managerEnds = [
    "clarifier",
    END,
    "manager",
    "software_architect",
    "architect_section5_prep",
    "security",
    "integration",
    "formatter",
    "diagram_injector",
    "quality_gate",
    "graph_populator",
  ] as const;

  const builder = new StateGraph(MDDStateAnnotation)
    .addNode("manager", managerNode, { ends: [...managerEnds] })
    .addNode("clarifier", clarifierNode)
    .addNode("merge_section1_only", mergeSection1Node)
    .addNode("software_architect", softwareArchitectNode)
    .addNode("architect_section5_prep", t("architect_section5_prep", architectSection5PrepNode))
    .addNode("formatter", formatterNode)
    .addNode("fanout_sec_int", fanoutSecIntNode)
    .addNode("security", securityNode)
    .addNode("integration", integrationNode)
    .addNode("format_sec_int", formatSecIntNode)
    .addNode("diagram_injector", diagramInjectorNode)
    .addNode("quality_gate", qualityGateNode)
    .addNode("graph_populator", graphPopulatorNode)
    .addEdge(START, "manager")
    .addConditionalEdges("clarifier", routeAfterClarifier, {
      manager: "manager",
      merge_section1_only: "merge_section1_only",
      software_architect: "software_architect",
    })
    .addEdge("merge_section1_only", END)
    .addConditionalEdges("software_architect", routeAfterSoftwareArchitect, {
      architect_section5_prep: "architect_section5_prep",
      formatter: "formatter",
      security: "security",
      integration: "integration",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addEdge("architect_section5_prep", "software_architect")
    .addConditionalEdges("formatter", routeAfterFormatterPreSecInt, {
      fanout_sec_int: "fanout_sec_int",
      diagram_injector: "diagram_injector",
      manager: "manager",
    })
    .addEdge("fanout_sec_int", "security")
    .addEdge("fanout_sec_int", "integration")
    .addConditionalEdges("security", (state) => nextInSections(state, "security") ?? "format_sec_int", {
      integration: "integration",
      format_sec_int: "format_sec_int",
      formatter: "formatter",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addConditionalEdges("integration", (state) => nextInSections(state, "integration") ?? "format_sec_int", {
      format_sec_int: "format_sec_int",
      formatter: "formatter",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addConditionalEdges("format_sec_int", routeAfterFormatSecInt, {
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addConditionalEdges("diagram_injector", routeAfterDiagram, {
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addConditionalEdges("quality_gate", routeAfterQualityGate, {
      graph_populator: "graph_populator",
      manager: "manager",
      [END]: END,
    })
    .addConditionalEdges("graph_populator", routeAfterGraphPopulator, {
      manager: "manager",
    });

  return builder.compile(checkpointer ? { checkpointer } : undefined);
}
