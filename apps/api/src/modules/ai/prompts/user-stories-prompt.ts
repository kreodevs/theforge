import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "..", "modules", "ai", "prompts", "user-stories-prompt.md");

function loadUserStoriesPrompt(): string {
    try {
        return readFileSync(PROMPT_PATH, "utf-8").trim();
    } catch {
        return "Eres un Product Owner. Genera el documento en markdown con Epics, Historias de usuario y Tareas técnicas; cada ítem debe seguir las plantillas EPIC / HISTORIA / TAREA del prompt completo (archivo user-stories-prompt.md). Salida solo markdown, primer carácter #.";
    }
}

export const USER_STORIES_PROMPT = loadUserStoriesPrompt();
