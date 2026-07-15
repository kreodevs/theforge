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
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
