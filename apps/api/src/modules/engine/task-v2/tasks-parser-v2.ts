/**
 * Parser de tasks.md v2 con YAML front-matter.
 * Compatible con formato ejecutable para agentes de código (Cursor/Claude).
 * Backwards-compatible con v1 (markdown plano con regex) para migración graduak.
 */

export interface ParsedTaskV2 {
  id: string;
  title: string;
  description: string;
  changeType: "create" | "modify" | "delete" | "append" | "insert" | "replace" | "run" | "configure" | "generate" | "install" | "rename" | "merge";
  targetFiles: string[];
  language?: string;
  dependencies: string[];
  parallel: boolean;
  estimatedMinutes?: number;
  mddRef?: string;
  storyRef?: string;
  entity?: string;
  operations?: string[];
  insertAfter?: string;
  lines?: { start: number; end: number };
  testCommand?: string;
  testExpected?: string;
  buildCommand?: string;
  lintCommand?: string;
  codeExpected?: string; // bloque de código completo esperado
  diffExpected?: string; // diff esperado (| git diff style)
  inferenceRules: string[]; // reglas de inferencia como ["crud-auto", "soft-delete"]
  typeContext?: Record<string, unknown>; // contexto de tipos (json)
  verification: {
    command?: string;
    expectedOutput?: string;
    checklist?: string[];
  };
  dependenciesResolved?: Array<{ taskId: string; taskTitle: string; provides: string[] }>;
  section: string; // "Backend", "Frontend", "Infra", etc.
  checkpoint: string;
  rawMarkdown: string;
}

export interface TaskParseResult {
  version: string;
  project?: string;
  stage?: string;
  mddHash?: string;
  generatedAt?: string;
  autoRules: string[];
  tasks: ParsedTaskV2[];
  errors: TaskParseError[];
}

export interface TaskParseError {
  line: number;
  message: string;
  severity: "error" | "warning";
}

// ---- Parser principal ----

/**
 * Parsea un tasks.md completo en formato v2 (YAML front-matter por tarea).
 * También puede parsear formato v1 heredado como fallback.
 */
export function parseTasksV2(markdown: string): TaskParseResult {
  const result: TaskParseResult = {
    version: "2.0",
    tasks: [],
    errors: [],
    autoRules: [],
  };

  const lines = markdown.split("\n");
  let lineIdx = 0;

  // Parsear metadata global (si existe)
  const metadata = parseGlobalMetadata(lines, 0);
  if (metadata) {
    result.project = metadata.project;
    result.stage = metadata.stage;
    result.mddHash = metadata.mddHash;
    result.generatedAt = metadata.generatedAt;
    result.autoRules = metadata.autoRules ?? [];
    lineIdx = metadata.endLine + 1;
  }

  // Parsear tasks
  let currentSection = "General";
  let currentCheckpoint = "General";

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];

    // Detectar sección ##
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      lineIdx++;
      continue;
    }

    // Detectar checkpoint
    const cpMatch = line.match(/^\*\*Checkpoint\*\*\s*:\s*(.+)$/i);
    if (cpMatch) {
      currentCheckpoint = cpMatch[1].trim();
      lineIdx++;
      continue;
    }

    // Detectar inicio de task YAML front-matter
    if (line.trim() === "---" && lineIdx + 1 < lines.length) {
      const taskParse = parseTaskBlock(lines, lineIdx, currentSection, currentCheckpoint);
      if (taskParse.task) {
        result.tasks.push(taskParse.task);
      }
      if (taskParse.errors) {
        result.errors.push(...taskParse.errors);
      }
      lineIdx = taskParse.endLine + 1;
      continue;
    }

    // Fallback: formato v1 (checkbox simple)
    const v1Match = line.match(/^(\s*)-\s*\[(\s|x|X)\]\s+(.+)$/);
    if (v1Match && lineIdx + 1 < lines.length) {
      const v1Task = parseV1Task(line, lines, lineIdx, currentSection, currentCheckpoint, v1Match);
      if (v1Task) {
        result.tasks.push(v1Task);
      }
      lineIdx++;
      continue;
    }

    lineIdx++;
  }

  return result;
}

// ---- Metadata global ----

interface GlobalMetadata {
  project?: string;
  stage?: string;
  mddHash?: string;
  generatedAt?: string;
  autoRules?: string[];
  endLine: number;
}

