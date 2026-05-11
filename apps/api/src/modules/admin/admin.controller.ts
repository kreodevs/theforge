import { Controller, Get, Put, Body, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get("ariadne-config")
  async getAriadneConfig(): Promise<{ url: string; token: string }> {
    const rows = await this.prisma.appConfig.findMany({
      where: { key: { in: ["ariadne_mcp_url", "ariadne_mcp_token"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      url: map.ariadne_mcp_url ?? "",
      token: map.ariadne_mcp_token ?? "",
    };
  }

  @Put("ariadne-config")
  async setAriadneConfig(
    @Body() body: { url?: string; token?: string },
  ): Promise<{ ok: boolean }> {
    const upsert = async (key: string, value: string | undefined) => {
      if (value === undefined) return;
      await this.prisma.appConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    };
    await upsert("ariadne_mcp_url", typeof body.url === "string" ? body.url.trim() : undefined);
    await upsert("ariadne_mcp_token", typeof body.token === "string" ? body.token.trim() : undefined);
    this.logger.log(`[Admin] Ariadne config updated`);
    return { ok: true };
  }
}
