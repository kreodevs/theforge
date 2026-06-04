import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph/web";
import { WireframesStateAnnotation, type WireframesStateType } from "../state/index.js";
import { createScreenAnalyzerNode } from "../nodes/screen-analyzer.node.js";
import { createComponentMapperNode, createComponentMcpTools } from "../nodes/component-mapper.node.js";
import { createWireframeComposerNode } from "../nodes/wireframe-composer.node.js";
import { createWireframeCriticNode } from "../nodes/wireframe-critic.node.js";
import { createDbgaLLM } from "../llm/create-dbga-llm.js";
import { routeWireframesAfterCritic } from "./wireframes-critic-routing.js";
import type { AIFactory } from "../../ai/ai.factory.js";
import type { ComponentSourcePort } from "@theforge/component-source";

export type WireframesGraphOptions = {
  /** Punto de entrada; `component_mapper` omite screen_analyzer (refresh DS). */
  entryPoint?: "screen_analyzer" | "component_mapper";
  /** Omite crítico y revisiones (refresh DS con insumos sin cambios). */
  skipCritic?: boolean;
};

/**
 * Builds and compiles the Wireframes StateGraph.
 * Full: screen_analyzer → component_mapper → wireframe_composer → wireframe_critic
 * DS refresh: component_mapper → wireframe_composer → END
 */
export async function createWireframesGraph(
  aiFactory: AIFactory,
  userId: string,
  componentSource: ComponentSourcePort,
  checkpointer?: BaseCheckpointSaver | null,
  graphOptions?: WireframesGraphOptions,
) {
  const dsRefresh = graphOptions?.entryPoint === "component_mapper";
  const skipCritic = graphOptions?.skipCritic === true;
  const llm = await createDbgaLLM(aiFactory, userId);

  const mcpTools = createComponentMcpTools(componentSource, userId);
  console.log(`[Wireframes/Graph] build userId=${userId.slice(0, 8)}… mcpTools=${mcpTools.length}`);

  const componentMapperNode = createComponentMapperNode(
    llm,
    mcpTools,
    componentSource,
    userId,
    dsRefresh,
  );
  const wireframeComposerNode = createWireframeComposerNode(llm, dsRefresh);
  const compileOpts = checkpointer ? { checkpointer } : undefined;

  if (dsRefresh && skipCritic) {
    console.log("[Wireframes/Graph] mode=ds-refresh skipCritic=true");
    return new StateGraph(WireframesStateAnnotation)
      .addNode("component_mapper", componentMapperNode)
      .addNode("wireframe_composer", wireframeComposerNode)
      .addEdge(START, "component_mapper")
      .addEdge("component_mapper", "wireframe_composer")
      .addEdge("wireframe_composer", END)
      .compile(compileOpts);
  }

  const screenAnalyzerNode = createScreenAnalyzerNode(llm);
  const wireframeCriticNode = createWireframeCriticNode(llm);

  function routeCritic(state: WireframesStateType): string {
    return routeWireframesAfterCritic(state);
  }

  console.log(`[Wireframes/Graph] mode=full skipCritic=${skipCritic}`);

  if (skipCritic) {
    return new StateGraph(WireframesStateAnnotation)
      .addNode("screen_analyzer", screenAnalyzerNode)
      .addNode("component_mapper", componentMapperNode)
      .addNode("wireframe_composer", wireframeComposerNode)
      .addEdge(START, "screen_analyzer")
      .addEdge("screen_analyzer", "component_mapper")
      .addEdge("component_mapper", "wireframe_composer")
      .addEdge("wireframe_composer", END)
      .compile(compileOpts);
  }

  return new StateGraph(WireframesStateAnnotation)
    .addNode("screen_analyzer", screenAnalyzerNode)
    .addNode("component_mapper", componentMapperNode)
    .addNode("wireframe_composer", wireframeComposerNode)
    .addNode("wireframe_critic", wireframeCriticNode)
    .addEdge(START, "screen_analyzer")
    .addEdge("screen_analyzer", "component_mapper")
    .addEdge("component_mapper", "wireframe_composer")
    .addEdge("wireframe_composer", "wireframe_critic")
    .addConditionalEdges("wireframe_critic", routeCritic, {
      component_mapper: "component_mapper",
      __end__: END,
    })
    .compile(compileOpts);
}