function parseGlobalMetadata(lines: string[], startIdx: number): GlobalMetadata | null {
  // Buscar bloque YAML tras ## Metadata o al inicio del doc
  let i = startIdx;
  while (i < lines.length && lines[i].trim() !== "---") {
    i++;
  }
  if (i >= lines.length) return null;

  const yamlLines: string[] = [];
  i++; // saltar --- inicial
  while (i < lines.length && lines[i].trim() !== "---") {
    yamlLines.push(lines[i]);
    i++;
  }

  try {
    const raw = yamlLines.join("\n");
    const parsed = parseSimpleYaml(raw);
    return {
      project: parsed.project,
      stage: parsed.stage,
      mddHash: parsed.mdd_hash || parsed.mddHash,
      generatedAt: parsed.generated_at || parsed.generatedAt,
      autoRules: Array.isArray(parsed.auto_rules) ? parsed.auto_rules : [],
      endLine: i,
    };
  } catch {
    return null;
  }
}

// ---- Task con YAML front-matter ----

interface TaskParseOutput {
  task?: ParsedTaskV2;
  errors?: TaskParseError[];
  endLine: number;
}

function parseTaskBlock(
  lines: string[],
  startIdx: number,
  section: string,
  checkpoint: string,
): TaskParseOutput {
  const errors: TaskParseError[] = [];
  let i = startIdx;

  // Front-matter YAML entre --- y ---
  if (lines[i].trim() !== "---") {
    return { task: undefined, endLine: i };
  }
  i++;

  const yamlLines: string[] = [];
  while (i < lines.length && lines[i].trim() !== "---") {
    yamlLines.push(lines[i]);
    i++;
  }
  if (i >= lines.length) {
    errors.push({ line: startIdx, message: "Task front-matter no cerrado (falta ---)", severity: "error" });
    return { errors, endLine: i };
  }
  i++; // saltar --- final

  let fm: Record<string, any>;
  try {
    fm = parseSimpleYaml(yamlLines.join("\n"));
  } catch (e) {
    errors.push({ line: startIdx, message: `YAML inválido: ${e}`, severity: "error" });
    return { errors, endLine: i };
  }

  // Campos obligatorios
  if (!fm.id) errors.push({ line: startIdx, message: "Task sin 'id'", severity: "error" });
  if (!fm.title) errors.push({ line: startIdx, message: "Task sin 'title'", severity: "error" });
  if (!fm.change_type) errors.push({ line: startIdx, message: "Task sin 'change_type'", severity: "error" });
  if (!Array.isArray(fm.target_files) || fm.target_files.length === 0) {
    errors.push({ line: startIdx, message: "Task sin 'target_files'", severity: "warning" });
  }

  // Cuerpo markdown hasta siguiente task o final de sección
  const bodyLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    // Si encontramos otro task YAML, paramos (permite líneas en blanco entre bloques)
    if (line.trim() === "---") {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j += 1;
      if (j < lines.length && /^[a-z_]+:/i.test(lines[j])) break;
    }
    // Si encontramos un header de sección, paramos
    if (/^##\s+/.test(line)) break;
    bodyLines.push(line);
    i++;
  }

  // Parsear bloques especiales del cuerpo
  const body = bodyLines.join("\n");
  const codeExpected = extractCodeBlock(body, "Código Esperado");
  const diffExpected = extractCodeBlock(body, "Diff Esperado");
  const inferenceRules = extractInferenceRules(body);
  const verification = extractVerification(body);
  const typeContext = extractTypeContext(body);
  const description = extractDescription(body);

  const task: ParsedTaskV2 = {
    id: String(fm.id ?? ""),
    title: String(fm.title ?? ""),
    description: description || String(fm.title ?? ""),
    changeType: (fm.change_type ?? "create") as ParsedTaskV2["changeType"],
    targetFiles: Array.isArray(fm.target_files) ? fm.target_files.map(String) : [],
    language: fm.language ? String(fm.language) : undefined,
    dependencies: Array.isArray(fm.dependencies) ? fm.dependencies.map(String) : [],
    parallel: Boolean(fm.parallel ?? false),
    estimatedMinutes: fm.estimated_minutes ? Number(fm.estimated_minutes) : undefined,
    mddRef: fm.mdd_ref ? String(fm.mdd_ref) : undefined,
    storyRef: fm.story_ref ? String(fm.story_ref) : undefined,
    entity: fm.entity ? String(fm.entity) : undefined,
    operations: Array.isArray(fm.operations) ? fm.operations.map(String) : undefined,
    insertAfter: fm.insert_after ? String(fm.insert_after) : undefined,
    testCommand: fm.test_command ? String(fm.test_command) : undefined,
    testExpected: fm.test_expected ? String(fm.test_expected) : undefined,
    buildCommand: fm.build_command ? String(fm.build_command) : undefined,
    lintCommand: fm.lint_command ? String(fm.lint_command) : undefined,
    codeExpected: codeExpected || undefined,
    diffExpected: diffExpected || undefined,
    inferenceRules,
    typeContext,
    verification: verification || {},
    section: fm.section ? String(fm.section).trim() : section,
    checkpoint,
    rawMarkdown: [lines.slice(startIdx, i).join("\n")].join("\n"),
  };

  return { task, errors: errors.length > 0 ? errors : undefined, endLine: i - 1 };
}

