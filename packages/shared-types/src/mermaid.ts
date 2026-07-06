/**
 * @fileoverview **Experta en diagramas Mermaid** — única fuente de verdad para generar y normalizar
 * diagramas Mermaid en todo TheForge. Cubre todos los tipos de diagrama comunes.
 *
 * ## Reglas de normalización
 *
 * 1. Node IDs sin espacios (reemplazar con guiones o underscores).
 * 2. Quotes consistentes (double quotes para labels con espacios/símbolos).
 * 3. Bloques alt/end siempre cerrados en sequence diagrams.
 * 4. Participants siempre declarados en sequence diagrams.
 * 5. Arrows con sintaxis correcta (->> vs -->> vs -x vs --x).
 * 6. Subgraph siempre con `end`.
 * 7. Sin líneas en blanco dentro de bloques que no las soporten.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type MermaidDiagramType =
  | "flowchart"
  | "sequenceDiagram"
  | "classDiagram"
  | "erDiagram"
  | "stateDiagram"
  | "stateDiagram-v2"
  | "gantt"
  | "pie"
  | "gitGraph"
  | "quadrantChart"
  | "mindmap"
  | "timeline"
  | "xychart"
  | "block"
  | "packet";

export type FlowchartDirection = "TD" | "LR" | "BT" | "RL";

export interface FlowchartOptions {
  direction?: FlowchartDirection;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs?: FlowchartSubgraph[];
}

export interface FlowchartNode {
  id: string;
  label: string;
  shape?: "box" | "rounded" | "circle" | "diamond" | "hexagon" | "parallelogram" | "stadium" | "trapezoid";
  style?: Record<string, string>;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  type?: "arrow" | "dotted" | "thick" | "both" | "open";
}

export interface FlowchartSubgraph {
  id: string;
  label: string;
  nodes: string[];
}

export interface SequenceOptions {
  title?: string;
  participants: string[];
  messages: SequenceMessage[];
  /** Notas (por el costado) */
  notes?: SequenceNote[];
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  type?: "->" | "->>" | "-->" | "-->>" | "-x" | "--x" | "=>>" | "->>+" | "->>-" | "-->+" | "-->>-";
  /** Para alt/opt/loop/par */
  block?: { type: "alt" | "opt" | "loop" | "par" | "critical" | "break"; label: string };
}

export interface SequenceNote {
  position: "right of" | "left of" | "over";
  actor: string;
  text: string;
}

export interface ClassOptions {
  title?: string;
  classes: ClassDef[];
  relations: ClassRelation[];
}

export interface ClassDef {
  name: string;
  stereotype?: string;
  members: string[];
  methods: string[];
}

export interface ClassRelation {
  from: string;
  to: string;
  type: "inheritance" | "composition" | "aggregation" | "association" | "dependency" | "realization";
  label?: string;
  fromMultiplicity?: string;
  toMultiplicity?: string;
}

export interface EROptions {
  title?: string;
  entities: EREntity[];
  relations: ERRelation[];
}

export interface EREntity {
  name: string;
  attributes: ERAttribute[];
}

export interface ERAttribute {
  name: string;
  type: string;
  key?: boolean;
}

export interface ERRelation {
  from: string;
  to: string;
  type: "1:1" | "1:N" | "N:M";
  label?: string;
}

export type MermaidInput =
  | { type: "flowchart"; options: FlowchartOptions }
  | { type: "sequenceDiagram"; options: SequenceOptions }
  | { type: "classDiagram"; options: ClassOptions }
  | { type: "erDiagram"; options: EROptions }
  | { type: "gantt"; options: GanttOptions }
  | { type: "stateDiagram"; options: StateOptions }
  | { type: "pie"; options: PieOptions }
  | { type: "gitGraph"; options: GitGraphOptions };

// ─── Gantt ──────────────────────────────────────────────────────────────

export interface GanttOptions {
  title?: string;
  dateFormat?: string;
  axisFormat?: string;
  tasks: GanttTask[];
}

export interface GanttTask {
  id: string;
  label: string;
  start: string;
  end: string;
  dependsOn?: string;
}

// ─── State Diagram ──────────────────────────────────────────────────────

export interface StateOptions {
  title?: string;
  states: string[];
  transitions: StateTransition[];
  /** State con sub-estados */
  composites?: StateComposite[];
}

export interface StateTransition {
  from: string;
  to: string;
  label?: string;
}

export interface StateComposite {
  name: string;
  children: string[];
}

// ─── Pie ────────────────────────────────────────────────────────────────

export interface PieOptions {
  title?: string;
  slices: { label: string; value: number }[];
}

// ─── GitGraph ───────────────────────────────────────────────────────────

export interface GitGraphOptions {
  title?: string;
  commits: GitCommit[];
  branches?: GitBranch[];
}

export interface GitCommit {
  branch: string;
  label: string;
  type?: "commit" | "cherry-pick" | "tag";
}

export interface GitBranch {
  name: string;
  from?: string; // commit id or "main"
  order?: number;
}

// ─── Validation Helpers ────────────────────────────────────────────────


function cleanId(id: string): string {
  // Node IDs cannot have spaces. Replace with underscore.
  return id.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
}

function q(label: string): string {
  // Wrap in double quotes if it contains special chars
  if (/[^\w\sáéíóúñü-]/i.test(label) || /^[A-Z][a-z]/.test(label) && label.includes(" ")) {
    return `"${label.replace(/"/g, "#quot;")}"`;
  }
  if (/\s/.test(label) || /[^\w-]/.test(label)) {
    return `"${label.replace(/"/g, "#quot;")}"`;
  }
  return label;
}

function shapeWrap(nodeId: string, label: string, shape?: string): string {
  const id = cleanId(nodeId);
  switch (shape) {
    case "rounded":    return `${id}(${q(label)})`;
    case "circle":     return `${id}((${q(label)}))`;
    case "diamond":    return `${id}{${q(label)}}`;
    case "hexagon":    return `${id}{{${q(label)}}}`;
    case "parallelogram": return `${id}[/${q(label)}/]`;
    case "stadium":     return `${id}([${q(label)}])`;
    case "trapezoid":   return `${id}[/${q(label)}\\]`;
    case "box":
    default:           return `${id}[${q(label)}]`;
  }
}

const ARROW_MAP: Record<string, string> = {
  "->":    "-->",
  "->>":   "-->>",
  "-->":   "-->",
  "-->>":  "-->>",
  "-x":    "--x",
  "--x":   "--x",
  "=>>":   "=>>",
  "->>+":  "-->>+",
  "->>-":  "-->>-",
  "-->+":  "-->>+",
  "-->>-": "-->>-",
};

function arrow(a: string): string {
  return ARROW_MAP[a] ?? "-->>";
}

const ER_REL_MAP: Record<string, string> = {
  "1:1": "||--||",
  "1:N": "||--o{",
  "N:M": "}o--o{",
};

const CLASS_REL_MAP: Record<string, string> = {
  inheritance:  "<|--",
  composition:  "*--",
  aggregation:  "o--",
  association:  "-->",
  dependency:   "..>",
  realization:  "<|..",
};

// ─── Generators ─────────────────────────────────────────────────────────

