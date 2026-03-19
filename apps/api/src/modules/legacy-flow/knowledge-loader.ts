import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const KNOWLEDGE_DIR = join(__dirname, "knowledge");

const FILES = [
  "arquitectura-prompts-patrones.md",
  "specification-driven-development.md",
  "architecting-agentic-systems.md",
] as const;

/**
 * Carga el knowledge pack del flujo legacy: concatena el contenido de los 3 archivos markdown en `knowledge/`
 * (arquitectura-prompts-patrones, specification-driven-development, architecting-agentic-systems) para inyectar
 * en los prompts del coordinador y del revisor.
 * @returns Texto concatenado de todos los archivos encontrados, separados por "---".
 */
export function loadLegacyKnowledgePack(): string {
  const parts: string[] = [];
  for (const file of FILES) {
    const p = join(KNOWLEDGE_DIR, file);
    if (existsSync(p)) {
      try {
        parts.push(readFileSync(p, "utf-8").trim());
      } catch (err) {
        console.warn(`[legacy-flow] No se pudo cargar ${file}:`, err);
      }
    }
  }
  return parts.join("\n\n---\n\n");
}
