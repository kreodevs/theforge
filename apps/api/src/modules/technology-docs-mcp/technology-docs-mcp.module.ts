/**
 * @fileoverview **TechnologyDocsMcpModule** — optional Context7-compatible MCP for library documentation.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { TechnologyDocsMcpClientService } from "./technology-docs-mcp-client.service.js";

@Module({
  imports: [PrismaModule],
  providers: [TechnologyDocsMcpClientService],
  exports: [TechnologyDocsMcpClientService],
})
export class TechnologyDocsMcpModule {}