function generateFlowchart(opts: FlowchartOptions): string[] {
  const lines: string[] = [];
  const dir = opts.direction ?? "TD";
  lines.push(`graph ${dir}`);

  // Subgraphs first
  if (opts.subgraphs) {
    for (const sg of opts.subgraphs) {
      lines.push(`  subgraph ${q(sg.label)}`);
      for (const nid of sg.nodes) {
        // Don't re-declare nodes in subgraph unless they have a shape
        const node = opts.nodes.find((n) => n.id === nid);
        if (node && node.shape) {
          lines.push(`    ${shapeWrap(nid, node.label, node.shape)}`);
        } else {
          // Just reference the node
          lines.push(`    ${cleanId(nid)}`);
        }
      }
      lines.push("  end");
    }
  }

  // Nodes (skip those already handled in subgraphs)
  const sgNodeIds = new Set(opts.subgraphs?.flatMap((sg) => sg.nodes) ?? []);
  for (const node of opts.nodes) {
    if (!sgNodeIds.has(node.id)) {
      lines.push(`  ${shapeWrap(node.id, node.label, node.shape)}`);
    }
  }

  // Edges
  for (const edge of opts.edges) {
    const arrowType = arrow(edge.type ?? "->>");
    const fromId = cleanId(edge.from);
    const toId = cleanId(edge.to);
    const label = edge.label ? `|${edge.label}|` : "";
    lines.push(`  ${fromId} ${arrowType}${label} ${toId}`);
  }

  return lines;
}

function generateSequence(opts: SequenceOptions): string[] {
  const lines: string[] = [];
  lines.push("sequenceDiagram");

  if (opts.title) lines.push(`  title ${q(opts.title)}`);

  for (const p of opts.participants) {
    lines.push(`  participant ${cleanId(p)} as ${q(p)}`);
  }

  if (opts.notes) {
    for (const note of opts.notes) {
      lines.push(`  Note ${note.position} ${cleanId(note.actor)}: ${note.text}`);
    }
  }

  for (const msg of opts.messages) {
    if (msg.block) {
      lines.push(`  ${msg.block.type} ${q(msg.block.label)}`);
    }
    const a = arrow(msg.type ?? "->>");
    lines.push(`  ${cleanId(msg.from)}${a}${cleanId(msg.to)}: ${q(msg.label)}`);
  }

  // Cerrar bloques abiertos
  const blockCount = opts.messages.filter((m) => m.block).length;
  for (let i = 0; i < blockCount; i++) {
    lines.push("  end");
  }

  return lines;
}

function generateClassDiagram(opts: ClassOptions): string[] {
  const lines: string[] = [];
  lines.push("classDiagram");

  if (opts.title) lines.push(`  title ${q(opts.title)}`);

  for (const cls of opts.classes) {
    const stereo = cls.stereotype ? ` <<${cls.stereotype}>>` : "";
    lines.push(`  class ${cleanId(cls.name)}${stereo}`);
    for (const m of cls.members) {
      lines.push(`  ${cleanId(cls.name)} : ${m}`);
    }
    for (const m of cls.methods) {
      lines.push(`  ${cleanId(cls.name)} : ${m}`);
    }
  }

  for (const rel of opts.relations) {
    const arrowType = CLASS_REL_MAP[rel.type] ?? "-->";
    const label = rel.label ? ` : ${rel.label}` : "";
    const fromCard = rel.fromMultiplicity ? ` "${rel.fromMultiplicity}"` : "";
    const toCard = rel.toMultiplicity ? ` "${rel.toMultiplicity}"` : "";
    lines.push(`  ${cleanId(rel.from)}${fromCard} ${arrowType}${toCard} ${cleanId(rel.to)}${label}`);
  }

  return lines;
}

function generateER(opts: EROptions): string[] {
  const lines: string[] = [];
  lines.push("erDiagram");

  for (const ent of opts.entities) {
    const attrs = ent.attributes.map((a) => {
      const pk = a.key ? " PK" : "";
      return `    ${a.type} ${a.name}${pk}`;
    });
    lines.push(`  ${cleanId(ent.name)} {`);
    lines.push(...attrs);
    lines.push("  }");
  }

  for (const rel of opts.relations) {
    const arrowType = ER_REL_MAP[rel.type] ?? "||--o{";
    const label = rel.label ? ` : ${rel.label}` : "";
    lines.push(`  ${cleanId(rel.from)} ${arrowType} ${cleanId(rel.to)}${label}`);
  }

  return lines;
}

function generateGantt(opts: GanttOptions): string[] {
  const lines: string[] = [];
  lines.push("gantt");
  lines.push("  dateFormat  " + (opts.dateFormat ?? "YYYY-MM-DD"));
  lines.push("  axisFormat  " + (opts.axisFormat ?? "%b %d"));
  if (opts.title) lines.push(`  title ${q(opts.title)}`);

  for (const task of opts.tasks) {
    const dep = task.dependsOn ? ` after ${cleanId(task.dependsOn)}` : "";
    lines.push(`  ${q(task.label)} : ${cleanId(task.id)}, ${task.start}, ${task.end}${dep}`);
  }

  return lines;
}

function generateState(opts: StateOptions): string[] {
  const lines: string[] = [];
  lines.push("stateDiagram-v2");

  if (opts.title) lines.push(`  title ${q(opts.title)}`);

  if (opts.composites) {
    for (const comp of opts.composites) {
      lines.push(`  state ${cleanId(comp.name)} {`);
      for (const child of comp.children) {
        lines.push(`    ${cleanId(child)}`);
      }
      lines.push("  }");
    }
  }

  for (const s of opts.states) {
    const isInComposite = opts.composites?.some((c) => c.children.includes(s));
    if (!isInComposite && !opts.composites?.some((c) => c.name === s)) {
      lines.push(`  ${cleanId(s)}`);
    }
  }

  for (const t of opts.transitions) {
    const label = t.label ? `: ${t.label}` : "";
    lines.push(`  ${cleanId(t.from)} --> ${cleanId(t.to)}${label}`);
  }

  return lines;
}

function generatePie(opts: PieOptions): string[] {
  const lines: string[] = [];
  lines.push("pie");
  if (opts.title) lines.push(`  title ${q(opts.title)}`);
  for (const slice of opts.slices) {
    lines.push(`  "${slice.label}" : ${slice.value}`);
  }
  return lines;
}

function generateGitGraph(opts: GitGraphOptions): string[] {
  const lines: string[] = [];
  lines.push("gitGraph");

  if (opts.branches) {
    for (const b of opts.branches) {
      lines.push(`  branch ${cleanId(b.name)}`);
    }
  }

  for (const c of opts.commits) {
    const prefix = c.type === "tag" ? "  tag" : c.type === "cherry-pick" ? "  cherry-pick" : "  commit";
    lines.push(`${prefix} id: ${q(c.label)}`);
    if (c.branch !== "main") {
      // checkout if needed
      lines.push(`  checkout ${cleanId(c.branch)}`);
      lines.push(`${prefix} id: ${q(c.label)}`);
    }
  }

  return lines;
}

// ─── Public API ─────────────────────────────────────────────────────────

const GENERATORS: Record<string, (opts: any) => string[]> = {
  flowchart: generateFlowchart,
  sequenceDiagram: generateSequence,
  classDiagram: generateClassDiagram,
  erDiagram: generateER,
  gantt: generateGantt,
  stateDiagram: generateState,
  stateDiagram_v2: generateState,
  pie: generatePie,
  gitGraph: generateGitGraph,
};

/**
 * Genera un diagrama Mermaid válido a partir de datos estructurados.
 *
 * @example
 * ```ts
 * const md = generateMermaid({
 *   type: "flowchart",
 *   options: {
 *     direction: "TD",
 *     nodes: [
 *       { id: "start", label: "Inicio", shape: "rounded" },
 *       { id: "end", label: "Fin", shape: "rounded" },
 *     ],
 *     edges: [
 *       { from: "start", to: "end", label: "Flujo" },
 *     ],
 *   },
 * });
 * ```
 */
export function generateMermaid(input: MermaidInput): string {
  const gen = GENERATORS[input.type];
  if (!gen) return `%% Unknown diagram type: ${input.type}`;
  const lines = gen((input as any).options);
  return "```mermaid\n" + lines.join("\n") + "\n```";
}

