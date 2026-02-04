import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AiService } from "./ai.service.js";
import { ARCHITECTURAL_PREFERENCES_PROMPT } from "./prompts/architectural-preferences-prompt.js";

/**
 * Memoria semántica: extrae preferencias arquitectónicas de un MDD aprobado
 * y las persiste para inyectarlas en Fase 0 / DBGA.
 */
@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) { }

  /**
   * Cuando el usuario aprueba un MDD: resume preferencias arquitectónicas y las guarda.
   * Llamar desde el frontend al hacer "Aprobar MDD" o desde el flujo que persiste el MDD final.
   */
  async learnFromMdd(projectId: string | null, mddContent: string): Promise<{ id: string }> {
    const trimmed = mddContent?.trim().slice(0, 50_000) ?? "";
    if (!trimmed) {
      const row = await this.prisma.architecturalPreference.create({
        data: {
          projectId: projectId ?? undefined,
          summary: "Sin contenido MDD para extraer preferencias.",
        },
      });
      return { id: row.id };
    }
    const prompt =
      `${ARCHITECTURAL_PREFERENCES_PROMPT}\n\n---\nMDD aprobado (fragmento):\n\n${trimmed}`;
    const summary = await this.ai.generateResponse(prompt, [], {
      systemPrompt: "Eres un arquitecto. Responde solo con el resumen de preferencias en texto plano, sin JSON ni listas largas.",
    });
    const row = await this.prisma.architecturalPreference.create({
      data: {
        projectId: projectId ?? undefined,
        summary: (summary ?? "").trim().slice(0, 4000) || "Preferencias no determinadas.",
      },
    });
    return { id: row.id };
  }

  /**
   * Devuelve las últimas preferencias para inyectar en el contexto del agente (Fase 0 / DBGA).
   * projectId opcional: si se pasa, prioriza preferencias de ese proyecto; si no, últimas globales.
   */
  async getPreferencesForContext(projectId?: string | null, limit = 5): Promise<string> {
    const orderBy = { createdAt: "desc" as const };
    const rows = projectId?.trim()
      ? await this.prisma.architecturalPreference.findMany({
        where: { projectId: projectId.trim() },
        orderBy,
        take: limit,
        select: { summary: true },
      })
      : await this.prisma.architecturalPreference.findMany({
        orderBy,
        take: limit,
        select: { summary: true },
      });
    if (rows.length === 0) return "";
    return rows.map((r) => r.summary).filter(Boolean).join("\n\n---\n\n");
  }
}
