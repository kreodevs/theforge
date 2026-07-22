/**
 * Parser de tasks.md v2 con YAML front-matter.
 * Compatible con formato ejecutable para agentes de código (Cursor/Claude).
 * Backwards-compatible con v1 (markdown plano con regex) para migración graduak.
 */

export interface ParsedTaskV2 {
  id: string;
  title: string;
  description: string;
  status?: "pending" | "in_progress" | "done" | "blocked";
  changeType: "create" | "modify" | "delete" | "append" | "insert" | "replace" | "run" | "configure" | "generate" | "install" | "rename" | "merge";
  targetFiles: string[];
  scopeInclude: string[];
  scopeExclude: string[];
  language?: string;
  dependencies: string[];
  parallel: boolean;
  estimatedMinutes?: number;
  mddRef?: string;
  storyRef?: string;
  contextWhy?: string;
  requirements: string[];
  constraints: string[];
  doneWhen: string[];
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
  inferenceRules: string[]; // solo reglas documentadas en repo; preferir requirements[]
  typeContext?: Record<string, unknown>; // contexto de tipos (json)
  verification: {
    command?: string;
    expectedOutput?: string;
    checklist?: string[];
    steps?: Array<Record<string, unknown>>;
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
  const headerIdx = lines.findIndex(
    (l, i) => i >= startIdx && /^##\s+Metadata\b/i.test(l.trim()),
  );
  if (headerIdx < 0) return null;

  let i = headerIdx + 1;
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
  const yamlRaw = yamlLines.join("\n");
  try {
    fm = parseSimpleYaml(yamlRaw);
    fm = enrichFrontMatterFromRaw(yamlRaw, fm);
  } catch (e) {
    errors.push({ line: startIdx, message: `YAML inválido: ${e}`, severity: "error" });
    return { errors, endLine: i };
  }

  // Campos obligatorios
  if (!fm.id) errors.push({ line: startIdx, message: "Task sin 'id'", severity: "error" });
  if (!fm.title) errors.push({ line: startIdx, message: "Task sin 'title'", severity: "error" });
  if (!fm.change_type) errors.push({ line: startIdx, message: "Task sin 'change_type'", severity: "error" });

  const scopeInclude = extractScopeInclude(fm);
  const scopeExclude = extractScopeExclude(fm);
  const targetFiles = resolveTargetFiles(fm, scopeInclude);
  if (targetFiles.length === 0) {
    errors.push({ line: startIdx, message: "Task sin scope.include ni target_files", severity: "warning" });
  }

  const context = extractContext(fm);
  const requirements = extractStringArray(fm.requirements);
  const constraints = extractStringArray(fm.constraints);
  const doneWhen = extractStringArray(fm.done_when ?? fm.doneWhen);
  const dependencies = resolveDependencies(fm);
  const verificationFromFm = normalizeVerificationFromFm(fm.verification);

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
  const verificationBody = extractVerification(body);
  const typeContext = extractTypeContext(body);
  const description = extractDescription(body);

  const verification = {
    ...verificationFromFm,
    ...(verificationBody ?? {}),
    steps: verificationFromFm.steps ?? verificationBody?.steps,
  };

  const task: ParsedTaskV2 = {
    id: String(fm.id ?? ""),
    title: String(fm.title ?? ""),
    description: description || String(fm.title ?? ""),
    status: parseTaskStatus(fm.status),
    changeType: (fm.change_type ?? "create") as ParsedTaskV2["changeType"],
    targetFiles,
    scopeInclude,
    scopeExclude,
    language: fm.language ? String(fm.language) : undefined,
    dependencies,
    parallel: Boolean(fm.parallel ?? false),
    estimatedMinutes: fm.estimated_minutes ? Number(fm.estimated_minutes) : undefined,
    mddRef: context.mddRef ?? (fm.mdd_ref ? String(fm.mdd_ref) : undefined),
    storyRef: context.storyRef ?? (fm.story_ref ? String(fm.story_ref) : undefined),
    contextWhy: context.why,
    requirements,
    constraints,
    doneWhen,
    entity: fm.entity ? String(fm.entity) : undefined,
    operations: Array.isArray(fm.operations) ? fm.operations.map(String) : undefined,
    insertAfter: fm.insert_after ? String(fm.insert_after) : undefined,
    testCommand: fm.test_command ? String(fm.test_command) : undefined,
    testExpected: fm.test_expected ? String(fm.test_expected) : undefined,
    buildCommand: fm.build_command ? String(fm.build_command) : undefined,
    lintCommand: fm.lint_command ? String(fm.lint_command) : undefined,
    codeExpected: codeExpected || undefined,
    diffExpected: diffExpected || undefined,
    inferenceRules: Array.isArray(fm.inference_rules) ? fm.inference_rules.map(String) : inferenceRules,
    typeContext,
    verification: verification || {},
    section: fm.section ? String(fm.section).trim() : section,
    checkpoint,
    rawMarkdown: stripFrontMatterFromRaw(lines.slice(startIdx, i).join("\n")),
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
    scopeInclude: filePaths,
    scopeExclude: [],
    dependencies: [],
    parallel: isParallel,
    requirements: [],
    constraints: [],
    doneWhen: [],
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

function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((s) => s.trim().length > 0);
}

function extractScopeInclude(fm: Record<string, any>): string[] {
  if (fm.scope && typeof fm.scope === "object" && Array.isArray(fm.scope.include)) {
    return fm.scope.include.map(String);
  }
  return [];
}

function extractScopeExclude(fm: Record<string, any>): string[] {
  if (fm.scope && typeof fm.scope === "object" && Array.isArray(fm.scope.exclude)) {
    return fm.scope.exclude.map(String);
  }
  return [];
}

function resolveTargetFiles(fm: Record<string, any>, scopeInclude: string[]): string[] {
  if (scopeInclude.length > 0) return scopeInclude;
  if (Array.isArray(fm.target_files)) return fm.target_files.map(String);
  if (Array.isArray(fm.targetFiles)) return fm.targetFiles.map(String);
  return [];
}

function resolveDependencies(fm: Record<string, any>): string[] {
  if (Array.isArray(fm.depends_on)) return fm.depends_on.map(String);
  if (Array.isArray(fm.dependencies)) return fm.dependencies.map(String);
  return [];
}

function extractContext(fm: Record<string, any>): { mddRef?: string; storyRef?: string; why?: string } {
  if (fm.context && typeof fm.context === "object") {
    const ctx = fm.context as Record<string, unknown>;
    return {
      mddRef: ctx.mdd_ref ? String(ctx.mdd_ref) : undefined,
      storyRef: ctx.story_ref ? String(ctx.story_ref) : undefined,
      why: ctx.why ? String(ctx.why) : undefined,
    };
  }
  return {};
}

function parseTaskStatus(value: unknown): ParsedTaskV2["status"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "pending" || normalized === "in_progress" || normalized === "done" || normalized === "blocked") {
    return normalized;
  }
  return undefined;
}

function normalizeVerificationFromFm(value: unknown): ParsedTaskV2["verification"] {
  if (value == null) return {};

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return {
      command: obj.command ? String(obj.command) : undefined,
      expectedOutput: obj.expectedOutput
        ? String(obj.expectedOutput)
        : obj.expected_output
          ? String(obj.expected_output)
          : undefined,
      checklist: extractStringArray(obj.checklist),
      steps: undefined,
    };
  }

