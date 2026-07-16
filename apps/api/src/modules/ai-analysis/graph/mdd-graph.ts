import { StateGraph, START, END } from "@langchain/langgraph";
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

const MAX_MDD_ITERATIONS = 2;

/** Temperatura baja para nodos estructurales (architect/security/integration): reproducibilidad de diseño. */
const STRUCTURAL_TEMPERATURE = 0.2;

type NodeFn = (state: MDDStateType) => Promise<Partial<MDDStateType>>;
type InputHashFn = (state: MDDStateType) => Record<string, unknown>;

function wrapCache(
  cache: NodeCacheService | null,
  nodeName: string,
  getInput: InputHashFn,
  nodeFn: NodeFn,
): NodeFn {
  if (!cache) return nodeFn;
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const projectId = state.projectId;
    const key = cache.key(nodeName, projectId, getInput(state));
    const cached = cache.get(key);
    if (cached !== undefined) {
      console.log(`[MDD:Cache] HIT ${nodeName} (key=${key})`);
      return cached;
    }
    const result = await nodeFn(state);
    cache.set(key, result);
    return result;
  };
}

function shouldRunSecIntNode(state: MDDStateType, nodeName: "security" | "integration"): boolean {
  if (state.delegateTarget === "sections" && state.sectionsToRun?.length) {
    return state.sectionsToRun.includes(nodeName);
  }
  return true;
}

function wrapSecIntGuard(nodeName: "security" | "integration", nodeFn: NodeFn): NodeFn {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    if (!shouldRunSecIntNode(state, nodeName)) return {};
    return nodeFn(state);
  };
}

function nextInSections(state: MDDStateType, currentNode: string): string | null {
  if (state.delegateTarget !== "sections" || !state.sectionsToRun?.length) return null;
  const idx = state.sectionsToRun.indexOf(currentNode);
  if (idx === -1) return null;
  const next = state.sectionsToRun[idx + 1];
  return next ?? "manager";
}

function shouldRunSecIntPass(state: MDDStateType): boolean {
  if (state.delegateTarget === "sections" && state.sectionsToRun?.length) {
    return state.sectionsToRun.includes("security") || state.sectionsToRun.includes("integration");
  }
  return true;
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

  const clarifierNode = wrapCache(nodeCache, "clarifier", clarifierInput, createMddClarifierNode(graphLlm));
  const softwareArchitectNode = wrapCache(
    nodeCache,
    "software_architect",
    softwareArchitectInput,
    createMddSoftwareArchitectNode(architectLlm, getMddArchitectTools(), {
      theforge: options?.theforge ?? null,
      uiMcpFrontendLibraryLabel: options?.uiMcpFrontendLibraryLabel ?? null,
    }),
  );
  const formatterNode = createMddFormatterNode();
  const securityNode = wrapCache(
    nodeCache,
    "security",
    securityInput,
    wrapSecIntGuard("security", createMddSecurityNode(graphStructuralLlm)),
  );
  const integrationNode = wrapCache(
    nodeCache,
    "integration",
    integrationInput,
    wrapSecIntGuard("integration", createMddIntegrationNode(graphStructuralLlm)),
  );
  const formatSecIntNode = createMddFormatSecIntNode();
  const diagramInjectorNode = createMddDiagramInjectorNode();
  const qualityGateNode = createMddQualityGateNode(graphLlm);
  const graphPopulatorNode = createMddGraphPopulatorNode(chatLlm, graphMemory);

  const fanoutSecIntNode = async (_state: MDDStateType): Promise<Partial<MDDStateType>> => ({});

  function routeAfterFormatterPreSecInt(state: MDDStateType): string {
    if (shouldRunSecIntPass(state)) return "fanout_sec_int";
    return "diagram_injector";
  }

  function routeAfterQualityGate(state: MDDStateType): string {
    if (state.qualityGate?.ok === true) return "graph_populator";
    const iteration = state.mddIteration ?? 0;
    if (iteration >= MAX_MDD_ITERATIONS) return "graph_populator";
    const agents = resolveCorrectionAgentsFromQualityGate(state.qualityGate, inferAgentsFromQualityFeedback);
    if (agents.includes("clarifier")) return "clarifier";
    if (agents.includes("software_architect")) return "software_architect";
    if (agents.includes("security")) return "security";
    if (agents.includes("integration")) return "integration";
    return "clarifier";
  }

  const builder = new StateGraph(MDDStateAnnotation)
    .addNode("clarifier", clarifierNode)
    .addNode("software_architect", softwareArchitectNode)
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
    .addEdge("software_architect", "formatter")
    .addConditionalEdges("formatter", routeAfterFormatterPreSecInt, {
      fanout_sec_int: "fanout_sec_int",
      diagram_injector: "diagram_injector",
    })
    .addEdge("fanout_sec_int", "security")
    .addEdge("fanout_sec_int", "integration")
    .addEdge("security", "format_sec_int")
    .addEdge("integration", "format_sec_int")
    .addEdge("format_sec_int", "diagram_injector")
    .addEdge("diagram_injector", "quality_gate")
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
  const managerNode = createMddManagerNode(graphLlm, graphMemory, precisionCalculator, managerToolDeps ?? null);
  const clarifierNode = wrapCache(nodeCache, "clarifier", clarifierInput, createMddClarifierNode(graphLlm));
  const theForgeForArchitect = compileOptions?.theforge ?? managerToolDeps?.theforge ?? null;
  const softwareArchitectNode = wrapCache(
    nodeCache,
    "software_architect",
    softwareArchitectInput,
    createMddSoftwareArchitectNode(architectLlm, getMddArchitectTools(), {
      theforge: theForgeForArchitect,
      uiMcpFrontendLibraryLabel: compileOptions?.uiMcpFrontendLibraryLabel ?? null,
    }),
  );
  const formatterNode = createMddFormatterNode();
  const securityNode = wrapCache(
    nodeCache,
    "security",
    securityInput,
    wrapSecIntGuard("security", createMddSecurityNode(graphStructuralLlm)),
  );
  const integrationNode = wrapCache(
    nodeCache,
    "integration",
    integrationInput,
    wrapSecIntGuard("integration", createMddIntegrationNode(graphStructuralLlm)),
  );
  const formatSecIntNode = createMddFormatSecIntNode();
  const diagramInjectorNode = createMddDiagramInjectorNode();
  const qualityGateNode = createMddQualityGateNode(graphLlm);
  const graphPopulatorNode = createMddGraphPopulatorNode(chatLlm, graphMemory);
  const mergeSection1Node = createMddMergeSection1Node();
  const fanoutSecIntNode = async (_state: MDDStateType): Promise<Partial<MDDStateType>> => ({});

  function routeAfterClarifier(state: MDDStateType): "manager" | "merge_section1_only" | "software_architect" {
    if (state.clarifierJustGeneratedQuestions === true) return "manager";
    if (state.delegateTarget === "clarifier_only") return "merge_section1_only";
    return "software_architect";
  }

  function routeAfterSoftwareArchitect(state: MDDStateType): string {
    const next = nextInSections(state, "software_architect");
    if (next) return next;
    return "formatter";
  }

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
      formatter: "formatter",
      security: "security",
      integration: "integration",
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
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
      diagram_injector: "diagram_injector",
      quality_gate: "quality_gate",
      manager: "manager",
    })
    .addConditionalEdges("integration", (state) => nextInSections(state, "integration") ?? "format_sec_int", {
      format_sec_int: "format_sec_int",
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
