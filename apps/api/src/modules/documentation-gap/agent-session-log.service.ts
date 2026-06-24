import { Injectable } from "@nestjs/common";
import type { AgentSessionLogKind } from "@theforge/shared-types";
import type { Prisma } from "@theforge/database";
import { PrismaService } from "../../prisma/prisma.service.js";

export interface AppendAgentSessionLogInput {
  projectId: string;
  stageId: string;
  kind: AgentSessionLogKind;
  summary: string;
  gapId?: string | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class AgentSessionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendAgentSessionLogInput) {
    return this.prisma.agentSessionLog.create({
      data: {
        projectId: input.projectId,
        stageId: input.stageId,
        kind: input.kind,
        gapId: input.gapId ?? null,
        summary: input.summary,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listByStage(projectId: string, stageId: string, options?: { limit?: number }) {
    const limit = options?.limit ?? 100;
    const rows = await this.prisma.agentSessionLog.findMany({
      where: { projectId, stageId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row: {
      id: string;
      projectId: string;
      stageId: string;
      kind: string;
      gapId: string | null;
      summary: string;
      payload: unknown;
      createdAt: Date;
    }) => ({
      id: row.id,
      projectId: row.projectId,
      stageId: row.stageId,
      kind: row.kind as AgentSessionLogKind,
      gapId: row.gapId,
      summary: row.summary,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
