import type { ProjectsService } from "../../../projects/projects.service.js";
import type { TheForgeService } from "../../../theforge/theforge.service.js";
import type { AiService } from "../../../ai/ai.service.js";

/** Tools SDD + TheForge para `search_memory` (bindTools). */
export type MddManagerToolDeps = {
  projects: ProjectsService;
  theforge: TheForgeService;
  ai: AiService;
};
