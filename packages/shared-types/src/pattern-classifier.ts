/**
 * @fileoverview Pattern classifier for markdown content repair pipeline.
 * Classifies text content (code blocks or prose) into domain-specific patterns
 * so the repair pipeline can dispatch to the appropriate repairer.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type ContentPattern =
  | "mermaid"
  | "sql"
  | "dockerfile"
  | "docker-compose"
  | "env"
  | "json"
  | "yaml"
  | "markdown"
  | "directory-tree"
  | "unknown";

export interface ClassificationResult {
  pattern: ContentPattern;
  confidence: number;
  /** Extra metadata (e.g. mermaid diagram type) */
  meta?: Record<string, unknown>;
}

// ─── Classification Functions ───────────────────────────────────────────

/**
 * Classify mermaid diagram type from body text.
 */
function classifyMermaidType(body: string): string | null {
  const trimmed = body.trim();
  if (/^graph\s+(TD|LR|TB|BT|RL)\b/i.test(trimmed)) return "flowchart";
  if (/^sequenceDiagram\b/i.test(trimmed)) return "sequence";
  if (/^classDiagram\b/i.test(trimmed)) return "class";
  if (/^erDiagram\b/i.test(trimmed)) return "er";
  if (/^gantt\b/i.test(trimmed)) return "gantt";
  if (/^pie\b/i.test(trimmed)) return "pie";
  if (/^stateDiagram\b/i.test(trimmed)) return "state";
  if (/^gitGraph\b/i.test(trimmed)) return "gitGraph";
  return null;
}

/**
 * Check if text looks like a mermaid diagram body.
 */
