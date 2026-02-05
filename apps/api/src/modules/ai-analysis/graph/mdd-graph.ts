import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph/web";
import type { LivePrecisionCalculator } from "../estimation/estimation.types.js";
import { createMddAskInitialTopicNode } from "../nodes/mdd-ask-initial-topic.node.js";
import { createMddClarifierNode } from "../nodes/mdd-clarifier.node.js";
import { createMddSoftwareArchitectNode } from "../nodes/mdd-software-architect.node.js";
import { createMddArchitectCriticNode } from "../nodes/mdd-architect-critic.node.js";
import { createMddFormatterNode } from "../nodes/mdd-formatter.node.js";
import { createMddDiagramInjectorNode } from "../nodes/mdd-diagram-injector.node.js";
import { createMddSecurityNode } from "../nodes/mdd-security.node.js";
import { createMddIntegrationNode } from "../nodes/mdd-integration.node.js";
import { createMddAuditorNode } from "../nodes/mdd-auditor.node.js";
import { createMddManagerNode } from "../nodes/mdd-manager.node.js";
import { createMddPlanApprovalNode } from "../nodes/mdd-plan-approval.node.js";
import { createMddExecutorNode } from "../nodes/mdd-executor.node.js";
import { createMddMergeSection1Node } from "../nodes/mdd-merge-section1.node.js";
import { createDbgaLLM } from "../llm/create-dbga-llm.js";
import { getMddAuditorTools, getMddArchitectTools } from "../tools/tool-registry.js";
import { MDDStateAnnotation, type MDDStateType } from "../state/index.js";

const MAX_MDD_ITERATIONS = 3;

/**
 * Builds and compiles the MDD StateGraph (one-shot, no Manager).
 * Flow: … → Auditor → (score < 85 && iteration < MAX ? Manager asigna gaps a agentes : END).
 * Los agentes generan contenido; el formateador (sin LLM) normaliza mddDraft; Redactor eliminado (documento unificado por merge + render).
 */
export function createMddGraph() {
  const llm = createDbgaLLM();
  const clarifierNode = createMddClarifierNode(llm);
  const softwareArchitectNode = createMddSoftwareArchitectNode(llm, getMddArchitectTools());
  const formatterNode = createMddFormatterNode();
  const securityNode = createMddSecurityNode(llm);
  const integrationNode = createMddIntegrationNode(llm);
  const diagramInjectorNode = createMddDiagramInjectorNode();
  const auditorNode = createMddAuditorNode(llm, getMddAuditorTools(), null);

  function routeAuditor(state: MDDStateType): string {
    if (state.auditorDecision === "clarifier" && (state.mddIteration ?? 0) < MAX_MDD_ITERATIONS) {
      return "clarifier";
    }
    return END;
  }

  const builder = new StateGraph(MDDStateAnnotation)
    .addNode("clarifier", clarifierNode)
    .addNode("software_architect", softwareArchitectNode)
    .addNode("format_after_architect", formatterNode)
    .addNode("security", securityNode)
    .addNode("integration", integrationNode)
    .addNode("format_after_redactor", formatterNode)
    .addNode("diagram_injector", diagramInjectorNode)
    .addNode("auditor", auditorNode)
    .addEdge(START, "clarifier")
    .addEdge("clarifier", "software_architect")
    .addEdge("software_architect", "format_after_architect")
    .addEdge("format_after_architect", "security")
    .addEdge("security", "integration")
    .addEdge("integration", "format_after_redactor")
    .addEdge("format_after_redactor", "diagram_injector")
    .addEdge("diagram_injector", "auditor")
    .addConditionalEdges("auditor", routeAuditor, {
      clarifier: "clarifier",
      [END]: END,
    });

  return builder.compile();
}

/**
 * Builds and compiles the MDD StateGraph with Manager as Entrevistador de Estados.
 * Caso 1 (Inicio): sin Bench ni MDD → Manager NO delega; ask_initial_topic; al responder → Clarifier → … → Auditor → Manager; si score < 85 → Manager asigna gaps a agentes.
 * Caso 2 (Refinamiento): score < 85% → Manager toma critical_gaps y asigna tareas a agentes para corregir.
 * Caso 3 (Benchmark): existe dbgaContent → delegar de inmediato a especialistas para v1; luego bucle refinamiento.
 * Done cuando Auditor >= 85% (cede intervención al usuario) o usuario pide detenerse. Requiere checkpointer para interrupt/resume.
 */
