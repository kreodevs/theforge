import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@theforge/database";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    this.logger.log("[PrismaService] onModuleInit start");
    await this.$connect();
    this.logger.log("[PrismaService] onModuleInit end");
    // Defensa: si las migraciones de Prisma no se aplicaron (imagen stale,
    // cache, etc.), aseguramos las tablas críticas para no romper la
    // telemetría. Idempotente — no-op si la tabla ya existe.
    await this.ensureCriticalTables();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Crea tablas críticas que hemos visto fallar en deploy (e.g. migración
   * `20260724_add_token_usage` no se aplicó en una deploy porque la imagen
   * cacheada no incluía el SQL). Idempotente: usa IF NOT EXISTS y verifica
   * `information_schema` antes de crear FKs.
   *
   * No reemplaza a `prisma migrate deploy` (sigue siendo la fuente de verdad);
   * sólo es un salvavidas para entornos donde el entrypoint no haya podido
   * correr las migraciones.
   */
  private async ensureCriticalTables(): Promise<void> {
    const statements: Array<{ check: () => Promise<boolean>; sql: string; label: string }> = [
      {
        label: "TokenUsage",
        check: async () => {
          const rows = await this.$queryRawUnsafe<Array<{ exists: string | null }>>(
            "SELECT to_regclass('public.TokenUsage') AS exists",
          );
          return rows[0]?.exists !== null;
        },
        sql: `
          CREATE TABLE IF NOT EXISTS "TokenUsage" (
            "id" TEXT NOT NULL,
            "projectId" TEXT NOT NULL,
            "stageId" TEXT,
            "documentField" TEXT NOT NULL,
            "context" TEXT NOT NULL,
            "node" TEXT,
            "providerId" TEXT NOT NULL,
            "modelId" TEXT NOT NULL,
            "promptTokens" INTEGER NOT NULL,
            "completionTokens" INTEGER NOT NULL,
            "totalTokens" INTEGER NOT NULL,
            "costUsd" DOUBLE PRECISION NOT NULL,
            "costMxn" DOUBLE PRECISION NOT NULL,
            "jobId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
          );
        `,
      },
    ];

    for (const stmt of statements) {
      try {
        const exists = await stmt.check();
        if (exists) continue;
        this.logger.warn(
          `[PrismaService] Tabla crítica ausente (${stmt.label}); creando fallback desde onModuleInit.`,
        );
        await this.$executeRawUnsafe(stmt.sql);
        // FKs por separado porque CREATE TABLE IF NOT EXISTS no recrea FKs
        // si la tabla existe pero está incompleta. Verificamos cada una.
        if (stmt.label === "TokenUsage") {
          await this.ensureForeignKey("TokenUsage_projectId_fkey", `
            ALTER TABLE "TokenUsage"
            ADD CONSTRAINT "TokenUsage_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
          `);
          await this.ensureForeignKey("TokenUsage_stageId_fkey", `
            ALTER TABLE "TokenUsage"
            ADD CONSTRAINT "TokenUsage_stageId_fkey"
            FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE
          `);
        }
        this.logger.log(`[PrismaService] Tabla ${stmt.label} creada vía fallback.`);
      } catch (err) {
        this.logger.error(
          `[PrismaService] Fallback para ${stmt.label} falló: ${(err as Error).message}`,
        );
      }
    }
  }

  private async ensureForeignKey(constraintName: string, sql: string): Promise<void> {
    const rows = await this.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = $1 AND table_schema = 'public'
      ) AS exists`,
      constraintName,
    );
    if (rows[0]?.exists) return;
    await this.$executeRawUnsafe(sql);
  }
}
