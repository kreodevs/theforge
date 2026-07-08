/**
 * DesignReferenceController
 *
 * Endpoints:
 *   GET /api/design-refs — lista todas
 *   GET /api/design-refs/:slug — detalle completo
 *   POST /api/design-refs/auto-match — matching automático por contexto MDD
 *   POST /api/design-refs/scan-url — escanea URL para extraer tokens (pendiente implementación)
 *   POST /api/design-refs/lint — valida un DESIGN.md con el CLI oficial @google/design.md
 */
import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { DesignRefService } from "./design-ref.service.js";
import { scanUrlForDesignTokens } from "./scan-url.util.js";

@Controller("design-refs")
export class DesignRefController {
  constructor(private readonly service: DesignRefService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    const ref = this.service.getBySlug(slug);
    if (!ref) {
      return { error: `Design reference "${slug}" not found` };
    }
    return ref;
  }

  @Post("auto-match")
  autoMatch(@Body("mddContext") mddContext: string) {
    if (!mddContext?.trim()) {
      return { error: "mddContext is required" };
    }
    return this.service.autoMatch(mddContext);
  }

  @Post("lint")
  lint(@Body("content") content: string) {
    if (!content?.trim()) {
      return { error: "content is required" };
    }
    return this.service.lint(content);
  }

  @Post("scan-url")
  async scanUrl(@Body("url") url: string) {
    if (!url?.trim()) {
      return { error: "URL is required" };
    }
    const result = await scanUrlForDesignTokens(url);
    if ("error" in result) {
      return { url, error: result.error };
    }
    return { url, status: "ok", tokens: result.tokens };
  }
}