  if (Array.isArray(value)) {
    const steps = value.filter((s) => s && typeof s === "object") as Array<Record<string, unknown>>;
    const firstRun = steps.find((s) => typeof s.run === "string");
    return {
      command: firstRun?.run ? String(firstRun.run) : undefined,
      expectedOutput: firstRun?.expect_exit != null ? String(firstRun.expect_exit) : undefined,
      steps,
    };
  }

  return {};
}
/** Strip YAML front-matter from raw markdown (handles nested/consecutive --- blocks). */
function stripFrontMatterFromRaw(raw: string): string {
  let trimmed = raw.trim();
  let guard = 0;
  while (trimmed.startsWith("---") && guard < 8) {
    guard += 1;
    const endIdx = trimmed.indexOf("\n---", 3);
    if (endIdx === -1) break;
    trimmed = trimmed.slice(endIdx + 4).trim();
  }
  return trimmed;
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

function enrichFrontMatterFromRaw(yamlRaw: string, fm: Record<string, any>): Record<string, any> {
  const out = { ...fm };

  if (!out.context || typeof out.context !== "object") {
    const context = parseNestedKeyBlock(yamlRaw, "context");
    if (Object.keys(context).length > 0) out.context = context;
  }

  if (!out.scope || typeof out.scope !== "object") {
    const scope = parseScopeBlock(yamlRaw);
    if (scope.include.length > 0 || scope.exclude.length > 0) out.scope = scope;
  }

  for (const key of ["requirements", "constraints", "done_when"] as const) {
    if (!Array.isArray(out[key]) || out[key].length === 0) {
      const items = parseTopLevelList(yamlRaw, key);
      if (items.length > 0) out[key] = items;
    }
  }

  if (out.verification == null || (typeof out.verification === "object" && Object.keys(out.verification).length === 0)) {
    const steps = parseVerificationSteps(yamlRaw);
    if (steps.length > 0) out.verification = steps;
  }

  if (!Array.isArray(out.depends_on) && !Array.isArray(out.dependencies)) {
    const depends = parseInlineArray(yamlRaw, "depends_on");
    if (depends.length >= 0 && /^depends_on:\s*\[\s*\]/m.test(yamlRaw)) {
      out.depends_on = [];
    }
  }

  return out;
}

function parseNestedKeyBlock(yamlRaw: string, key: string): Record<string, string> {
  const lines = yamlRaw.split("\n");
  const out: Record<string, string> = {};
  let inBlock = false;
  for (const line of lines) {
    if (/^\s*$/.test(line) || line.trim().startsWith("#")) continue;
    if (new RegExp(`^${key}:\\s*$`).test(line.trim())) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^\S/.test(line)) break;
      const m = line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*)$/);
      if (m) out[m[1]] = parseYamlValue(m[2]);
    }
  }
  return out;
}

