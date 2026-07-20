import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { ProjectIntegrationService } from "../projects/integration/project-integration.service.js";
import { buildHandoffPromptBlockForLegacyChange } from "../projects/integration/integration-context.util.js";
import {
  DEFAULT_SEMANTIC_QUERIES,
  getLegacyAskCodebaseOptions,
  getLegacySemanticSearchLimit,
  isLegacyEvidenceFirstEnabled,
  clipLegacySemanticSection,
} from "../theforge/theforge-evidence-context.util.js";
import { inferLegacyGraphNodeNameFromFunctionsFileText } from "./legacy-graph-node-name.util.js";
import {
  injectComponentDiagramIntoMddSection2,
  isLegacyComponentDiagramEnabled,
} from "./legacy-component-diagram.util.js";
import {
  injectAsIsCodebaseEvidenceIntoMdd,
  isLegacyAsIsMddEvidenceInjectEnabled,
} from "./legacy-as-is-mdd-inject.util.js";
import { AgentSupervisorService } from "../agent-supervisor/agent-supervisor.service.js";
import { runLegacyStagedDiscoveryMddAgent } from "./legacy-staged-discovery-agent.js";
import { AiService } from "../ai/ai.service.js";
import { LegacyReviewerService } from "./legacy-reviewer.service.js";
import { prepareMddMarkdownForPersist } from "../ai-analysis/utils/mdd-sanitize.js";
import { evaluateMddDeliveryGatePrepared } from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import { composeBrdPreamble } from "../ai-analysis/utils/brd-tobe-gate.util.js";
import { assertLegacyChangeGate } from "./legacy-change-gate.util.js";
import { AIFactory } from "../ai/ai.factory.js";
import { getRequestUserId } from "../../common/request-user.store.js";
import { compactCodebaseDocForMddPrompt } from "../theforge/legacy-mdd-v1-markdown.util.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  COORDINATOR_SYSTEM,
  mddTheforgeContextBlock,
  normalizeFilesToModify,
} from "./legacy-coordinator.util.js";
import type { LegacyGenerateMddResponse } from "./legacy-coordinator.types.js";
import { LegacyStageContextService, isLegacyBaselineStage } from "./legacy-stage-context.service.js";