function looksLikeMermaid(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  // Mermaid diagrams start with a type keyword
  if (/^graph\s+(TD|LR|TB|BT|RL)\b/i.test(trimmed)) return true;
  if (/^(sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram|gitGraph|journey|mindmap|timeline)\b/i.test(trimmed)) return true;
  // Has arrow operators typical of mermaid
  if (/--?>|<\s*--|--\s*o|==>/i.test(trimmed) && /[\[\({]/.test(trimmed)) return true;
  return false;
}

/**
 * Check if text looks like SQL.
 */
function looksLikeSql(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  const sqlKeywords = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|REFERENCES|TABLE|INDEX|CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|DEFAULT|NOT\s+NULL)\b/i;
  if (sqlKeywords.test(trimmed)) return true;
  if (/CREATE\s+TABLE/i.test(trimmed) && /\(/.test(trimmed)) return true;
  if (/regiON\s+estado\s*\(/i.test(trimmed)) return true;
  // Collapsed SQL tokens
  if (/_NOT_NULL|_REFERENCES|_VARCHAR|_TEXT|_JSONB|_BOOLEAN|_INTEGER|_BIGINT|_TIMESTAMPTZ/i.test(trimmed)) return true;
  return false;
}

/**
 * Check if text looks like a Dockerfile.
 */
function looksLikeDockerfile(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  const dockerInstr = /^(FROM|WORKDIR|RUN|COPY|CMD|EXPOSE|USER|ENV|ARG|ADD|VOLUME|ENTRYPOINT|STOPSIGNAL|HEALTHCHECK|SHELL|ONBUILD|MAINTAINER)(\s|$)/im;
  if (dockerInstr.test(trimmed)) return true;
  if (/^#\s*----/m.test(trimmed) && dockerInstr.test(trimmed)) return true;
  return false;
}

/**
 * Check if text looks like a docker-compose file.
 */
function looksLikeDockerCompose(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  if (/^(services|version)\s*:/m.test(trimmed)) return true;
  if (/^\s+(postgres|redis|api|backend|frontend|nginx|worker)\s*:/m.test(trimmed)) return true;
  if (/image\s*:\s*\S+/m.test(trimmed) && /ports\s*:/m.test(trimmed)) return true;
  return false;
}

/**
 * Check if text looks like an .env file.
 */
function looksLikeEnvFile(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  const envLines = trimmed.split("\n").filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l.trim()));
  return envLines.length >= 2;
}

/**
 * Check if text looks like JSON.
 */
function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Check if text looks like YAML (not docker-compose, not mermaid).
 */
function looksLikeYaml(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  // Has key: value pairs
  if (/^\w[\w\s]*:\s+/m.test(trimmed)) {
    // But not docker-compose
    if (!looksLikeDockerCompose(trimmed)) return true;
  }
  return false;
}

/**
 * Check if text looks like a directory tree.
 */
function looksLikeDirectoryTree(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  // Has tree connectors
  const hasBranches = /[├└│]/.test(trimmed);
  const hasPaths = /(apps|packages|src|backend|frontend|docker|deploy)[/\\]/i.test(trimmed);
  if (hasBranches && hasPaths) return true;
  // Collapsed single-line tree
  const hasMultipleConnectors = ((trimmed.match(/(?:├──|└──|│)/g) ?? []).length) >= 3;
  if (hasMultipleConnectors) return true;
  return false;
}

/**
 * Check if text looks like markdown prose.
 */
function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  // Has headings
  const hasHeadings = /^#{1,6}\s+/m.test(trimmed);
  // Has list items
  const hasLists = /^\s*[-*]\s+/m.test(trimmed) || /^\s*\d+\.\s+/m.test(trimmed);
  // Has bold/italic
  const hasFormatting = /\*\*[^*]+\*\*/m.test(trimmed) || /_[^_]+_/m.test(trimmed);
  // Has links
  const hasLinks = /\[.+\]\(.+\)/m.test(trimmed);
  // At least 2 indicators
  const indicators = [hasHeadings, hasLists, hasFormatting, hasLinks].filter(Boolean).length;
  return indicators >= 2;
}

// ─── Main Classifier ────────────────────────────────────────────────────

/**
 * Classify the content pattern of a text block.
 *
 * @param text - Text to classify (code block body or prose paragraph)
 * @returns Classification result with pattern and confidence
 *
 * @example
 * ```ts
 * const result = classifyPattern("graph TD\n  A --> B")
 * console.log(result.pattern) // "mermaid"
 * ```
 */
export function classifyPattern(text: string): ClassificationResult {
  if (!text?.trim()) {
    return { pattern: "unknown", confidence: 0 };
  }

  const trimmed = text.trim();

  // Priority 1: Explicit mermaid diagram (highest confidence)
  if (looksLikeMermaid(trimmed)) {
    return {
      pattern: "mermaid",
      confidence: 0.95,
      meta: { diagramType: classifyMermaidType(trimmed) },
    };
  }

  // Priority 2: SQL
  if (looksLikeSql(trimmed)) {
    return { pattern: "sql", confidence: 0.9 };
  }

  // Priority 3: Dockerfile
  if (looksLikeDockerfile(trimmed)) {
    return { pattern: "dockerfile", confidence: 0.9 };
  }

  // Priority 4: Docker Compose
  if (looksLikeDockerCompose(trimmed)) {
    return { pattern: "docker-compose", confidence: 0.85 };
  }

  // Priority 5: .env
  if (looksLikeEnvFile(trimmed)) {
    return { pattern: "env", confidence: 0.85 };
  }

  // Priority 6: JSON
  if (looksLikeJson(trimmed)) {
    return { pattern: "json", confidence: 0.9 };
  }

  // Priority 7: Directory tree
  if (looksLikeDirectoryTree(trimmed)) {
    return { pattern: "directory-tree", confidence: 0.8 };
  }

  // Priority 8: YAML
  if (looksLikeYaml(trimmed)) {
    return { pattern: "yaml", confidence: 0.7 };
  }

  // Priority 9: Markdown
  if (looksLikeMarkdown(trimmed)) {
    return { pattern: "markdown", confidence: 0.6 };
  }

  return { pattern: "unknown", confidence: 0.3 };
}

/**
 * Classify a code block given its language tag and body.
 * The language tag provides a strong hint; the body confirms.
 *
 * @param lang - Language tag from the code fence (may be empty)
 * @param body - Code block body
 * @returns Classification result
 */
export function classifyCodeBlock(lang: string | null | undefined, body: string): ClassificationResult {
  const normalized = (lang ?? "").toLowerCase().trim();

  // Language tag provides strong signal
  if (normalized === "mermaid") {
    return {
      pattern: "mermaid",
      confidence: 0.99,
      meta: { diagramType: classifyMermaidType(body) },
    };
  }
  if (normalized === "sql" || normalized === "postgresql" || normalized === "postgres") {
    return { pattern: "sql", confidence: 0.99 };
  }
  if (normalized === "dockerfile") {
    return { pattern: "dockerfile", confidence: 0.99 };
  }
  if (normalized === "json") {
    return { pattern: "json", confidence: 0.99 };
  }
  if (normalized === "yaml" || normalized === "yml") {
    return { pattern: "yaml", confidence: 0.99 };
  }
  if (normalized === "env" || normalized === "dotenv") {
    return { pattern: "env", confidence: 0.99 };
  }
  if (normalized === "text" || normalized === "plaintext") {
    // Text fences might be directory trees
    if (looksLikeDirectoryTree(body)) {
      return { pattern: "directory-tree", confidence: 0.85 };
    }
    return { pattern: "unknown", confidence: 0.5 };
  }
  if (normalized === "markdown" || normalized === "md") {
    return { pattern: "markdown", confidence: 0.95 };
  }

  // No language tag — fall back to body analysis
  return classifyPattern(body);
}
