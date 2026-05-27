import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(__dirname, ".");
const PROMPTS_DIR_DIST = join(
  __dirname,
  "..", "..", "..", "..", "..", "..", "..", "..",
  "modules", "ai-analysis", "prompts", "wireframes",
);

function loadPrompt(filename: string, fallback: string): string {
  const paths = [
    join(PROMPTS_DIR, filename),
    join(PROMPTS_DIR_DIST, filename),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8").trim();
      } catch {
        break;
      }
    }
  }
  return fallback;
}

export const SCREEN_ANALYZER_PROMPT = loadPrompt(
  "screen-analyzer-prompt.md",
  "Eres un Analizador de Pantallas. Analiza casos de uso e historias de usuario y extrae todas las pantallas necesarias. Responde solo con JSON: { screens: [...] }.",
);

export const COMPONENT_MAPPER_PROMPT = loadPrompt(
  "component-mapper-prompt.md",
  "Eres un Mapeador de Componentes. Usa las herramientas MCP para mapear componentes requeridos al design system. Responde solo con JSON: { componentMappings: [...] }.",
);

export const WIREFRAME_COMPOSER_PROMPT = loadPrompt(
  "wireframe-composer-prompt.md",
  "Eres un Compositor de Wireframes. Genera un documento Markdown con wireframes ASCII, componentes del design system y diagramas Mermaid de navegación.",
);

export const WIREFRAME_CRITIC_PROMPT = loadPrompt(
  "wireframe-critic-prompt.md",
  "Eres un Crítico de Wireframes. Revisa el documento y valida cobertura de historias, navegación y componentes. Responde solo con JSON: { decision: 'approved'|'needs_revision', feedback: '...' }.",
);

export const SCREEN_SKETCH_AGENT_PROMPT = loadPrompt(
  "screen-sketch-agent-prompt.md",
  "Genera HTML estático con CSS inline que respete el wireframe ASCII. Solo HTML completo, sin markdown.",
);