@Injectable()
export class LegacyMddGenerationService {
  private readonly logger = new Logger(LegacyMddGenerationService.name);

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    private readonly theforge: TheForgeService,
    private readonly ai: AiService,
    private readonly reviewer: LegacyReviewerService,
    private readonly agentSupervisor: AgentSupervisorService,
    @Inject(forwardRef(() => ProjectIntegrationService))
    private readonly projectIntegration: ProjectIntegrationService,
    private readonly stageContext: LegacyStageContextService,
  ) {}

  async generateMdd(
    projectId: string,
    stageId?: string,
    options?: { includeContent?: boolean },
  ): Promise<LegacyGenerateMddResponse> {
    const { project, theforgeId } = await this.stageContext.getLegacyProject(projectId);
    const gateStage = stageId?.trim()
      ? (await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })) ??
        (await this.stageContext.resolveLegacyGateStage(projectId))
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const state = this.stageContext.readLegacyChangeState(gateStage);
    const description = state.description ?? "";
    const files = normalizeFilesToModify(state.filesToModify, theforgeId);
    const answers = state.answers ?? {};
    const answersText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const isInitialMdd = isLegacyBaselineStage(gateStage);
    assertLegacyChangeGate(gateStage);
    if (gateStage) {
      const dbProject = await this.prisma.project.findFirst({
        where: { id: projectId },
        include: { stages: { orderBy: { ordinal: "asc" } } },
      });
      if (dbProject) {
        this.projectIntegration.assertHandoffGateForLegacyMdd(dbProject, {
          ordinal: gateStage.ordinal,
          handoffImportedAt: gateStage.handoffImportedAt ?? null,
        });
      }
    }
    const integrationPromptCtx = await this.projectIntegration.resolvePromptContext(
      projectId,
      gateStage?.id,
    );
    const handoffMddBlock =
      !isInitialMdd && integrationPromptCtx.handoffItems.length && integrationPromptCtx.newProjectMeta
        ? buildHandoffPromptBlockForLegacyChange({
            newProjectId: integrationPromptCtx.newProjectMeta.id,
            newProjectName: integrationPromptCtx.newProjectMeta.name,
            items: integrationPromptCtx.handoffItems,
          }) + "\n\n---\n\n"
        : "";
    const descTermsGate = description.slice(0, 160).replace(/[^\w\s]/g, " ").trim();
    const gateSemanticQueries =
      !isInitialMdd && descTermsGate.length > 2
        ? [`${descTermsGate} modules services handlers components routes`, ...DEFAULT_SEMANTIC_QUERIES]
        : [...DEFAULT_SEMANTIC_QUERIES];
    await this.stageContext.assertLegacyIndexSddGate(projectId, theforgeId, state, {
      semanticQueries: gateSemanticQueries,
    });
    const brdPre =
      !isInitialMdd && gateStage?.brdContent ? composeBrdPreamble(gateStage.brdContent) : "";

    const theforgeParts: string[] = [];
    let baselineStage: { mddContent?: string | null } | null = null;
    if (!isInitialMdd && gateStage && gateStage.ordinal > 1) {
      const baselineOrdinal = gateStage.ordinal - 1;
      const stages = project?.stages ?? [];
      baselineStage = stages.find((s: { ordinal: number }) => s.ordinal === baselineOrdinal) ?? null;
      if (!baselineStage?.mddContent?.trim()) {
        try {
          const dbStage = await this.prisma.stage.findFirst({
            where: { projectId: gateStage.projectId, ordinal: baselineOrdinal },
            select: { mddContent: true },
          });
          if (dbStage?.mddContent?.trim()) baselineStage = dbStage;
        } catch {
          /* non-critical */
        }
      }
    }
    if (isLegacyEvidenceFirstEnabled()) {
      try {
        const changeEvidence = await runLegacyStagedDiscoveryMddAgent({
          aiFactory: this.aiFactory,
          userId: getRequestUserId(),
          theforge: this.theforge,
          projectId,
          theforgeProjectId: theforgeId,
          agentSupervisor: this.agentSupervisor,
          mode: isInitialMdd ? "initial" : "change",
          changeDescription: isInitialMdd ? undefined : description,
          logger: this.logger,
        });
        if (changeEvidence.trim()) {
          theforgeParts.push(
            (isInitialMdd
              ? "Evidencia TheForge — descubrimiento escalonado (MDD inicial del sistema):\n\n"
              : "Evidencia TheForge — descubrimiento escalonado (MDD AS-IS / foco cambio):\n\n") +
              changeEvidence.trim(),
          );
        }
      } catch (err) {
        this.logger.warn(
          `generateMdd: descubrimiento escalonado falló; se continúa sin ese bloque. ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (!isInitialMdd && description.trim()) {
      const legacyAsk = getLegacyAskCodebaseOptions();
      const descTerms = description.slice(0, 200).replace(/[^\w\s]/g, " ");
      const searchRelated = await this.theforge.semanticSearch(descTerms, theforgeId, getLegacySemanticSearchLimit());
      if (searchRelated?.trim()) {
        theforgeParts.push("Código relacionado (búsqueda semántica):\n" + clipLegacySemanticSection(searchRelated.trim()));
      }

      const q1 = await this.theforge.askCodebase(
        `For this change: "${description.slice(0, 400)}". List what ALREADY EXISTS in the codebase: data models/entities (tables, fields), API endpoints or services, and UI screens or components that touch clients, discounts, prices, price lists, campaigns, or profitability. Be exhaustive.`,
        theforgeId,
        legacyAsk,
      );
      if (q1.trim()) theforgeParts.push("Existe en el codebase:\n" + q1.trim());
      const q2 = await this.theforge.askCodebase(
        `For the same change: "${description.slice(0, 400)}". What architecture patterns, module structure, and file organization does the app use in the areas affected? Which files import or depend on client, discount, or pricing logic?`,
        theforgeId,
        legacyAsk,
      );
      if (q2.trim()) theforgeParts.push("Arquitectura y dependencias:\n" + q2.trim());
      const q3 = await this.theforge.askCodebase(
        `Summarize any business rules, validations, or edge cases already implemented in the codebase for: clients, discounts, price lists, campaigns, or profitability. Include where they live (file or module).`,
        theforgeId,
        legacyAsk,
      );
      if (q3.trim()) theforgeParts.push("Reglas y edge cases existentes:\n" + q3.trim());
    }
    if (!isInitialMdd) {
      for (let i = 0; i < Math.min(3, files.length); i++) {
        const f = files[i]!;
        const repoId = f.repoId || theforgeId;
        const funcs = await this.theforge.getFunctionsInFile(f.path, repoId, f.path);
        const nodeName = inferLegacyGraphNodeNameFromFunctionsFileText(funcs, f.path);
        const [impactBlock, defs] = await Promise.all([
          this.theforge.validateBeforeEdit(nodeName, repoId, f.path).then((b) => b || this.theforge.getLegacyImpact(nodeName, repoId, f.path)),
          this.theforge.getDefinitions(nodeName, repoId, f.path),
        ]);
        if (impactBlock?.trim()) {
          theforgeParts.push(`Validación antes de editar "${f.path}" (nodo grafo: \`${nodeName}\`):\n` + impactBlock.trim());
        }
        if (defs?.trim()) theforgeParts.push(`Definición de "${nodeName}" (archivo:líneas):\n` + defs.trim());
        if (funcs?.trim()) theforgeParts.push(`Funciones/componentes en ${f.path}:\n` + funcs.trim());
      }
      for (let i = 0; i < Math.min(2, files.length); i++) {
        const f = files[i]!;
        const content = await this.theforge.getFileContent(f.path, f.repoId || theforgeId, undefined, f.path);
        if (content.trim()) theforgeParts.push(`Contenido de ${f.path}:\n` + content.trim());
      }
    }
    const theforgeContext = theforgeParts.join("\n\n---\n\n");
    const filesLine =
      files.length > 0
        ? "Archivos a modificar (path" +
          (files.some((x) => x.repoId) ? ", repoId" : "") +
          "):\n" +
          files.map((f) => (f.repoId ? `${f.path} (repoId: ${f.repoId})` : f.path)).join("\n") +
          "\n\n"
        : "";
    const codebaseDoc = ((state.codebaseDoc ?? "") as string).trim();
    const codebaseDocBlock =
      codebaseDoc.length >= 80
        ? "## Documentación de partida — MDD inicial del codebase (Ariadne)\n\n" +
          compactCodebaseDocForMddPrompt(codebaseDoc) +
          "\n\n---\n\n"
        : "";
    const pathGroundingRulesBaseline =
      "**Rutas:** Usa paths **exactamente** como aparecen en la doc. de partida (`src/api/…`, `src/Models/…`, `src/…`). " +
      "PROHIBIDO inventar prefijos (`backend/`, `frontend/`) ni bundles/API no listados en entidades, contratos API o rutas de evidencia. " +
      "Entidades frontend (`source: frontend`) y contratos `apiDirection` cuentan como evidencia válida para el cliente OBP. " +
      "Si falta evidencia, documéntalo como brecha — no inventes ni proyectes cambios futuros.\n\n";
    const pathGroundingRulesChange =
      pathGroundingRulesBaseline +
      "Si una funcionalidad del BRD no tiene evidencia en el índice, márcala como brecha/pendiente — no la implementes en el MDD como existente.\n\n";
    let prompt: string;
    if (isInitialMdd) {
      prompt =
        codebaseDocBlock +
        "Genera un documento MDD inicial (Markdown) para un proyecto legacy. " +
        "El MDD describe **el sistema existente en su totalidad (AS-IS)**, no un cambio ni un MVP futuro. " +
        "Debe tener **exactamente 7 secciones** en este orden: " +
        "1. Contexto, 2. Arquitectura y Stack, 3. Modelo de Datos, 4. Contratos de API, 5. Lógica y Edge Cases, " +
        "6. Seguridad, 7. Infraestructura.\n\n" +
        "**§1 Contexto (AS-IS obligatorio):** Propósito y alcance = qué es el sistema **hoy**, quién lo usa y qué hace **en producción**. " +
        "PROHIBIDO: «modificar el sistema», «incorporar funcionalidades del BRD/MVP», alcance de cambio, objetivos de implementación futura. " +
        "Las funcionalidades no documentadas o gaps van en «Brechas de información» o notas neutras, **no** como propósito del documento.\n\n" +
        "**§2 obligatorio:** incluye `### Diagrama de Componentes` con un bloque ```mermaid (flowchart) " +
        "que refleje capas reales del codebase (frontend, API/backend, persistencia) usando solo evidencia de la doc. de partida.\n\n" +
        "**§3 Modelo de Datos (AS-IS exhaustivo):** documenta **cada entidad** de la doc. de partida en tablas " +
        "(Entidad | Origen | Atributos). PROHIBIDO resumir con «Otras entidades significativas», «N+ adicionales» " +
        "o listas separadas por comas en lugar de filas de tabla. Agrupa por repo si hay multi-root.\n\n" +
        "**§4 Contratos de API:** tablas completas de rutas/métodos por repo; no omitir endpoints listados en la doc. de partida.\n\n" +
        "**§5 Lógica y Edge Cases (AS-IS exhaustivo):** tabla **Servicio | Dependencias (paths)** por repo desde la doc. de partida " +
        "(sección «Lógica de negocio»). PROHIBIDO «Además, servicios para cada Content Type restante» o listas por comas. " +
        "Las reglas no indexadas van en «Brechas de información».\n\n" +
        pathGroundingRulesBaseline +
        "**Prioridad:** Recupera y usa en su totalidad el conocimiento del codebase (TheForge) que se te proporciona. " +
        "Usa TODO ese contexto para describir fielmente la aplicación existente. " +
        "No inventes rutas, APIs, entidades ni funcionalidades que no aparezcan en el contexto. " +
        "Si el codebase está incompleto en alguna área, documéntalo como brecha.\n\n" +
        (theforgeContext
          ? "Contexto del codebase (TheForge) — evidencia del índice, arquitectura, definiciones y búsqueda semántica. " +
            "Usar TODO para describir el sistema real.\n---\n" +
            mddTheforgeContextBlock(theforgeContext) +
            "\n---"
          : "");
    } else {
      const baselineBlock = baselineStage?.mddContent?.trim()
        ? "## Línea base — MDD de la etapa anterior (sistema sin el cambio actual)\n\n" +
          baselineStage.mddContent.trim() +
          "\n\n---\n\n" +
          "**Instrucción:** El MDD de cambio debe describir SOLO las modificaciones, adiciones o eliminaciones " +
          "respecto a esta línea base. No redescribas secciones enteras que no cambian. " +
          "Si una sección (§1–7) no se modifica, indícalo con «Sin cambios respecto a la línea base». " +
          "Enfócate en qué cambia, dónde cambia y por qué cambia.\n\n---\n\n"
        : "";
      prompt =
        (brdPre ? brdPre + "\n\n" : "") +
        handoffMddBlock +
        codebaseDocBlock +
        baselineBlock +
        "Genera un documento MDD de cambio (Markdown) para un proyecto legacy. " +
        "Según Specification-Driven Development, el MDD es la **Constitución del cambio** y debe tener " +
        "**exactamente 7 secciones** en este orden: 1. Contexto, 2. Arquitectura y Stack, 3. Modelo de Datos, " +
        "4. Contratos de API, 5. Lógica y Edge Cases, 6. Seguridad, 7. Infraestructura. " +
        "Aplica cada sección al **cambio** descrito (qué se modifica en contexto, stack, modelo, API, lógica, seguridad e infra). " +
        "En §2 incluye `### Diagrama de Componentes` (Mermaid flowchart) anclado a la doc. de partida.\n\n" +
        pathGroundingRulesChange +
        "**Prioridad:** Recupera y usa en su totalidad el conocimiento del codebase (TheForge) que se te proporciona " +
        "antes de elaborar el documento. Usa TODO ese contexto; infiere todas las modificaciones necesarias en módulos, " +
        "entidades, APIs y pantallas existentes que el cambio afecte; no te limites al requerimiento literal. " +
        "El MDD debe reflejar el conocimiento real de la aplicación indexada (qué hay hoy y qué debe cambiar).\n\n" +
        "Descripción del cambio:\n---\n" +
        description +
        "\n---\n\n" +
        filesLine +
        (answersText ? "Respuestas del usuario:\n---\n" + answersText + "\n---\n\n" : "") +
        (theforgeContext
          ? "Contexto del codebase (TheForge) — incluye evidencia del índice, validaciones, definiciones exactas, " +
            "funciones por archivo y búsqueda semántica. Usar TODO para inferir impacto completo. " +
            "No inventes rutas ni APIs que no aparezcan en este contexto.\n---\n" +
            mddTheforgeContextBlock(theforgeContext) +
            "\n---"
          : "");
    }
    const mddDraft = await this.ai.generateResponse(prompt, [], { systemPrompt: COORDINATOR_SYSTEM });
    const mddContent = await this.reviewer.reviewMdd(description, mddDraft?.trim() ?? "", {
      asIsBaseline: isInitialMdd,
    });
    let cleaned = mddContent?.trim() ?? "";
    if (isLegacyComponentDiagramEnabled() && codebaseDoc.length >= 80) {
      cleaned = injectComponentDiagramIntoMddSection2(cleaned, codebaseDoc);
    }
    if (isInitialMdd && isLegacyAsIsMddEvidenceInjectEnabled() && codebaseDoc.length >= 80) {
      cleaned = injectAsIsCodebaseEvidenceIntoMdd(cleaned, codebaseDoc);
    }
    cleaned = prepareMddMarkdownForPersist(cleaned);
    if (gateStage?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, gateStage.id, state).catch(() => {});
      await this.stageContext.syncCurrentLegacyStageToGraph(projectId, gateStage.id).catch(() => {});
    }
    await this.projects.update(projectId, {
      mddContent: cleaned,
      ...(gateStage?.id ? { stageId: gateStage.id } : {}),
    });
    const deliveryGate = await evaluateMddDeliveryGatePrepared(cleaned);
    const response: LegacyGenerateMddResponse = {
      ok: true,
      persisted: true,
      mddLength: cleaned.length,
      wordCount: cleaned.trim() ? cleaned.trim().split(/\s+/).length : 0,
      deliveryGate: {
        ok: deliveryGate.ok,
        score: deliveryGate.score,
        blockers: deliveryGate.blockers,
        warnings: deliveryGate.warnings,
      },
      ...(gateStage?.id ? { stageId: gateStage.id } : {}),
    };
    if (options?.includeContent) {
      response.mddContent = cleaned;
    }
    return response;
  }
}
