import type { TheForgeService } from "./theforge.service.js";

export const THEFORGE_ORCHESTRATOR_PORT = Symbol("THEFORGE_ORCHESTRATOR_PORT");

export type IOrchestratorTheForgePort = Pick<TheForgeService, "askCodebase">;
