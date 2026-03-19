import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphMemoryService } from "../graph-memory/graph-memory.service.js";
import { MDD_SECTION_ORDER } from "../state/mdd-structured.schema.js";
import { replaceOrAppendSection } from "../nodes/mdd-section-merge.js";
import { ProjectsService } from "../../projects/projects.service.js";
import type { AiService } from "../../ai/ai.service.js";

/**
 * Cypher de solo lectura sobre el grafo SDD; inyecta `projectId` y opcionalmente `stageId` en params.
 */
export function createQuerySddGraphTool(
  graphMemory: GraphMemoryService,
  projectId: string,
  activeStageId?: string,
) {
  return tool(
    async ({ cypher, params }) => {
      try {
        const merged: Record<string, unknown> = { ...(params ?? {}), projectId };
        if (activeStageId?.trim()) merged.stageId = activeStageId.trim();
        const res = await graphMemory.querySddGraphReadOnly(cypher, merged);
        const payload = res && typeof res === "object" && "data" in res ? (res as { data: unknown }).data : res;
        const text = JSON.stringify(payload ?? [], null, 2);
        return text.length > 14000 ? text.slice(0, 14000) + "\n…(truncado)" : text;
      } catch (err) {
        return `Error query_sdd_graph: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: "query_sdd_graph",
      description:
        "Ejecuta Cypher de SOLO LECTURA contra el Grafo SDD (FalkorDB local): Stage, MDD_Section, DB_Entity, API_Endpoint, relaciones CONSUMES/IMPLEMENTS. Usa $projectId y preferiblemente $stageId en el MATCH. Sin escrituras.",
      schema: z.object({
        cypher: z.string().describe("Consulta Cypher (MATCH/RETURN/CALL db.idx…); sin escrituras."),
        params: z.record(z.unknown()).optional().describe("Parámetros además de projectId / stageId inyectados"),
      }),
    },
  );
}

/**
 * Misma capacidad que `query_sdd_graph`, expuesta para el supervisor con énfasis en árboles de dependencia por etapa.
 */
export function createSupervisorSddGraphTool(
  graphMemory: GraphMemoryService,
  projectId: string,
  activeStageId?: string,
) {
  return tool(
    async ({ cypher, params }) => {
      try {
        const merged: Record<string, unknown> = { ...(params ?? {}), projectId };
        if (activeStageId?.trim()) merged.stageId = activeStageId.trim();
        const res = await graphMemory.querySddGraphReadOnly(cypher, merged);
        const payload = res && typeof res === "object" && "data" in res ? (res as { data: unknown }).data : res;
        const text = JSON.stringify(payload ?? [], null, 2);
        return text.length > 18000 ? text.slice(0, 18000) + "\n…(truncado)" : text;
      } catch (err) {
        return `Error supervisor_query_sdd_graph: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: "supervisor_query_sdd_graph",
      description:
        "Consultas Cypher complejas (solo lectura) sobre el SDD en FalkorDB: dependencias DB_Entity ↔ API_Endpoint por etapa, secciones MDD, reconstrucción del árbol si se pierde el código. Requiere acotar con $projectId y $stageId.",
      schema: z.object({
        cypher: z.string(),
        params: z.record(z.unknown()).optional(),
      }),
    },
  );
}

/**
 * Sustituye el cuerpo de una sección canónica 1..7 del MDD (markdown) y persiste en la etapa activa.
 */
export function createPatchMddSectionTool(projects: ProjectsService, projectId: string, activeStageId?: string) {
  return tool(
    async ({ sectionIndex, bodyMarkdown }) => {
      try {
        const project = await projects.findOne(projectId);
        const draft = project.mddContent ?? "";
        const heading = MDD_SECTION_ORDER[sectionIndex - 1];
        if (!heading) return "sectionIndex inválido.";
        const newSection = `## ${heading}\n\n${bodyMarkdown.trim()}\n`;
        const merged = replaceOrAppendSection(draft, heading, newSection);
        await projects.update(projectId, {
          mddContent: merged,
          ...(activeStageId?.trim() ? { stageId: activeStageId.trim() } : {}),
        });
        return `Sección «${heading}» actualizada y persistida.`;
      } catch (err) {
        return `Error patch_mdd_section: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: "patch_mdd_section",
      description:
        "Sobrescribe una sección del MDD (1=Contexto … 7=Infraestructura) con markdown de cuerpo; mantiene el resto del documento.",
      schema: z.object({
        sectionIndex: z.number().int().min(1).max(7).describe("Índice 1..7 según secciones canónicas del MDD"),
        bodyMarkdown: z.string().describe("Contenido markdown de la sección (sin el ## título)"),
      }),
    },
  );
}

/**
 * Enmienda constitucional: alinea §3 Modelo de datos y/o §4 Contratos de API con un delta (p. ej. tabla nueva en Blueprint).
 */
export function createProposeMddAmendmentTool(
  projects: ProjectsService,
  ai: AiService,
  projectId: string,
  activeStageId?: string,
) {
  return tool(
    async ({ targetSections, rationale, artifactExcerpt }) => {
      try {
        const project = await projects.findOne(projectId);
        const current = project.mddContent ?? "";
        const sections = targetSections.filter((n) => n === 3 || n === 4);
        if (sections.length === 0) return "targetSections debe incluir 3 y/o 4.";
        const merged = await ai.proposeMddAmendment({
          currentMdd: current,
          targetSections: sections,
          rationale,
          artifactExcerpt,
        });
        await projects.update(projectId, {
          mddContent: merged,
          ...(activeStageId?.trim() ? { stageId: activeStageId.trim() } : {}),
        });
        return "MDD enmendado (§3/§4) y persistido en la etapa activa.";
      } catch (err) {
        return `Error propose_mdd_amendment: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    {
      name: "propose_mdd_amendment",
      description:
        "Evalúa impacto de un cambio en Blueprint/API y parchea el MDD base en §3 Modelo de datos y/o §4 Contratos de API manteniendo la Constitución viva.",
      schema: z.object({
        targetSections: z
          .array(z.union([z.literal(3), z.literal(4)]))
          .min(1)
          .describe("Secciones del MDD a enmendar (solo 3 y/o 4)"),
        rationale: z.string().describe("Por qué el MDD debe cambiar (impacto, consistencia SDD)"),
        artifactExcerpt: z
          .string()
          .describe("Extracto del Blueprint, OpenAPI o SQL que introduce el delta"),
      }),
    },
  );
}

/**
 * Agentic RAG: consulta/patch SDD + enmienda MDD + herramienta supervisor para Cypher expresivo.
 */
export function getSddAgentTools(
  graphMemory: GraphMemoryService,
  projects: ProjectsService,
  ai: AiService,
  projectId: string,
  activeStageId?: string,
) {
  return [
    createQuerySddGraphTool(graphMemory, projectId, activeStageId),
    createSupervisorSddGraphTool(graphMemory, projectId, activeStageId),
    createPatchMddSectionTool(projects, projectId, activeStageId),
    createProposeMddAmendmentTool(projects, ai, projectId, activeStageId),
  ];
}