export function createMddGraphWithManager(
  checkpointer: BaseCheckpointSaver | null,
  precisionCalculator?: LivePrecisionCalculator | null,
) {
  const llm = createDbgaLLM();
  const managerNode = createMddManagerNode(llm, precisionCalculator);
  const askInitialTopicNode = createMddAskInitialTopicNode();
  const clarifierNode = createMddClarifierNode(llm);
  const softwareArchitectNode = createMddSoftwareArchitectNode(llm, getMddArchitectTools());
  const architectCriticNode = createMddArchitectCriticNode(llm);
  const formatterNode = createMddFormatterNode();
  const securityNode = createMddSecurityNode(llm);
  const integrationNode = createMddIntegrationNode(llm);
  const diagramInjectorNode = createMddDiagramInjectorNode();
  const auditorNode = createMddAuditorNode(llm, getMddAuditorTools(), precisionCalculator ?? null);

  /** Si hay directiva/requisitos y §3+§4 con contenido y aún no hemos pasado por critic (attempts < 1), ir a architect_critic. */
  function routeAfterSoftwareArchitect(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    const next = nextInSections(state, "software_architect");
    if (next) return next;
    const hasDirective = !!(state.acceptedProposalDirective?.trim());
    const draft = (state.mddDraft ?? "").trim();
    const hasSection3 = /##\s*3\.\s*Modelo\s+(?:de\s+)?datos/i.test(draft) && /\bCREATE\s+TABLE\b/i.test(draft);
    const hasSection4 = /##\s*4\.\s*Contratos\s+de\s+API/i.test(draft);
    const attempts = state.architectCriticAttempts ?? 0;
    if (hasDirective && hasSection3 && hasSection4 && attempts < 1) return "architect_critic";
    return "format_after_architect";
  }

  /** Tras critic: si hay feedback (gap) y solo 1 intento, volver a software_architect; si no, seguir a format. */
  function routeAfterArchitectCritic(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    const hasFeedback = !!(state.architectCriticFeedback?.trim());
    const attempts = state.architectCriticAttempts ?? 0;
    if (hasFeedback && attempts <= 1) return "software_architect";
    return "format_after_architect";
  }

  function routeAfterClarifier(state: MDDStateType): "manager" | "merge_section1_only" | "software_architect" | "executor" {
    if (state.executorControlled === true) return "executor";
    if (state.clarifierJustGeneratedQuestions === true) return "manager";
    if (state.delegateTarget === "clarifier_only") return "merge_section1_only";
    return "software_architect";
  }

  /** Siguiente nodo en sectionsToRun tras currentNode, o null para usar el default del pipeline. */
  function nextInSections(state: MDDStateType, currentNode: string): string | null {
    if (state.delegateTarget !== "sections" || !state.sectionsToRun?.length) return null;
    const idx = state.sectionsToRun.indexOf(currentNode);
    if (idx === -1) return null;
    const next = state.sectionsToRun[idx + 1];
    return next ?? "manager";
  }

  function routeAfterFormatArchitect(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return nextInSections(state, "format_after_architect") ?? "security";
  }
  function routeAfterSecurity(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return nextInSections(state, "security") ?? "integration";
  }
  function routeAfterIntegration(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return nextInSections(state, "integration") ?? "format_after_redactor";
  }
  function routeAfterFormatRedactor(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return nextInSections(state, "format_after_redactor") ?? "diagram_injector";
  }
  function routeAfterDiagram(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return nextInSections(state, "diagram_injector") ?? "auditor";
  }
  function routeAfterAuditor(state: MDDStateType): string {
    if (state.executorControlled === true) return "executor";
    return "manager";
  }
  function routeAfterMergeSection1(state: MDDStateType): "executor" | typeof END {
    if (state.executorControlled === true) return "executor";
    return END;
  }

  const mergeSection1Node = createMddMergeSection1Node();

  const managerEnds = [
    "clarifier",
    END,
    "manager",
    "ask_initial_topic",
    "plan_approval",
    "executor",
    "auditor",
    "software_architect",
    "architect_critic",
    "format_after_architect",
    "security",
    "integration",
  ] as const;

  const planApprovalNode = createMddPlanApprovalNode();
  const executorNode = createMddExecutorNode();
  const executorEnds = [
    "clarifier",
    "merge_section1_only",
    "software_architect",
    "architect_critic",
    "format_after_architect",
    "security",
    "integration",
    "format_after_redactor",
    "diagram_injector",
    "auditor",
    "manager",
  ] as const;

  const builder = new StateGraph(MDDStateAnnotation)
    .addNode("manager", managerNode, { ends: [...managerEnds] })
    .addNode("ask_initial_topic", askInitialTopicNode, { ends: ["clarifier"] })
    .addNode("plan_approval", planApprovalNode, { ends: ["manager"] })
    .addNode("executor", executorNode, { ends: [...executorEnds] })
    .addNode("clarifier", clarifierNode)
    .addNode("merge_section1_only", mergeSection1Node)
    .addNode("software_architect", softwareArchitectNode)
    .addNode("architect_critic", architectCriticNode)
    .addNode("format_after_architect", formatterNode)
    .addNode("security", securityNode)
    .addNode("integration", integrationNode)
    .addNode("format_after_redactor", formatterNode)
    .addNode("diagram_injector", diagramInjectorNode)
    .addNode("auditor", auditorNode)
    .addEdge(START, "manager")
    .addConditionalEdges("clarifier", routeAfterClarifier, {
      manager: "manager",
      merge_section1_only: "merge_section1_only",
      software_architect: "software_architect",
      executor: "executor",
    })
    .addConditionalEdges("merge_section1_only", routeAfterMergeSection1, {
      executor: "executor",
      [END]: END,
    })
    .addConditionalEdges("software_architect", routeAfterSoftwareArchitect, {
      architect_critic: "architect_critic",
      format_after_architect: "format_after_architect",
      security: "security",
      integration: "integration",
      format_after_redactor: "format_after_redactor",
      diagram_injector: "diagram_injector",
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("architect_critic", routeAfterArchitectCritic, {
      software_architect: "software_architect",
      format_after_architect: "format_after_architect",
    })
    .addConditionalEdges("format_after_architect", routeAfterFormatArchitect, {
      security: "security",
      integration: "integration",
      format_after_redactor: "format_after_redactor",
      diagram_injector: "diagram_injector",
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("security", routeAfterSecurity, {
      integration: "integration",
      format_after_redactor: "format_after_redactor",
      diagram_injector: "diagram_injector",
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("integration", routeAfterIntegration, {
      format_after_redactor: "format_after_redactor",
      diagram_injector: "diagram_injector",
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("format_after_redactor", routeAfterFormatRedactor, {
      diagram_injector: "diagram_injector",
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("diagram_injector", routeAfterDiagram, {
      auditor: "auditor",
      manager: "manager",
      executor: "executor",
    })
    .addConditionalEdges("auditor", routeAfterAuditor, {
      executor: "executor",
      manager: "manager",
    });

  return builder.compile(checkpointer ? { checkpointer } : undefined);
}
