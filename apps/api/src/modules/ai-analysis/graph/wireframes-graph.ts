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
import type { ComponentMcpService } from "../../component-mcp/component-mcp.service.js";

/**
 * Builds and compiles the Wireframes StateGraph.
 * Edges: screen_analyzer → component_mapper → wireframe_composer → wireframe_critic
 * wireframe_critic → component_mapper (needs_revision, iterations < 2)
 * wireframe_critic → END (approved or iterations >= 2)
 * LLM: runtime BYOK del usuario (OpenAI-compatible).
 */
export async function createWireframesGraph(
  aiFactory: AIFactory,
  userId: string,
  componentMcpService: ComponentMcpService,
  checkpointer?: BaseCheckpointSaver | null,
) {
  const llm = await createDbgaLLM(aiFactory, userId);

  const mcpTools = createComponentMcpTools(componentMcpService, userId);
  console.log(`[Wireframes/Graph] build userId=${userId.slice(0, 8)}… mcpTools=${mcpTools.length}`);
  const screenAnalyzerNode = createScreenAnalyzerNode(llm);
  const componentMapperNode = createComponentMapperNode(llm, mcpTools, componentMcpService, userId);
  const wireframeComposerNode = createWireframeComposerNode(llm);
  const wireframeCriticNode = createWireframeCriticNode(llm);

  function routeCritic(state: WireframesStateType): string {
    return routeWireframesAfterCritic(state);
  }

  const builder = new StateGraph(WireframesStateAnnotation)
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

  return builder.compile(
    checkpointer ? { checkpointer } : undefined,
  );
}
