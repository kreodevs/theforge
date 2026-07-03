/**
 * @fileoverview **UiMcpModule** — instancias team-wide de MCP gráfico (componentes UI):
 * CRUD, detección de compatibilidad y cliente de alto nivel para el pipeline de generación.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { CryptoModule } from "../crypto/crypto.module.js";
import { UiMcpController } from "./ui-mcp.controller.js";
import { UiMcpService } from "./ui-mcp.service.js";
import { UiMcpClientService } from "./ui-mcp-client.service.js";
import { UiScreensController } from "./ui-screens.controller.js";
import { UiScreensService } from "./ui-screens.service.js";

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [UiMcpController, UiScreensController],
  providers: [UiMcpService, UiMcpClientService, UiScreensService],
  exports: [UiMcpService, UiMcpClientService, UiScreensService],
})
export class UiMcpModule {}