// ─── Validate & Fix ─────────────────────────────────────────────────────

/** Decode HTML entities sometimes persisted in stored markdown (breaks quoted subgraph titles). */
export function decodeMermaidHtmlEntities(text: string): string {
  return (text ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Apply a regex replacement only on segments outside double-quoted strings.
 * Prevents corrupting labels like `LLM["Servicio LLM (OpenRouter/TokenLab)"]`.
 */
function replaceOutsideDoubleQuotes(
  line: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): string {
  const parts = line.split(/("[^"]*")/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(pattern, replacer);
    })
    .join("");
}

/**
 * flowchart/graph: quote edge labels with spaces, accents, or `/{}:` so Mermaid 11 parses reliably.
 * Example: `A -->|Comunica vía| B` → `A -->|"Comunica vía"| B`.
 */
export function quoteFlowchartEdgeLabels(content: string): string {
  if (!/^(flowchart|graph)\s/im.test((content ?? "").trim())) return content ?? "";
  const edgeArrow = "(<-->|<--->|--[-=>ox.]*>|==[-=>ox.]*>|-\\.->)";
  const edgeRe = new RegExp(
    `^(\\s*)([A-Za-z0-9_*][\\w*]*)\\s*${edgeArrow}\\s*\\|([^|\\n]+)\\|\\s*([A-Za-z0-9_*][\\w]*(?:\\[[^\\]]*\\]|\\([^\\)]*\\))?)`,
    "gm",
  );
  return content.replace(
    edgeRe,
    (match, indent: string, from: string, arrow: string, label: string, to: string) => {
      const trimmed = label.trim();
      if (!trimmed || /^"/.test(trimmed)) return match;
      if (/[^\x00-\x7F]|\s|\/|[{}:]/.test(trimmed)) {
        const cleaned = trimmed.replace(/"/g, "'").slice(0, MAX_MERMAID_LABEL_CHARS);
        return `${indent}${from} ${arrow}|"${cleaned}"| ${to}`;
      }
      return match;
    },
  );
}

/**
 * Strip fences/leaks and normalize diagram body for `mermaid.render` (no ``` wrappers).
 * Use in MarkdownMermaid / MddViewer before calling the renderer.
 */
export function prepareMermaidDiagramForRender(raw: string): string {
  const { diagram } = splitMermaidBodyAndTrailingProse(raw ?? "");
  let body = decodeMermaidHtmlEntities(stripMermaidFenceWrappers(diagram));
  body = stripMarkdownLeakFromMermaidDiagramBody(body);
  body = normalizeMermaidDiagramBody(body);
  return stripMermaidFenceWrappers(body).trim();
}

/** Comas tipográficas → ASCII antes de reparar anotaciones PK/FK. */
function normalizeMermaidCommas(text: string): string {
  return text.replace(/[\uFF0C\u201A\uFE50\uFE51\u3001]/g, ",");
}

/**
 * erDiagram: Mermaid admite un solo marcador PK o FK por atributo.
 * `uuid user_id PK, FK` y `uuid id PK FK` rompen el parser; si la columna es PK+FK, conservamos PK.
 */
export function repairErDiagramPkFkCommas(content: string): string {
  if (!content?.trim()) return content ?? "";
  const normalized = normalizeMermaidCommas(content);
  return normalized
    .replace(/\bPK\s*,\s*FK\b/gi, "PK")
    .replace(/\bFK\s*,\s*PK\b/gi, "PK")
    .replace(/\bPK\s+FK\b/gi, "PK")
    .replace(/\bFK\s+PK\b/gi, "PK");
}

/** Si el cuerpo parece erDiagram pero falta la declaración inicial, la antepone. */
export function ensureErDiagramHeader(content: string): string {
  const t = (content ?? "").trim();
  if (!t) return t;
  if (/^erDiagram\b/i.test(t)) return t;
  if (/^\s*\w[\w]*\s*\{/m.test(t)) return `erDiagram\n\n${t}`;
  return t;
}

/** Regex de cabecera de diagrama en la primera columna de una línea (sin fence). */
const MERMAID_DIAGRAM_HEADER_LINE =
  /^(erDiagram|flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|xychart|blockDiagram|requirementDiagram)\b/i;

/**
 * Quita envoltorios ``` / ```mermaid (incl. anidados) del cuerpo antes de normalizar o renderizar.
 * Corrige bloques donde el LLM dejó el fence dentro del cuerpo del diagrama.
 */
export function stripMermaidFenceWrappers(raw: string): string {
  let t = (raw ?? "").trim();
  for (let i = 0; i < 5; i++) {
    const next = t
      .replace(/^```(?:mermaid)?[ \t]*\r?\n?/i, "")
      .replace(/\r?\n?```[ \t]*$/i, "")
      .trim();
    if (next === t) break;
    t = next;
  }
  return t
    .split("\n")
    .filter((line) => !/^```(?:mermaid)?[ \t]*$/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Repara cabeceras duplicadas o pegadas (`erDiagramerDiagram`, dos `erDiagram` consecutivos).
 */
export function dedupeMermaidDiagramHeader(raw: string): string {
  const lines = (raw ?? "").split("\n").map((line) =>
    line
      .replace(/^erDiagramerDiagram\b/i, "erDiagram")
      .replace(/^stateDiagram-v2stateDiagram-v2\b/i, "stateDiagram-v2")
      .replace(/^sequenceDiagramsequenceDiagram\b/i, "sequenceDiagram"),
  );
  let t = lines.join("\n").trim();
  if (!t) return t;
  t = t.replace(/^(erDiagram)\s*\n\s*\1\b/im, "$1");
  t = t.replace(/^(stateDiagram-v2)\s*\n\s*\1\b/im, "$1");
  t = t.replace(/^(stateDiagram)\s*\n\s*\1\b/im, "$1");
  t = t.replace(/^(sequenceDiagram)\s*\n\s*\1\b/im, "$1");
  return t.trim();
}

/**
 * El LLM vuelca `DEFAULT` de SQL como columna ficticia (`uuid default`, `uuid default FK`).
 * Mermaid erDiagram no admite el identificador `default` y el render falla → texto plano.
 */
export function stripErDiagramSqlDefaultArtifacts(content: string): string {
  if (!/^erDiagram\b/im.test((content ?? "").trim())) return content ?? "";
  return content
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t === "}" || /^\w[\w]*\s*\{$/.test(t)) return true;
      if (/^\w[\w]*\s+\|\|/.test(t) || /\|\|--/.test(t) || /:\s/.test(t)) return true;
      return !/^\w+\s+default(\s+(?:PK|FK|UK))*\s*$/i.test(t);
    })
    .join("\n");
}

/** Tipos PostgreSQL → tipos Mermaid seguros en erDiagram. */
export function normalizeErDiagramPgTypes(content: string): string {
  return content
    .replace(/\btimestamptz\b/gi, "datetime")
    .replace(/\btimestamp\b/gi, "datetime")
    .replace(/\binet\b/gi, "string")
    .replace(/\bjsonb\b/gi, "json")
    .replace(/\bPK\s*,\s*FK\b/gi, "PK")
    .replace(/\bFK\s*,\s*PK\b/gi, "PK");
}

/**
 * flowchart/graph: `C[NestJS API (Contenedor)]` → `C["NestJS API (Contenedor)"]`.
 * Preserva nodos cilíndricos `[("PostgreSQL · N tablas")]` — no convertir a `["("…")"]`.
 */
export function quoteFlowchartLabelsWithParens(content: string): string {
  if (!content?.trim()) return content ?? "";
  return content.replace(/\[([^\[\]"]*\([^()]*\)[^\[\]"]*)\]/g, (match, inner: string) => {
    const t = inner.trim();
    // Cylinder nodes: [(DB costos)] or [("PostgreSQL · N tablas")]
    if (/^\([^()]*\)$/.test(t)) return match;
    if (/^\(\s*"/.test(t) && /"\s*\)$/.test(t)) return match;
    return `["${inner}"]`;
  });
}

export function erDiagramHasPkFkComma(content: string): boolean {
  const repaired = repairErDiagramPkFkCommas(content);
  return /\bPK\s*,\s*FK\b|\bFK\s*,\s*PK\b/i.test(repaired);
}

/**
 * Valida un diagrama Mermaid existente y devuelve errores encontrados.
 * No modifica el input — solo reporta qué arreglar.
 */
export function validateMermaid(raw: string): string[] {
  const errors: string[] = [];
  if (!raw) return ["Empty mermaid content"];

  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return ["Empty mermaid content"];

  const firstLine = lines[0]!.trim();

  // Detectar tipo
  const typeMatch = firstLine.match(/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|stateDiagram-v2|gantt|pie|gitGraph|quadrantChart|mindmap|timeline|xychart|block|packet)/i);
  if (!typeMatch) {
    errors.push(`Unknown diagram type. First line: "${firstLine}". Must start with a valid mermaid type.`);
  }

  const mermaidType = typeMatch?.[1];

  // Validaciones específicas por tipo
  if (mermaidType === "sequenceDiagram") {
    // Check for unclosed alt/opt/loop/par blocks
    const opens = lines.filter((l) => /^\s*(alt|opt|loop|par|critical|break)\s/.test(l)).length;
    const closes = lines.filter((l) => /^\s*end\s*$/.test(l)).length;
    if (opens > closes) {
      errors.push(`Unclosed block: ${opens} openers but only ${closes} closers (need +${opens - closes} "end")`);
    }
    if (closes > opens) {
      errors.push(`Too many "end": ${closes} closers but only ${opens} openers`);
    }
  }

  if (mermaidType === "flowchart" || mermaidType?.startsWith("graph")) {
    // Check for subgraphs without end
    const subs = lines.filter((l) => /^\s*subgraph\s/.test(l)).length;
    const ends = lines.filter((l) => /^\s*end\s*$/.test(l)).length;
    if (subs > ends) {
      errors.push(`Unclosed subgraph: ${subs} subgraphs but ${ends} ends`);
    }
  }

  // ID sin espacios (nodos flowchart; no aplicar a headers `subgraph ID["…"]`)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (mermaidType === "flowchart" || mermaidType?.startsWith("graph")) {
      if (/^\s*subgraph\s/i.test(l)) continue;
      const nodeIdMatch = l.match(/^\s*([A-Za-z]\w*\s+\w+)\[/);
      if (nodeIdMatch) {
        errors.push(`Line ${i + 1}: Node ID "${nodeIdMatch[1]}" contains spaces`);
      }
    }
  }

  return errors;
}

/** Prefijos markdown que el LLM suele anteponer a líneas Mermaid fugadas (incl. viñeta unicode •). */
const MERMAID_LEAKED_LIST_PREFIX_RE =
  /^(\s*)(?:#{1,6}\s+|[-*•\u2022\u2023\u25E6\u2043\u2219]\s+|\d+[.)]\s+)/;

/** Flechas flowchart/sequence o cardinalidad erDiagram en una línea. */
const MERMAID_ARROW_OR_ER_RE =
  /(-+>>|->>|--x|-x>|--+>|==+>|-\.-+>|---|\}\|\-{1,2}|\|\|\-{1,2}|\|\|\-\-o\{|\}o\-\-|\-\-o\{|\}o\-\-o\{|o\-\-o\{)/;

/** Tope de longitud de etiqueta Mermaid: alto a propósito (solo corta prosa desbocada). */
const MAX_MERMAID_LABEL_CHARS = 120;

/** Línea markdown fuera del fence que en realidad es sintaxis sequenceDiagram. */
function sequenceLineCore(trimmed: string): string {
  return trimmed
    .replace(/^(\s*)#{1,6}\s+/, "$1")
    .replace(/^(\s*)[-*•\u2022\u2023\u25E6\u2043\u2219]\s+/, "$1")
    .replace(/^(\s*)\d+[.)]\s+/, "$1")
    .trim();
}

export function isOrphanSequenceDiagramLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+\.\s/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = sequenceLineCore(trimmed);
  if (!core) return false;
  if (/^sequenceDiagram\b/i.test(core)) return false;

  if (/^(participant|actor)\s/i.test(core)) return true;
  if (/^Note over\b/i.test(core)) return true;
  if (/^(alt|opt|loop|par|critical|break|rect|else|and|end)\b/i.test(core)) return true;
  if (/(-+>>|->>|--x|-x>)/.test(core)) return true;
  return false;
}

function normalizeOrphanSequenceDiagramLine(line: string): string {
  let s = line.replace(/^(\s*)#{1,6}\s+/, "$1");
  const trimmed = s.trim();
  if (
    MERMAID_LEAKED_LIST_PREFIX_RE.test(s) &&
    (MERMAID_ARROW_OR_ER_RE.test(s) ||
      isOrphanSequenceDiagramLine(trimmed) ||
      isOrphanFlowchartLine(trimmed) ||
      isOrphanErDiagramLine(trimmed) ||
      isOrphanStateDiagramLine(trimmed))
  ) {
    s = s.replace(MERMAID_LEAKED_LIST_PREFIX_RE, "$1    ");
  }
  return s;
}

/**
 * Línea markdown fuera del fence que en realidad es sintaxis flowchart/graph
 * (aristas `A --> B`, `A -->|label| B`, `subgraph`, `end`). Permite re-absorber aristas
 * que el LLM dejó tras cerrar el fence prematuramente (`### A -->|x| B`, `- A --> B`).
 */
export function isOrphanFlowchartLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+[.)]/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = sequenceLineCore(trimmed);
  if (!core) return false;
  if (/^(flowchart|graph)\b/i.test(core)) return false;
  if (/^(subgraph|end|direction)\b/i.test(core)) return true;
  // Edge: a node token followed by a flowchart arrow (-->, ---, ==>, -.->), optionally with |label|.
  if (/^[A-Za-z0-9_]/.test(core) && /(--+>|==+>|-\.-+>|---)/.test(core)) return true;
  return false;
}

/**
 * Línea markdown fuera del fence que en realidad es sintaxis erDiagram
 * (bloque de entidad `ENTIDAD {` o relación `A }o--o{ B : "label"`).
 */
export function isOrphanErDiagramLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+[.)]/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;

  const core = sequenceLineCore(trimmed);
  if (!core) return false;
  if (/^erDiagram\b/i.test(core)) return false;
  if (/^[A-Za-z][\w\s]*\s*\{/.test(core)) return true;
  if (MERMAID_ARROW_OR_ER_RE.test(core) && /[A-Za-z0-9_]/.test(core)) return true;
  return false;
}

/**
 * Línea markdown fuera del fence que en realidad es sintaxis stateDiagram(-v2)
 * (`[*] --> Idle`, `Idle --> Calculando: evento`, transiciones con viñeta `-`).
 */
export function isOrphanStateDiagramLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return false;
  if (/^#{1,2}\s+\d+[.)]/.test(trimmed)) return false;
  if (/^#{1,6}\s+\d+\.\d+\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^---+\s*$/.test(trimmed)) return false;
  // Encabezados markdown (#### Flujo N:) no son transiciones de estado.
  if (/^#{1,6}\s+/.test(trimmed) && !/(-->|--+)/.test(trimmed)) return false;

  const core = sequenceLineCore(trimmed);
  if (!core) return false;
  if (/^stateDiagram(?:-v2)?\b/i.test(core)) return false;
  if (/^\[\*\]/.test(core)) return true;
  if (/([\w[\]*]+)\s*-->/.test(core)) return true;
  if (/^(note|direction|state)\b/i.test(core)) return true;
  return false;
}

type UnfencedDiagramKind = "flowchart" | "erDiagram" | "sequenceDiagram" | "stateDiagram";

function parseUnfencedDiagramHeader(trimmed: string): UnfencedDiagramKind | null {
  const core = sequenceLineCore(trimmed);
  if (/^erDiagram\b/i.test(core)) return "erDiagram";
  if (/^sequenceDiagram\b/i.test(core)) return "sequenceDiagram";
  if (/^stateDiagram-v2\b/i.test(core)) return "stateDiagram";
  if (/^stateDiagram\b/i.test(core)) return "stateDiagram";
  if (/^(flowchart|graph)\b/i.test(core)) return "flowchart";
  return null;
}

function isUnfencedMermaidBlockTerminator(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^#{1,6}\s+/.test(trimmed)) {
    if (
      isOrphanSequenceDiagramLine(trimmed) ||
      isOrphanFlowchartLine(trimmed) ||
      isOrphanErDiagramLine(trimmed) ||
      isOrphanStateDiagramLine(trimmed)
    ) {
      return false;
    }
    return true;
  }
  if (/^\|/.test(trimmed)) return true;
  if (/^---+\s*$/.test(trimmed)) return true;
  return false;
}

function isUnfencedMermaidBodyLine(trimmed: string, kind: UnfencedDiagramKind): boolean {
  if (!trimmed) return false;
  if (
    isOrphanFlowchartLine(trimmed) ||
    isOrphanSequenceDiagramLine(trimmed) ||
    isOrphanErDiagramLine(trimmed) ||
    isOrphanStateDiagramLine(trimmed)
  ) {
    return true;
  }
  const core = sequenceLineCore(trimmed);
  if (!core) return false;

  if (kind === "flowchart") {
    if (/^[A-Za-z0-9_][\w]*(\[|\(|\{)/.test(core)) return true;
    if (/^[A-Za-z0-9_]/.test(core) && /[\]\)"']?\s*(--+>|==+>|-\.-+>)/.test(core)) return true;
  }
  if (kind === "erDiagram") {
    if (/^\}\s*$/.test(core)) return true;
    if (/^[a-zA-Z_][\w]*\s+[a-zA-Z_][\w]*/.test(core) && !/(--+>|->>|--x)/.test(core)) return true;
  }
  if (kind === "sequenceDiagram") {
    if (/^\s{2,}\S/.test(trimmed) && /(-+>>|->>|--x|-x>)/.test(trimmed)) return true;
    if (/^(alt|opt|loop|par|critical|break|else|and|end|rect)\b/i.test(core)) return true;
  }
  if (kind === "stateDiagram") {
    if (/^[\w[\]*\s-]+\s*-->/.test(core)) return true;
  }
  return false;
}

function collectUnfencedMermaidBlock(
  lines: string[],
  startIdx: number,
  kind: UnfencedDiagramKind,
): { endIdx: number; rawLines: string[] } {
  const rawLines = [lines[startIdx]!];
  let i = startIdx + 1;
  while (i < lines.length) {
    const trimmed = lines[i]!.trim();
    if (/^```/.test(trimmed)) break;
    if (i > startIdx && parseUnfencedDiagramHeader(trimmed)) break;
    if (isUnfencedMermaidBlockTerminator(trimmed)) break;
    if (!trimmed) {
      let k = i + 1;
      while (k < lines.length && !lines[k]!.trim()) k++;
      const next = k < lines.length ? lines[k]!.trim() : "";
      if (!next || isUnfencedMermaidBlockTerminator(next) || parseUnfencedDiagramHeader(next)) break;
    }
    if (!trimmed || isUnfencedMermaidBodyLine(trimmed, kind)) {
      rawLines.push(lines[i]!);
      i++;
      continue;
    }
    break;
  }
  return { endIdx: i, rawLines };
}

function normalizeUnfencedMermaidLine(line: string): string {
  const trimmed = line.trim();
  if (
    MERMAID_LEAKED_LIST_PREFIX_RE.test(line) &&
    (MERMAID_ARROW_OR_ER_RE.test(line) ||
      isOrphanSequenceDiagramLine(trimmed) ||
      isOrphanFlowchartLine(trimmed) ||
      isOrphanErDiagramLine(trimmed) ||
      isOrphanStateDiagramLine(trimmed))
  ) {
    return line.replace(MERMAID_LEAKED_LIST_PREFIX_RE, "$1    ");
  }
  return normalizeOrphanSequenceDiagramLine(line);
}

/**
 * Envuelve diagramas Mermaid volcados como markdown plano (sin fence ```mermaid).
 * Patrón recurrente del LLM: `flowchart LR` / `erDiagram` / `stateDiagram-v2` como texto,
 * aristas como listas `- A --> B`, relaciones ER como viñetas fuera de cualquier fence.
 */
export function repairUnfencedMermaidInDocument(document: string): string {
  if (!document?.trim()) return document ?? "";

  const lines = document.split("\n");
  const out: string[] = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }

    const kind = !inFence ? parseUnfencedDiagramHeader(trimmed) : null;
    if (kind) {
      const { endIdx, rawLines } = collectUnfencedMermaidBlock(lines, i, kind);
      const body = rawLines.map(normalizeUnfencedMermaidLine).join("\n").trim();
      const normalized = normalizeMermaidDiagramBody(body);
      if (normalized) {
        if (out.length > 0 && out[out.length - 1]!.trim() !== "") out.push("");
        out.push("```mermaid");
        out.push(normalized);
        out.push("```");
        if (endIdx < lines.length && lines[endIdx]?.trim()) out.push("");
      } else {
        out.push(...rawLines);
      }
      i = endIdx;
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join("\n");
}

/**
 * Fusiona líneas sequenceDiagram rotas fuera del fence (### Foo->>Bar, viñetas con flechas)
 * en el bloque ```mermaid precedente.
 */
export function repairFragmentedSequenceMermaidInDocument(document: string): string {
  if (!document?.trim()) return document ?? "";

  const lines = document.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!/^```mermaid\s*$/i.test(line.trim())) {
      out.push(line);
      i++;
      continue;
    }

    out.push(line);
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
      bodyLines.push(lines[i]!);
      i++;
    }

    if (i >= lines.length) {
      out.push(...bodyLines);
      break;
    }

    const bodyText = bodyLines.join("\n");
    const isSequence = /sequenceDiagram/i.test(bodyText);
    const isFlowchart = /^\s*(flowchart|graph)\b/im.test(bodyText);
    const isErDiagram = /^erDiagram\b/im.test(bodyText.trim());
    const isStateDiagram = /^stateDiagram(?:-v2)?\b/im.test(bodyText.trim());
    const orphanPred = isSequence
      ? isOrphanSequenceDiagramLine
      : isFlowchart
        ? isOrphanFlowchartLine
        : isErDiagram
          ? isOrphanErDiagramLine
          : isStateDiagram
            ? isOrphanStateDiagramLine
            : null;

    if (orphanPred) {
      i++;
      while (i < lines.length) {
        const trimmed = lines[i]!.trim();
        if (!trimmed) {
          let j = i + 1;
          while (j < lines.length && !lines[j]!.trim()) j++;
          if (j < lines.length && orphanPred(lines[j]!.trim())) {
            i++;
            continue;
          }
          break;
        }
        if (!orphanPred(trimmed)) break;
        bodyLines.push(normalizeOrphanSequenceDiagramLine(lines[i]!));
        i++;
      }
    } else {
      i++;
    }

    out.push(...bodyLines);
    out.push("```");
  }

  return out.join("\n");
}

/** Una línea (sin prefijo de lista/encabezado) parece sintaxis de continuación Mermaid. */
function isMermaidStatementCore(core: string): boolean {
  if (!core) return false;
  if (/(-+>>|->>|--x|-x>)/.test(core)) return true;
  if (/(--+>|==+>|-\.-+>|---)/.test(core) && /^[A-Za-z0-9_]/.test(core)) return true;
  if (MERMAID_ARROW_OR_ER_RE.test(core) && /^[A-Za-z0-9_]/.test(core)) return true;
  if (/^[A-Za-z][\w\s]*\s*\{/.test(core)) return true;
  if (/^[\w[\]\s-]+\s*-->/.test(core)) return true;
  if (/^[\w[\]\s-]+\s*:\s*\S/.test(core) && /-->/.test(core)) return true;
  if (
    /^(participant|actor|Note\b|alt\b|opt\b|loop\b|par\b|critical\b|break\b|else\b|and\b|end\b|subgraph\b|direction\b|rect\b)/i.test(
      core,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Separa el cuerpo de un SEGUNDO fence en (continuación del diagrama anterior) + (resto que es
 * prosa de la sección siguiente). Causa: el LLM cierra el fence tras los `participant` y vuelca el
 * resto en otro bloque con lenguaje arbitrario (```dockerfile), un bloque que frecuentemente además
 * envuelve prosa que NO pertenece al diagrama. Tomamos solo el prefijo de líneas que son sintaxis
 * Mermaid y devolvemos el remanente para re-emitirlo como markdown.
 *
 * Devuelve null si el segundo fence no es continuación (arranca su propia declaración de diagrama,
 * o su primera línea con contenido no es sintaxis Mermaid): en ese caso son dos diagramas distintos.
 */
function splitMermaidContinuationPrefix(
  body: string,
): { continuation: string[]; remainder: string[] } | null {
  const lines = body.split("\n");

  let f = 0;
  while (f < lines.length && !lines[f]!.trim()) f++;
  if (f >= lines.length) return null;
  if (
    /^(flowchart|graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram(?:-v2)?|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|xychart)\b/i.test(
      lines[f]!.trim(),
    )
  ) {
    return null;
  }

  const continuation: string[] = [];
  let hits = 0;
  let stop = -1;
  for (let idx = 0; idx < lines.length; idx++) {
    const t = lines[idx]!.trim();
    if (!t) {
      let j = idx + 1;
      while (j < lines.length && !lines[j]!.trim()) j++;
      if (j < lines.length && isMermaidStatementCore(sequenceLineCore(lines[j]!.trim()))) {
        continuation.push(lines[idx]!);
        continue;
      }
      stop = idx;
      break;
    }
    if (isMermaidStatementCore(sequenceLineCore(t))) {
      continuation.push(lines[idx]!);
      hits++;
      continue;
    }
    stop = idx;
    break;
  }

  if (hits < 1) return null;
  const remainder = stop >= 0 ? lines.slice(stop) : [];
  return { continuation, remainder };
}

/** Quita prefijo de lista/encabezado fugado (`- `, `* `, `• `, `### `) de una línea de continuación. */
function stripLeakedMermaidLinePrefix(line: string): string {
  return line.replace(MERMAID_LEAKED_LIST_PREFIX_RE, "$1    ").replace(/[ \t]+$/, "");
}

/** Entrecomilla mensajes de sequenceDiagram/Note con llaves u objetos JSON que rompen el parser. */
function quoteSequenceDiagramMessageLine(line: string): string {
  const trimmed = line.trim();
  if (/^Note over\b/i.test(trimmed)) {
    return line.replace(/^(Note over\s+[\w,\s]+:\s*)(?!")(.+)$/i, (_m, prefix: string, msg: string) => {
      const t = msg.trim();
      if (!/[{}]/.test(t)) return line;
      return `${prefix}"${t.replace(/"/g, "'").slice(0, MAX_MERMAID_LABEL_CHARS)}"`;
    });
  }
  const m = trimmed.match(
    /^(\s*)([\w-]+)\s*(-+>>|->>|-->>|--x|-x>|--+>|==+>)\s*([\w-]+)\s*:\s*(.+)$/,
  );
  if (!m) return line;
  const [, indent = "", from, arrow, to, msg = ""] = m;
  const message = msg.trim();
  if (!message || /^"/.test(message)) return line;
  if (/[{}]/.test(message) || /\?\w+=/.test(message)) {
    const cleaned = message.replace(/"/g, "'").slice(0, MAX_MERMAID_LABEL_CHARS);
    return `${indent}${from}${arrow}${to}: "${cleaned}"`;
  }
  return line;
}

/**
 * Repara cierre erróneo ` ```mermaid ` en lugar de ` ``` ` (segundo bloque pegado al primero).
 * Típico en sequenceDiagram largos partidos por el LLM.
 */
export function repairMermaidFenceClosedWithMermaidTag(document: string): string {
  if (!document?.trim()) return document ?? "";

  const re = /```mermaid[ \t]*\n([\s\S]*?)```mermaid[ \t]*\n([\s\S]*?)```/gi;
  let prev: string | null = null;
  let cur = document;
  let guard = 0;
  while (prev !== cur && guard < 30) {
    prev = cur;
    cur = cur.replace(re, (match, b1: string, b2: string) => {
      // Dos bloques mermaid legítimos separados por otro fence (p. ej. ```dockerfile): no fusionar.
      if (/\n```[ \t]*(?:\n|$)/.test(b1)) return match;
      const t1 = b1.trim();
      const t2 = b2.trim();
      const sameSequence =
        /^sequenceDiagram\b/im.test(t1) && /^sequenceDiagram\b/im.test(t2);
      if (sameSequence) {
        const cont = t2.replace(/^sequenceDiagram\s*\n?/i, "").trim();
        const merged = `${t1}\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
        return `\`\`\`mermaid\n${merged}\n\`\`\``;
      }
      const sameFlowchart =
        /^(flowchart|graph)\b/im.test(t1) && /^(flowchart|graph)\b/im.test(t2);
      if (sameFlowchart) {
        const cont = t2.replace(/^(flowchart|graph)\s+(?:TD|LR|BT|RL|TB)\s*\n?/i, "").trim();
        const merged = `${t1}\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
        return `\`\`\`mermaid\n${merged}\n\`\`\``;
      }
      const sameErDiagram = /^erDiagram\b/im.test(t1) && /^erDiagram\b/im.test(t2);
      if (sameErDiagram) {
        const cont = t2.replace(/^erDiagram\s*\n?/i, "").trim();
        const merged = `${t1}\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
        return `\`\`\`mermaid\n${merged}\n\`\`\``;
      }
      const sameState =
        /^stateDiagram-v2\b/im.test(t1) && /^stateDiagram-v2\b/im.test(t2);
      if (sameState) {
        const cont = t2.replace(/^stateDiagram-v2\s*\n?/i, "").trim();
        const merged = `${t1}\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
        return `\`\`\`mermaid\n${merged}\n\`\`\``;
      }
      return `\`\`\`mermaid\n${t1}\n\`\`\`\n\n\`\`\`mermaid\n${t2}\n\`\`\``;
    });
    guard++;
  }
  return cur;
}

/**
 * Fusiona un fence ```mermaid seguido de OTRO fence (lenguaje arbitrario o vacío) cuyo cuerpo es
 * continuación del mismo diagrama. Causa típica: el LLM parte un sequenceDiagram/flowchart en dos
 * bloques y etiqueta el segundo como ```dockerfile / ```text. Itera para cadenas de >2 fences.
 */
export function mergeSplitMermaidContinuationFences(document: string): string {
  if (!document?.trim()) return document ?? "";
  const re =
    /```mermaid[ \t]*\n([\s\S]*?)\n?```[ \t]*\n+```[a-zA-Z0-9_+#.-]*[ \t]*\n([\s\S]*?)\n?```/;
  let prev: string | null = null;
  let cur = document;
  let guard = 0;
  while (prev !== cur && guard < 30) {
    prev = cur;
    cur = cur.replace(re, (match, b1: string, b2: string) => {
      const split = splitMermaidContinuationPrefix(b2);
      if (!split) return match;
      const cont = split.continuation
        .map(stripLeakedMermaidLinePrefix)
        .join("\n")
        .replace(/^\n+|\n+$/g, "");
      const merged = `${b1.replace(/[ \t\n]+$/, "")}\n${cont}`.replace(/\n{3,}/g, "\n\n");
      const fence = "```mermaid\n" + merged + "\n```";
      // El remanente era prosa atrapada dentro del wrapper: re-emitir como markdown normal.
      const rest = split.remainder.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
      return rest ? `${fence}\n\n${rest}` : fence;
    });
    guard++;
  }
  return cur;
}

function mermaidMarkdownLeakLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/^```/.test(trimmed)) return true;
  // Prosa markdown (p. ej. nota _Propuesta derivada…_ bajo el fence mal cerrado)
  if (/^_[^_\n]+(?:_.*)?$/.test(trimmed) && !/^(flowchart|graph|erDiagram|sequenceDiagram)\b/i.test(trimmed)) {
    return true;
  }
  if (/^#{1,6}\s/.test(trimmed)) {
    if (isOrphanSequenceDiagramLine(trimmed)) return false;
    return true;
  }
  if (/^\*\*TechnicalMetadata\*\*/i.test(trimmed)) return true;
  if (/^TechnicalMetadata\s*:?\s*$/i.test(trimmed)) return true;
  if (/^-\s*`/.test(trimmed)) return true;
  if (/^[-*]\s+\S/.test(trimmed)) {
    if (isOrphanSequenceDiagramLine(trimmed)) return false;
    if (!/^\s*[a-zA-Z0-9_]+\s*(-->|---)/.test(trimmed)) {
      return true;
    }
  }
  if (/^[-*]\s+Usuario\s*→/i.test(trimmed)) return true;
  if (/^[-*]\s+→\s+/i.test(trimmed)) return true;
  if (/^[-*]\s+\d+\.\s+\*\*/.test(trimmed)) return true;
  if (/^[-*]\s+(El usuario|Al cargar|Tras retorno|Logout:)/i.test(trimmed)) return true;
  if (/^\*\*Comportamiento requerido/i.test(trimmed)) return true;
  if (
    /^\[(?:high_security|external_api|multi_tenant|cicd_pipeline|real_time|advanced_monitoring)\]/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  return false;
}

const MERMAID_BODY_START =
  /^\s*(erDiagram|flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|xychart|blockDiagram|requirementDiagram)\b/i;

/** True si el cuerpo de un fence ```mermaid empieza con sintaxis de diagrama reconocible. */
export function looksLikeMermaidDiagramBody(body: string): boolean {
  return MERMAID_BODY_START.test((body ?? "").trim());
}

/**
 * Parte un fence ```mermaid sin cerrar: diagrama válido vs markdown del MDD colado (## 4., notas _…_, etc.).
 */
export function splitMermaidFenceBodyAtDocumentLeak(body: string): { diagram: string; remainder: string } {
  if (!body?.trim()) return { diagram: "", remainder: "" };

  const lines = body.split("\n");
  const diagramLines: string[] = [];
  const remainderLines: string[] = [];
  let seenDiagramStart = false;
  let inRemainder = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inRemainder) {
      if (MERMAID_BODY_START.test(trimmed)) seenDiagramStart = true;
      if (seenDiagramStart && mermaidMarkdownLeakLine(trimmed)) {
        inRemainder = true;
        remainderLines.push(line);
        continue;
      }
      diagramLines.push(line);
    } else {
      remainderLines.push(line);
    }
  }

  return {
    diagram: diagramLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    remainder: remainderLines.join("\n").replace(/^\n+/, "").trim(),
  };
}

/**
 * Trunca cuerpo Mermaid cuando el LLM no cerró el fence y filtró markdown
 * (TechnicalMetadata, encabezados ##, fences ```, viñetas con backticks).
 */
export function stripMarkdownLeakFromMermaidDiagramBody(raw: string): string {
  if (!raw?.trim()) return raw ?? "";

  const lines = raw.split("\n");
  const out: string[] = [];
  let seenDiagramStart = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/\*\*TechnicalMetadata\*\*/i.test(trimmed) || /```TechnicalMetadata/i.test(trimmed)) {
      const cut = trimmed.split(/\*\*TechnicalMetadata\*\*|```TechnicalMetadata/i)[0]?.trim();
      if (cut && !mermaidMarkdownLeakLine(cut)) out.push(cut);
      break;
    }

    if (MERMAID_DIAGRAM_HEADER_LINE.test(trimmed)) {
      seenDiagramStart = true;
      out.push(line);
      continue;
    }

    if (seenDiagramStart && mermaidMarkdownLeakLine(trimmed)) break;

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Separa diagrama Mermaid válido del markdown pegado dentro del mismo fence. */
export function splitMermaidBodyAndTrailingProse(inner: string): {
  diagram: string;
  trailing: string;
} {
  if (!inner?.trim()) return { diagram: "", trailing: "" };

  const lines = inner.split("\n");
  const diagramLines: string[] = [];
  const trailingLines: string[] = [];
  let seenDiagramStart = false;
  let inTrailing = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/\*\*TechnicalMetadata\*\*/i.test(trimmed) || /```TechnicalMetadata/i.test(trimmed)) {
      inTrailing = true;
      trailingLines.push(line);
      continue;
    }

    if (MERMAID_DIAGRAM_HEADER_LINE.test(trimmed)) {
      seenDiagramStart = true;
      diagramLines.push(line);
      continue;
    }

    if (seenDiagramStart && mermaidMarkdownLeakLine(trimmed)) {
      inTrailing = true;
    }

    if (inTrailing) trailingLines.push(line);
    else diagramLines.push(line);
  }

  return {
    diagram: stripMermaidFenceWrappers(
      diagramLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    ),
    trailing: trailingLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

/**
 * Normaliza un diagrama Mermaid existente — corrige errores comunes:
 * - IDs con espacios → reemplazados por underscore
 * - Bloques sequence sin cerrar → agrega `end`
 * - Subgraphs sin cerrar → agrega `end`
 * - Quotes inconsistentes → normaliza a double quotes
 * - Líneas en blanco excesivas → compacta
 */
/** Normaliza solo el cuerpo del diagrama (sin fences). */
export function normalizeMermaidDiagramBody(raw: string): string {
  let stripped = stripMermaidFenceWrappers(raw);
  stripped = stripMarkdownLeakFromMermaidDiagramBody(stripped);
  if (!stripped?.trim()) return "";
  stripped = dedupeMermaidDiagramHeader(stripped);
  stripped = repairErDiagramPkFkCommas(stripped);
  stripped = ensureErDiagramHeader(stripped);
  const isErDiagram = /^erDiagram\b/i.test(stripped.trim());
  const isSequence = /^sequenceDiagram\b/im.test(stripped.trim());
  if (isErDiagram) {
    stripped = stripErDiagramSqlDefaultArtifacts(stripped);
    stripped = normalizeErDiagramPgTypes(stripped);
  }

  const lines = stripped.trim().split("\n");
  const out: string[] = [];
  let openBlocks = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    const trimmed = line.trim();

    if (
      MERMAID_LEAKED_LIST_PREFIX_RE.test(trimmed) &&
      (isOrphanSequenceDiagramLine(trimmed) ||
        isOrphanFlowchartLine(trimmed) ||
        isOrphanErDiagramLine(trimmed) ||
        isOrphanStateDiagramLine(trimmed))
    ) {
      line = normalizeOrphanSequenceDiagramLine(line);
    }

    // Auto-reparación de corrupción ya persistida por normalizadores antiguos: un header de subgraph
    // que quedó como `subgraph_NEW["…"]` (el join de IDs unió la palabra clave con el id) rompe el
    // parser. El render re-normaliza en cada carga, así que restaurarlo aquí arregla documentos viejos
    // sin re-sincronizar. Solo aplica cuando tras `subgraph_<id>` viene `[`, `(` o `"` (header claro).
    line = line.replace(/^(\s*)subgraph_(\w+)(?=\s*["[(])/i, "$1subgraph $2");

    if (/^(graph|flowchart)\s/i.test(line.trim())) {
      out.push(line);
      continue;
    }

    if (/^\s*subgraph\s/.test(line.trim())) openBlocks++;
    if (/^\s*(alt|opt|loop|par|critical|break)\s/.test(line.trim())) openBlocks++;
    if (/^\s*end\s*$/.test(line.trim())) openBlocks = Math.max(0, openBlocks - 1);

    // Node IDs con espacios → underscore (flowchart/graph; no aplicar a erDiagram ni dentro de "…").
    if (
      !isErDiagram &&
      !/^\s*(subgraph|state|class|namespace|direction)\b/i.test(line)
    ) {
      line = replaceOutsideDoubleQuotes(line, /(\w+)\s+(\w+)(\[|\()/g, (_match, p1, p2, p3) => {
        return `${cleanId(p1)}_${cleanId(p2)}${p3}`;
      });
    }

    // `\n` literal (dos caracteres backslash+n) dentro de un cuerpo Mermaid rompe el render
    // (aparece como texto). Mermaid usa `<br/>` para salto de línea; aquí basta un espacio.
    line = line.replace(/\\n/g, " ");

    if (!isErDiagram) {
      // Etiquetas de nodo `[...]` / `(...)` con llaves (paths tipo `/{id}`) rompen el parser:
      // entrecomillar el texto si aún no lo está. No afecta nodos diamante `id{texto}` (open ≠ [ ( ).
      line = line.replace(
        /(\[|\()(?!["(])([^"\]\)]*[{}][^"\]\)]*)(\]|\))/g,
        (_m, open: string, label: string, close: string) => `${open}"${label.trim()}"${close}`,
      );

      // Etiquetas de arista `|...|` con llaves (paths tipo `/{id}`) también rompen el parser:
      // entrecomillar si aún no lo está.
      line = line.replace(
        /\|(?!")([^"|]*[{}][^"|]*)\|/g,
        (_m, label: string) => `|"${label.trim()}"|`,
      );
    }

    // Labels entre comillas: quitar markdown ** y compactar espacios. Tope alto (120) solo para
    // cortar prosa desbocada: un tope bajo (p. ej. 56) mutila etiquetas legítimas con `<br/>` y
    // rutas (`"Microservicio … (Node/Express)"`, `"… /{id}/limites"`).
    line = line.replace(/"([^"]*)"/g, (_m, label: string) => {
      const cleaned = label.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_MERMAID_LABEL_CHARS);
      return `"${cleaned}"`;
    });

    if (isSequence) {
      line = quoteSequenceDiagramMessageLine(line);
    }

    out.push(line);
  }

  for (let i = 0; i < openBlocks; i++) out.push("  end");

  let result = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!isErDiagram && /^(flowchart|graph)\s/i.test(result)) {
    result = quoteFlowchartLabelsWithParens(result);
    result = quoteFlowchartEdgeLabels(result);
  }
  return result;
}

/** Diagrama lineal s0→s1→s2 al volcar JSON del webhook (no es un flujo legible). */
export function looksLikeJsonFlattenFlowchart(body: string): boolean {
  const t = body.trim();
  if (!/^flowchart\s+TD/i.test(t)) return false;
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const slugNodes = lines.filter((l) => /^s\d+\s*\(/.test(l)).length;
  if (slugNodes >= 8) return true;
  const emptySlug = lines.some((l) => /^s\d+\s*\(\s*["']?\s*["']?\s*\)/.test(l));
  const jsonFieldHits = (
    t.match(
      /\b(?:event|timestamp|tenant_id|estado_id|audiencia|geolocalizacion|siglas|nombre|data|status|entity|action)\s*—/gi,
    ) ?? []
  ).length;
  const fieldCommaLabels = lines.filter((l) =>
    /^s\d+\([^)]*—[^)]*,\s*["']?\)/.test(l),
  ).length;
  if (emptySlug && slugNodes >= 3 && jsonFieldHits >= 1) return true;
  if (slugNodes >= 3 && jsonFieldHits >= 2) return true;
  if (slugNodes >= 2 && fieldCommaLabels >= 2) return true;
  return false;
}

export function webhookSyncFlowchartBody(): string {
  return `flowchart TD
  evt["Evento en sistema origen OBP u OBP4MO"]
  post["POST /api/v1/webhooks/:sistema/:entidad"]
  val["Validar payload y tenant_id"]
  upsert["Upsert en tabla espejo"]
  rsp["Response 200 status ok"]
  evt --> post
  post --> val
  val --> upsert
  upsert --> rsp`;
}

export function repairFlattenedWebhookFlowchart(body: string): string | null {
  if (!looksLikeJsonFlattenFlowchart(body)) return null;
  return webhookSyncFlowchartBody();
}

/** Un solo bloque ```mermaid … ``` (entrada puede incluir fences). */
export function normalizeMermaid(raw: string): string {
  if (!raw?.trim()) return raw ?? "";
  const text = raw
    .replace(/^```mermaid\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const body = normalizeMermaidDiagramBody(text);
  if (!body) return raw;
  return `\`\`\`mermaid\n${body}\n\`\`\``;
}

/** Normaliza cada bloque mermaid del documento sin tocar el resto del markdown. */
export function normalizeMermaidInDocument(document: string): string {
  if (!document?.trim()) return document ?? "";
  // 0) Cierre erróneo ```mermaid en lugar de ``` (debe ir antes de unfenced repair).
  let merged = repairMermaidFenceClosedWithMermaidTag(document);
  // 0b) Diagramas volcados sin fence ```mermaid (texto plano + listas markdown).
  merged = repairUnfencedMermaidInDocument(merged);
  // 1) Fusiona diagramas partidos en un 2.º fence con lenguaje arbitrario (```dockerfile, ```text…).
  merged = mergeSplitMermaidContinuationFences(merged);
  // 2) Re-absorbe líneas (sequence/flowchart) que quedaron fuera tras un cierre prematuro del fence.
  merged = repairFragmentedSequenceMermaidInDocument(merged);
  return merged.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_block, inner: string) => {
    const { diagram: rawDiagram, trailing } = splitMermaidBodyAndTrailingProse(inner);
    const body =
      repairFlattenedWebhookFlowchart(rawDiagram) ?? normalizeMermaidDiagramBody(rawDiagram);
    if (!body) return trailing ? `${trailing}\n` : "```mermaid\n```";
    const fence = `\`\`\`mermaid\n${body}\n\`\`\``;
    return trailing ? `${fence}\n\n${trailing}` : fence;
  });
}