function parseScopeBlock(yamlRaw: string): { include: string[]; exclude: string[] } {
  const lines = yamlRaw.split("\n");
  const out = { include: [] as string[], exclude: [] as string[] };
  let inScope = false;
  let listKey: "include" | "exclude" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^scope:\s*$/.test(trimmed)) {
      inScope = true;
      listKey = null;
      continue;
    }
    if (!inScope) continue;
    if (/^\S/.test(line) && !/^\s+/.test(line)) break;

    if (/^include:\s*$/.test(trimmed)) {
      listKey = "include";
      continue;
    }
    if (/^exclude:\s*$/.test(trimmed)) {
      listKey = "exclude";
      continue;
    }
    const item = trimmed.match(/^- (.+)$/);
    if (item && listKey) {
      out[listKey].push(String(parseYamlValue(item[1])));
    }
  }
  return out;
}

function parseTopLevelList(yamlRaw: string, key: string): string[] {
  const lines = yamlRaw.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (new RegExp(`^${key}:\\s*$`).test(trimmed)) {
      inList = true;
      continue;
    }
    if (inList) {
      if (/^\S/.test(line) && !trimmed.startsWith("- ")) break;
      const item = trimmed.match(/^- (.+)$/);
      if (item) out.push(String(parseYamlValue(item[1])));
    }
  }
  return out;
}

function parseVerificationSteps(yamlRaw: string): Array<Record<string, unknown>> {
  const lines = yamlRaw.split("\n");
  const steps: Array<Record<string, unknown>> = [];
  let inVerification = false;
  let current: Record<string, unknown> | null = null;
  let httpBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^verification:\s*$/.test(trimmed)) {
      inVerification = true;
      continue;
    }
    if (!inVerification) continue;
    if (/^[a-z_]+:\s*$/i.test(trimmed) && !trimmed.startsWith("- ")) {
      if (trimmed !== "http:" && !/^run:/.test(trimmed)) break;
    }

    if (trimmed.startsWith("- run:")) {
      if (current) steps.push(current);
      current = { run: String(parseYamlValue(trimmed.slice("- run:".length).trim())) };
      httpBlock = false;
      continue;
    }
    if (trimmed === "- http:") {
      if (current) steps.push(current);
      current = { http: {} as Record<string, unknown> };
      httpBlock = true;
      continue;
    }
    if (current && httpBlock && /^\S/.test(line) && /^\s+/.test(line)) {
      const m = line.match(/^\s+([a-z_]+):\s*(.*)$/);
      if (m && current.http && typeof current.http === "object") {
        (current.http as Record<string, unknown>)[m[1]] = parseYamlValue(m[2]);
      }
      continue;
    }
    if (current && !httpBlock && /^\s+expect_exit:/.test(line)) {
      const m = line.match(/expect_exit:\s*(.*)/);
      if (m) current.expect_exit = parseYamlValue(m[1].trim());
    }
  }
  if (current) steps.push(current);
  return steps;
}

function parseInlineArray(yamlRaw: string, key: string): string[] {
  const m = yamlRaw.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]`, "m"));
  if (!m) return [];
  const inner = m[1].trim();
  if (!inner) return [];
  return inner.split(",").map((v) => String(parseYamlValue(v.trim())));
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
