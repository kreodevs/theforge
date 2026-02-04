import { Body, Controller, Post } from "@nestjs/common";
import { PreferencesService } from "./preferences.service.js";

@Controller("ai")
export class AiController {
  constructor(private readonly preferences: PreferencesService) { }

  /**
   * Cuando el usuario aprueba un MDD: extrae preferencias arquitectónicas y las guarda (memoria semántica).
   * Body: { projectId?: string, mddContent: string }
   */
  @Post("preferences/learn-from-mdd")
  async learnFromMdd(
    @Body() body: { projectId?: string; mddContent?: string },
  ): Promise<{ id: string }> {
    const mddContent = typeof body?.mddContent === "string" ? body.mddContent : "";
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() || null : null;
    return this.preferences.learnFromMdd(projectId, mddContent);
  }
}
