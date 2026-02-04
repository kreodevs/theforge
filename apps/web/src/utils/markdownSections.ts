/**
 * Divide el markdown en secciones por cabeceras (##, ###, etc.)
 * para permitir actualización por secciones y evitar parpadeo al hacer streaming.
 */

export interface MarkdownSection {
  id: string;
  content: string;
}

/**
 * Parsea el contenido markdown en secciones.
 * Cada cabecera (# ... ## ... ###) inicia una nueva sección con id estable (slug del título).
 * El contenido antes de la primera cabecera es la sección "preamble".
 */
export function parseMarkdownSections(content: string | null): MarkdownSection[] {
  if (!content?.trim()) {
    return [{ id: "preamble", content: "*Sin contenido aún.*" }];
  }

  const lines = content.split("\n");
  const sections: MarkdownSection[] = [];
  let current: { id: string; lines: string[] } = { id: "preamble", lines: [] };
  let sectionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const headerMatch = line.match(/^(#{1,6})\s+.+/);

    if (headerMatch) {
      if (current.lines.length > 0) {
        sections.push({
          id: current.id,
          content: current.lines.join("\n").trim(),
        });
      }
      current = {
        id: `section-${sectionIndex}`,
        lines: [line],
      };
      sectionIndex++;
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.length > 0) {
    sections.push({
      id: current.id,
      content: current.lines.join("\n").trim(),
    });
  }

  return sections.length > 0 ? sections : [{ id: "preamble", content }];
}
