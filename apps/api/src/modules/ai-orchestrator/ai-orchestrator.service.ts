import { HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import type { ChatMessage } from "@the-forge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";

function filterChatByTab(log: ChatMessage[], tab: string): ChatMessage[] {
  return log.filter((m) => (m.tab ?? "mdd") === tab);
}
import { ProjectsService } from "../projects/projects.service.js";
import { SessionsService } from "../sessions/sessions.service.js";

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly projects: ProjectsService,
  ) { }

  /**
   * Envía un mensaje en la entrevista: obtiene o crea sesión, llama a la IA, persiste y devuelve sesión + proyecto actualizado.
   * Si mddContent viene en la petición (ediciones del usuario), la IA lo recibe como contexto actual del documento.
   */
  async chat(
    projectId: string,
    message: string,
    sessionId?: string,
    mddContentFromClient?: string,
    activeTab?: string,
    uxUiGuideContentFromClient?: string,
    dbgaContentFromClient?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    let session;
    if (sessionId) {
      session = await this.sessions.findOne(sessionId);
      if (session.projectId !== projectId) throw new NotFoundException("Session does not belong to project");
    } else {
      const sessions = await this.sessions.findByProject(projectId);
      if (sessions.length > 0) {
        session = await this.sessions.findOne(sessions[0].id);
      } else {
        session = await this.sessions.create({
          projectId,
          contextStep: "CONTEXT",
          chatLog: [],
        });
      }
    }

    const currentMdd =
      mddContentFromClient ?? project.mddContent ?? undefined;
    const isBenchmarkTab = activeTab?.trim() === "benchmark";
    const currentDbga =
      isBenchmarkTab && (dbgaContentFromClient ?? project.dbgaContent ?? "")?.trim()
        ? (dbgaContentFromClient ?? project.dbgaContent ?? "").trim()
        : !(currentMdd?.trim()) && (project.dbgaContent?.trim())
          ? project.dbgaContent
          : undefined;
    const currentUxUiGuide =
      uxUiGuideContentFromClient ?? project.uxUiGuideContent ?? undefined;
    if (mddContentFromClient != null && mddContentFromClient.trim().length > 0) {
      await this.projects.update(projectId, { mddContent: mddContentFromClient });
    }
    if (uxUiGuideContentFromClient != null && uxUiGuideContentFromClient.trim().length > 0) {
      await this.projects.update(projectId, { uxUiGuideContent: uxUiGuideContentFromClient });
    }
    const isUxUiGuide = activeTab?.trim() === "ux-ui-guide";
    let updatedSession;
    let mddFromResponse: string | null | undefined;
    let uxUiGuideFromResponse: string | null | undefined;
    let dbgaFromResponse: string | null | undefined;
    try {
      const chatResult = await this.sessions.chat(session.id, message, {
        currentMddContent: currentMdd,
        currentDbgaContent: currentDbga,
        currentUxUiGuideContent: currentUxUiGuide,
        currentBlueprintContent: isUxUiGuide ? (project.blueprintContent ?? undefined) : undefined,
        activeTab,
      });
      updatedSession = chatResult.session;
      mddFromResponse = chatResult.mddContent;
      uxUiGuideFromResponse = chatResult.uxUiGuideContent;
      dbgaFromResponse = chatResult.dbgaContent;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al generar la respuesta";
      throw new HttpException(
        msg,
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: err instanceof Error ? err : undefined },
      );
    }
    if (!updatedSession) throw new NotFoundException("Session not found after chat");
    let updatedProject: Awaited<ReturnType<ProjectsService["update"]>> | null = null;
    if (mddFromResponse != null && mddFromResponse.length > 0) {
      updatedProject = await this.projects.update(projectId, { mddContent: mddFromResponse });
    }
    if (uxUiGuideFromResponse != null && uxUiGuideFromResponse.length > 0) {
      console.log("[Orchestrator] persisting uxUiGuideContent (Guía UX/UI) length:", uxUiGuideFromResponse.length);
      updatedProject = await this.projects.update(projectId, { uxUiGuideContent: uxUiGuideFromResponse });
    }
    if (dbgaFromResponse != null && dbgaFromResponse.length > 0) {
      console.log("[Orchestrator] persisting dbgaContent (Benchmark refinado) length:", dbgaFromResponse.length);
      updatedProject = await this.projects.update(projectId, { dbgaContent: dbgaFromResponse });
    }
    if (!updatedProject) {
      updatedProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { estimation: true },
      });
    }
    const outUx = updatedProject?.uxUiGuideContent ?? null;
    const uxToReturn = (uxUiGuideFromResponse != null && uxUiGuideFromResponse.length > 0)
      ? uxUiGuideFromResponse
      : outUx;
    console.log("[Orchestrator] returning uxUiGuideContent (Guía UX/UI) length:", uxToReturn?.length ?? 0);

    const finalProject = updatedProject ?? (await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    })) ?? project;
    if (uxToReturn != null && finalProject && "uxUiGuideContent" in finalProject) {
      (finalProject as { uxUiGuideContent: string | null }).uxUiGuideContent = uxToReturn;
    }

    return {
      session: updatedSession,
      project: finalProject,
      uxUiGuideContent: uxToReturn ?? undefined,
    };
  }

  /**
   * Streaming chat: same setup as chat(), yields SSE events (chunk then done).
   */
  async *chatStream(
    projectId: string,
    message: string,
    sessionId?: string,
    mddContentFromClient?: string,
    activeTab?: string,
    uxUiGuideContentFromClient?: string,
    dbgaContentFromClient?: string,
  ): AsyncGenerator<{ event: string; data: unknown }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    let session;
    if (sessionId) {
      session = await this.sessions.findOne(sessionId);
      if (session.projectId !== projectId) throw new NotFoundException("Session does not belong to project");
    } else {
      const sessions = await this.sessions.findByProject(projectId);
      if (sessions.length > 0) {
        session = await this.sessions.findOne(sessions[0].id);
      } else {
        session = await this.sessions.create({
          projectId,
          contextStep: "CONTEXT",
          chatLog: [],
        });
      }
    }

    const currentMdd = mddContentFromClient ?? project.mddContent ?? undefined;
    const isBenchmarkTab = activeTab?.trim() === "benchmark";
    const currentDbga =
      isBenchmarkTab && (dbgaContentFromClient ?? project.dbgaContent ?? "")?.trim()
        ? (dbgaContentFromClient ?? project.dbgaContent ?? "").trim()
        : !(currentMdd?.trim()) && (project.dbgaContent?.trim())
          ? project.dbgaContent
          : undefined;
    const currentUxUiGuide = uxUiGuideContentFromClient ?? project.uxUiGuideContent ?? undefined;
    if (mddContentFromClient != null && mddContentFromClient.trim().length > 0) {
      await this.projects.update(projectId, { mddContent: mddContentFromClient });
    }
    if (uxUiGuideContentFromClient != null && uxUiGuideContentFromClient.trim().length > 0) {
      await this.projects.update(projectId, { uxUiGuideContent: uxUiGuideContentFromClient });
    }
    const isUxUiGuide = activeTab?.trim() === "ux-ui-guide";

    const stream = this.sessions.chatStream(session.id, message, {
      currentMddContent: currentMdd,
      currentDbgaContent: currentDbga,
      currentUxUiGuideContent: currentUxUiGuide,
      currentBlueprintContent: isUxUiGuide ? (project.blueprintContent ?? undefined) : undefined,
      activeTab,
    });

    for await (const msg of stream) {
      if (msg.type === "chunk") {
        yield { event: "chunk", data: { content: msg.content } };
      } else {
        let updatedProject: Awaited<ReturnType<ProjectsService["update"]>> | null = null;
        if (msg.mddContent != null && msg.mddContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { mddContent: msg.mddContent });
        }
        if (msg.uxUiGuideContent != null && msg.uxUiGuideContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { uxUiGuideContent: msg.uxUiGuideContent });
        }
        if (msg.dbgaContent != null && msg.dbgaContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { dbgaContent: msg.dbgaContent });
        }
        if (msg.specContent != null && msg.specContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { specContent: msg.specContent });
        }
        if (msg.blueprintContent != null && msg.blueprintContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { blueprintContent: msg.blueprintContent });
        }
        if (msg.apiContractsContent != null && msg.apiContractsContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { apiContractsContent: msg.apiContractsContent });
        }
        if (msg.logicFlowsContent != null && msg.logicFlowsContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { logicFlowsContent: msg.logicFlowsContent });
        }
        if (msg.tasksContent != null && msg.tasksContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { tasksContent: msg.tasksContent });
        }
        if (msg.infraContent != null && msg.infraContent.length > 0) {
          updatedProject = await this.projects.update(projectId, { infraContent: msg.infraContent });
        }
        const finalProject =
          updatedProject ??
          (await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { estimation: true },
          })) ??
          project;
        const uxToReturn =
          msg.uxUiGuideContent != null && msg.uxUiGuideContent.length > 0
            ? msg.uxUiGuideContent
            : finalProject?.uxUiGuideContent ?? null;
        const projectOut = { ...finalProject } as typeof finalProject & { uxUiGuideContent?: string | null };
        if (uxToReturn != null) projectOut.uxUiGuideContent = uxToReturn;
        yield {
          event: "done",
          data: {
            session: msg.session,
            project: projectOut,
            uxUiGuideContent: uxToReturn ?? undefined,
          },
        };
      }
    }
  }

  /**
   * Borra el historial de la conversación de la sesión del proyecto. El MDD no se modifica.
   * Devuelve sesión (con chatLog vacío) y proyecto para que el front actualice y pueda pedir welcome de nuevo.
   */
  async clearChat(projectId: string, sessionId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    let session;
    if (sessionId) {
      session = await this.sessions.findOne(sessionId);
      if (session.projectId !== projectId) throw new NotFoundException("Session does not belong to project");
    } else {
      const sessions = await this.sessions.findByProject(projectId);
      if (sessions.length > 0) {
        session = await this.sessions.findOne(sessions[0].id);
      } else {
        return { session: null, project };
      }
    }

    const updatedSession = await this.sessions.clearChat(session.id);
    return {
      session: updatedSession,
      project,
    };
  }

  /**
   * Genera mensaje de bienvenida (y primera pregunta si no hay contenido, o continuación si ya hay MDD/historial).
   * Obtiene o crea sesión, persiste solo el mensaje del asistente y devuelve sesión + proyecto.
   */
  async welcome(projectId: string, sessionId?: string, activeTab?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    let session;
    if (sessionId) {
      session = await this.sessions.findOne(sessionId);
      if (session.projectId !== projectId)
        throw new NotFoundException("Session does not belong to project");
    } else {
      const sessions = await this.sessions.findByProject(projectId);
      if (sessions.length > 0) {
        session = await this.sessions.findOne(sessions[0].id);
      } else {
        session = await this.sessions.create({
          projectId,
          contextStep: "CONTEXT",
          chatLog: [],
        });
      }
    }

    const chatLog = ((session.chatLog ?? []) as ChatMessage[]);
    const messagesForTab = filterChatByTab(chatLog, activeTab ?? "mdd");
    if (messagesForTab.length > 0) {
      return { session, project };
    }
    if ((activeTab ?? "mdd").trim().toLowerCase() === "mdd") {
      return { session, project };
    }

    const updatedSession = await this.sessions.generateWelcome(session.id, {
      projectName: project.name,
      mddContent: project.mddContent,
      dbgaContent: project.dbgaContent,
      uxUiGuideContent: project.uxUiGuideContent,
      chatLog: messagesForTab,
      activeTab,
    });

    const updatedProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });

    return {
      session: updatedSession,
      project: updatedProject ?? project,
    };
  }
}
