import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ensureLangGraphCheckpointSchema } from "./langgraph-checkpoint-setup.util.js";

/**
 * Crea y mantiene el PostgresSaver para LangGraph.
 * El DDL lo ejecuta `ensureLangGraphCheckpointSchema` (idempotente + advisory lock),
 * no `PostgresSaver.setup()` directo — evita race pg_type_typname_nsp_index en multi-réplica.
 */
@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);

  private checkpointer: PostgresSaver | null = null;
  private setupPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    this.logger.log("[CheckpointerService] onModuleInit start");
    await this.getCheckpointer();
    this.logger.log("[CheckpointerService] onModuleInit end");
  }

  /**
   * Devuelve el checkpointer; si no existe, lo crea desde DATABASE_URL y asegura el schema.
   */
  async getCheckpointer(): Promise<PostgresSaver | null> {
    const url = process.env.DATABASE_URL;
    if (!url?.trim()) {
      this.logger.log("[CheckpointerService] getCheckpointer: no DATABASE_URL, skipping.");
      return null;
    }
    if (this.checkpointer) {
      return this.checkpointer;
    }
    if (this.setupPromise) {
      await this.setupPromise;
      return this.checkpointer;
    }
    this.setupPromise = this.initCheckpointer(url);
    await this.setupPromise;
    this.setupPromise = null;
    return this.checkpointer;
  }

  private async initCheckpointer(connString: string): Promise<void> {
    this.logger.log("[CheckpointerService] initCheckpointer start");
    const trimmed = connString.trim();
    try {
      this.logger.log("[CheckpointerService] ensureLangGraphCheckpointSchema running...");
      await ensureLangGraphCheckpointSchema(trimmed);
      this.logger.log("LangGraph checkpoint schema ready (checkpoints tables).");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `LangGraph checkpoint schema setup failed — DBGA / Paso 0 need tables checkpoints, checkpoint_blobs, checkpoint_writes. Run DB migrations (e.g. prisma migrate deploy). ${message}`,
      );
      throw err;
    }
    this.checkpointer = PostgresSaver.fromConnString(trimmed, {
      schema: "langgraph",
    });
    this.logger.log("[CheckpointerService] initCheckpointer end");
  }
}
