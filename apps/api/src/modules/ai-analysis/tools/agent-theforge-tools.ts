import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { TheForgeService } from "../../theforge/theforge.service.js";

/**
 * Herramientas TheForge (MCP) fijadas a un `theforgeProjectId` — para Coordinador Legacy / ReAct.
 */
export function getLegacyTheForgeAgentTools(theforge: TheForgeService, theforgeProjectId: string): StructuredToolInterface[] {
  const pid = theforgeProjectId;
  return [
    tool(
      async ({ question }) => theforge.askCodebase(question, pid),
      {
        name: "ask_codebase",
        description: "Pregunta en lenguaje natural sobre el código indexado en TheForge (grafo del repo).",
        schema: z.object({ question: z.string() }),
      },
    ),
    tool(
      async ({ userDescription }) => {
        const plan = await theforge.getModificationPlan(userDescription, pid);
        return plan ? JSON.stringify(plan, null, 2) : "(sin plan — TheForge no disponible o vacío)";
      },
      {
        name: "get_modification_plan",
        description: "Plan de modificación desde el grafo: archivos a tocar y preguntas de negocio.",
        schema: z.object({ userDescription: z.string() }),
      },
    ),
    tool(
      async ({ nodeName, currentFilePath }) =>
        theforge.validateBeforeEdit(nodeName, pid, currentFilePath),
      {
        name: "validate_before_edit",
        description: "Validación obligatoria antes de editar un nodo/archivo; impacto y contrato.",
        schema: z.object({
          nodeName: z.string(),
          currentFilePath: z.string().optional(),
        }),
      },
    ),
    tool(
      async ({ path, ref }) => theforge.getFileContent(path, pid, ref),
      {
        name: "get_file_content",
        description: "Lee el contenido de un archivo del repositorio indexado.",
        schema: z.object({
          path: z.string(),
          ref: z.string().optional(),
        }),
      },
    ),
    tool(
      async ({ nodeName }) => theforge.getLegacyImpact(nodeName, pid),
      {
        name: "get_legacy_impact",
        description: "Impacto en el grafo de código si se modifica un símbolo/nodo.",
        schema: z.object({ nodeName: z.string() }),
      },
    ),
  ];
}