// ---- Fallback: parseo v1 (checkbox simple) ----

function parseV1Task(
  line: string,
  _lines: string[],
  lineIdx: number,
  section: string,
  checkpoint: string,
  match: RegExpMatchArray,
): ParsedTaskV2 {
  const rawTitle = match[3].trim();
  const isParallel = rawTitle.toUpperCase().startsWith("[P]");
  const title = isParallel ? rawTitle.slice(3).trim() : rawTitle;

  // Extraer archivos con regex
  const filePaths: string[] = [];
  const fileRe = /(?:`([^`]+)`|\*\*Archivo:\*\*\s*([^\s\n]+)|\b((?:src|apps|packages)\/[\w./-]+))/gi;
  let fm: RegExpExecArray | null;
  while ((fm = fileRe.exec(rawTitle)) !== null) {
    const p = (fm[1] ?? fm[2] ?? fm[3] ?? "").trim();
    if (p && !p.startsWith("http") && p.length > 2) filePaths.push(p);
  }

  // Construir ID si no existe
  const idMatch = rawTitle.match(/^T-\d+/i);
  const id = idMatch ? idMatch[0].toUpperCase() : `T-${lineIdx}`;

  return {
    id,
    title,
    description: title,
    changeType: "create", // fallback
    targetFiles: filePaths,
    dependencies: [],
    parallel: isParallel,
    entity: undefined,
    operations: undefined,
    inferenceRules: [],
    verification: {},
    section,
    checkpoint,
    rawMarkdown: line,
  };
}

// ---- Extractores de bloques especiales ----

function extractCodeBlock(body: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("#{2,4}\\s*" + escapedHeading + "\\s*\\n+\\s*```[\\s\\S]*?\\n(```)", "i");
  const m = body.match(pattern);
  if (!m) return null;
  // Devolver contenido entre backticks
  const start = body.indexOf(m[0]);
  const end = start + m[0].length;
  return body.slice(start, end);
}

function extractInferenceRules(body: string): string[] {
  const rules: string[] = [];
  const pattern = /^\s*-\s*\[([\w-]+)\]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    rules.push(m[1]);
  }
  return rules;
}

function extractVerification(body: string): ParsedTaskV2["verification"] | null {
  const block = extractCodeBlock(body, "Verificación");
  if (!block) return null;

  const cmdMatch = block.match(/command[:\s]+`([^`]+)`/i) || block.match(/```bash\s*\n([\s\S]*?)\n```/);
  const expectedMatch = block.match(/Output esperado[:\s]+`([^`]+)`/i) || block.match(/expected_output[:\s]+`([^`]+)`/i);

  const checklist: string[] = [];
  const checkPattern = /^\s*- \[( |x|X)\]\s*(.+)$/gim;
  let cm: RegExpExecArray | null;
  while ((cm = checkPattern.exec(body)) !== null) {
    checklist.push(cm[2].trim());
  }

  return {
    command: cmdMatch ? cmdMatch[1].trim() : undefined,
    expectedOutput: expectedMatch ? expectedMatch[1].trim() : undefined,
    checklist: checklist.length > 0 ? checklist : undefined,
  };
}

function extractTypeContext(body: string): Record<string, unknown> | undefined {
  const block = extractCodeBlock(body, "Contexto de Tipos");
  if (!block) return undefined;
  // Extraer JSON dentro del bloque
  const jsonMatch = block.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return undefined;
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    return undefined;
  }
}

function extractDescription(body: string): string {
  // Primer párrafo tras un header #### Descripción
  const match = body.match(/#{2,4}\s*Descripción\s*\n+([^#\n][\s\S]*?)(?:\n#{2,4}|\n\n#{2,4}|\n---|$)/i);
  return match ? match[1].trim() : "";
}

// ---- Utilidades YAML simple ----

/**
 * Parser YAML ultra-simple: solo soporta clave-valor plano, arrays y objetos 1 nivel.
 * Suficiente para front-matter de tasks.
 */
function parseSimpleYaml(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  let currentArray: any[] | null = null;
  let currentObject: Record<string, any> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Verificar si es continuación de array/objeto
    if (currentKey && currentArray !== null) {
      if (trimmed.startsWith("- ")) {
        const val = trimmed.slice(2).trim();
        // Si es un item de array simple
        if (!val.includes(": ") && !val.startsWith("{")) {
          currentArray.push(parseYamlValue(val));
          continue;
        }
      }
      // Array terminó, guardar
      result[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    if (currentKey && currentObject !== null) {
      const objMatch = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (objMatch) {
        currentObject[objMatch[1]] = parseYamlValue(objMatch[2]);
        continue;
      } else {
        result[currentKey] = currentObject;
        currentObject = null;
        currentKey = null;
      }
    }

    // Key: value
    const match = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    if (value === "" || value === "null") {
      // Puede ser inicio de array u objeto (ver siguiente línea)
      const nextLine = lines[i + 1]?.trim() ?? "";
      if (nextLine.startsWith("- ")) {
        currentKey = key;
        currentArray = [];
      } else if (/^[a-zA-Z0-9_]+:/.test(nextLine)) {
        currentKey = key;
        currentObject = {};
      } else {
        result[key] = null;
      }
    } else {
      result[key] = parseYamlValue(value);
    }
  }

  // Flush pendientes
  if (currentKey && currentArray !== null) result[currentKey] = currentArray;
  if (currentKey && currentObject !== null) result[currentKey] = currentObject;

  return result;
}

function parseYamlValue(val: string): any {
  val = val.trim();
  if (val === "null" || val === "~") return null;
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
  if (val.startsWith("[") && val.endsWith("]")) {
    try {
      // Parse simple array: [a, b, c]
      const inner = val.slice(1, -1);
      if (!inner.trim()) return [];
      return inner.split(",").map((v) => {
        const s = v.trim();
        return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : parseYamlValue(s);
      });
    } catch {
      return val;
    }
  }
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  return val;
}

// ---- Export helpers ----

export function tasksV2ToJson(result: TaskParseResult): string {
  return JSON.stringify(result, null, 2);
}

export function getTaskById(result: TaskParseResult, id: string): ParsedTaskV2 | undefined {
  return result.tasks.find((t) => t.id === id);
}

export function getOpenTasks(result: TaskParseResult): ParsedTaskV2[] {
  return result.tasks; // En v2 todas son abiertas inicialmente; el agente marca progreso
}

export function getTasksByEntity(result: TaskParseResult, entity: string): ParsedTaskV2[] {
  return result.tasks.filter((t) => t.entity === entity);
}

export function getDependencyGraph(result: TaskParseResult): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const task of result.tasks) {
    graph.set(task.id, task.dependencies ?? []);
  }
  return graph;
}

export function detectCircularDependencies(
  graph: Map<string, string[]>,
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    for (const dep of graph.get(node) ?? []) {
      dfs(dep, [...path, node]);
    }

    stack.delete(node);
  }

  for (const [node] of graph) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

export function getExecutionOrder(result: TaskParseResult): string[] {
  const graph = getDependencyGraph(result);
  const inDegree = new Map<string, number>();
  
  for (const [id, deps] of graph) {
    if (!inDegree.has(id)) inDegree.set(id, 0);
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);

    for (const [otherId, deps] of graph) {
      if (deps.includes(id)) {
        const newDegree = (inDegree.get(otherId) ?? 0) - 1;
        inDegree.set(otherId, newDegree);
        if (newDegree === 0) queue.push(otherId);
      }
    }
  }

  return order;
}

export default {
  parseTasksV2,
  tasksV2ToJson,
  getTaskById,
  getOpenTasks,
  getTasksByEntity,
  getDependencyGraph,
  detectCircularDependencies,
  getExecutionOrder,
};
