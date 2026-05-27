import { previewPropsForComponent } from "./wireframeSnippetPreview";

/** Extracts UC/HU/US id from a reference string (e.g. "UC-001: Login" → "UC-001"). */
export function normalizeRequirementRef(ref: string): string {
  const m = ref.trim().match(/\b((?:UC|HU|US)[-_]?\d+)\b/i);
  if (m?.[1]) return m[1].toUpperCase().replace("_", "-");
  return ref.trim();
}

/** Extracts one markdown section (heading + nested subsections) that contains refId. */
function extractSectionContainingRef(doc: string, refId: string): string | null {
  const lines = doc.split("\n");
  let startIdx = -1;
  let level = 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(refId)) continue;
    if (/^#{2,3}\s/.test(line)) {
      startIdx = i;
      level = line.match(/^(#+)/)?.[1].length ?? 2;
      break;
    }
    let h = i;
    while (h >= 0 && !/^#{2,3}\s/.test(lines[h])) h -= 1;
    if (h >= 0) {
      startIdx = h;
      level = lines[h].match(/^(#+)/)?.[1].length ?? 2;
      break;
    }
  }

  if (startIdx < 0) return null;

  const out: string[] = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#+)\s/);
    if (!m) {
      out.push(line);
      continue;
    }
    const headingLevel = m[1].length;
    if (headingLevel < level) break;
    if (
      headingLevel === level &&
      /^(#{2,3})\s+(?:Epic:|Historia de usuario:|Caso de uso:|\b(?:UC|HU|US)[-_]?\d+)/i.test(line)
    ) {
      break;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

export interface ScreenPreviewContext {
  title: string;
  description?: string;
  componentIndex?: number;
  inputIndex?: number;
  buttonIndex?: number;
}

function isLoginLikeScreen(title: string, description = ""): boolean {
  return /login|inicio de sesi[oó]n|sign[\s-]?in|autenticaci[oó]n/i.test(`${title} ${description}`);
}

function inferPropsFromScreenContext(
  componentName: string,
  screen: ScreenPreviewContext,
): Record<string, string | boolean> {
  const lower = componentName.toLowerCase();
  const login = isLoginLikeScreen(screen.title, screen.description);

  if (login && (lower.includes("input") || lower.includes("field") || lower.includes("textfield"))) {
    const inputIdx = screen.inputIndex ?? 0;
    if (inputIdx === 0 || /email|correo|usuario/i.test(lower)) {
      return {
        type: "email",
        label: "Email",
        placeholder: "m@example.com",
        value: "",
        onChange: "function(){}",
      };
    }
    if (inputIdx === 1 || /password|contraseña/i.test(lower)) {
      return {
        type: "password",
        label: "Password",
        placeholder: "",
        value: "",
        onChange: "function(){}",
      };
    }
  }

  if (login && (lower.includes("button") || lower.includes("botón"))) {
    return {
      children: "Login",
      variant: "default",
      type: "submit",
      onClick: "function(){}",
    };
  }

  if (login && (lower.includes("link") || lower.includes("enlace"))) {
    return { children: "Forgot your password?", href: "#" };
  }

  return {};
}

/** Collects markdown sections from CU/HU/Spec docs that match screen references. */
export function collectRequirementsContext(
  useCasesContent: string,
  userStoriesContent: string,
  refs: string[],
  specContent = "",
): string {
  const ids = [...new Set(refs.map(normalizeRequirementRef).filter(Boolean))];
  const chunks: string[] = [];

  if (specContent.trim()) {
    chunks.push(specContent.trim());
  }

  for (const doc of [useCasesContent, userStoriesContent]) {
    if (!doc.trim()) continue;
    if (ids.length === 0) continue;
    for (const id of ids) {
      const section = extractSectionContainingRef(doc, id);
      if (section) chunks.push(section);
    }
  }
  return [...new Set(chunks)].join("\n\n---\n\n");
}

export interface StoryFields {
  como?: string;
  quiero?: string;
  para?: string;
  acceptanceCriteria: string[];
  flowSteps: string[];
}

export function extractStoryFields(requirementsText: string): StoryFields {
  const como = requirementsText.match(/\*\*Como:\*\*\s*(.+)/i)?.[1]?.trim();
  const quiero = requirementsText.match(/\*\*Quiero:\*\*\s*(.+)/i)?.[1]?.trim();
  const para = requirementsText.match(/\*\*Para:\*\*\s*(.+)/i)?.[1]?.trim();

  const acceptanceCriteria: string[] = [];
  let inAc = false;
  for (const line of requirementsText.split("\n")) {
    const t = line.trim();
    if (/criterios de aceptaci[oó]n/i.test(t)) {
      inAc = true;
      continue;
    }
    if (inAc && /^⸻|^---|^###|^##/.test(t)) {
      inAc = false;
    }
    if (inAc && /^[-*]\s+/.test(t)) {
      acceptanceCriteria.push(t.replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim());
    }
  }

  const flowSteps: string[] = [];
  for (const line of requirementsText.split("\n")) {
    const t = line.trim();
    if (/^\d+[\.)]\s+/.test(t) || /^-\s+\d+[\.)]\s+/.test(t)) {
      flowSteps.push(t.replace(/^-\s+/, "").replace(/^\d+[\.)]\s+/, "").trim());
    }
    const tableStep = t.match(/^\|\s*\d+\s*\|\s*(.+?)\s*\|/);
    if (tableStep?.[1] && !tableStep[1].includes("---")) {
      flowSteps.push(tableStep[1].trim());
    }
  }

  return { como, quiero, para, acceptanceCriteria, flowSteps };
}

/** Parses the DS table "Props principales" cell into a plain object. */
export function parseDsPropsCell(propsCell: string): Record<string, string> {
  const raw = propsCell.trim();
  if (!raw || raw === "—" || raw === "-") return {};

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v != null) out[k] = String(v);
      }
      return out;
    } catch {
      /* fall through */
    }
  }

  const out: Record<string, string> = {};
  const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(raw)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  }
  return out;
}

function jsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function propsRecordToJsLiteral(props: Record<string, string | boolean | number>): string {
  const entries = Object.entries(props).filter(([, v]) => v !== "" && v != null);
  if (entries.length === 0) return "{}";

  const parts = entries.map(([key, value]) => {
    if (typeof value === "boolean" || typeof value === "number") {
      return `${key}: ${value}`;
    }
    if (value === "true") return `${key}: true`;
    if (value === "false") return `${key}: false`;
    if (/^function\s*\(/.test(value)) return `${key}: ${value}`;
    return `${key}: ${jsStringLiteral(String(value))}`;
  });
  return `{ ${parts.join(", ")} }`;
}

function inferPropsFromRequirements(
  componentName: string,
  requirementsText: string,
): Record<string, string | boolean> {
  const fields = extractStoryFields(requirementsText);
  const lower = componentName.toLowerCase();
  const out: Record<string, string | boolean> = {};

  const actionLabel =
    fields.quiero ??
    fields.flowSteps.find((s) => /click|pulsa|presiona|envía|guardar|iniciar|login|entrar/i.test(s)) ??
    fields.acceptanceCriteria[0];

  const fieldHint =
    fields.flowSteps.find((s) => /introduce|ingresa|escribe|email|correo|contraseña|password|usuario/i.test(s)) ??
    fields.quiero;

  if (lower.includes("button") || lower.includes("botón")) {
    if (actionLabel) out.children = actionLabel.replace(/^quiero\s+/i, "").trim();
    if (/primary|submit|guardar|iniciar|entrar/i.test(`${actionLabel} ${fields.quiero ?? ""}`)) {
      out.variant = "primary";
    }
    out.onClick = "function(){}";
    return out;
  }

  if (lower.includes("input") || lower.includes("field") || lower.includes("textfield")) {
    if (fieldHint) {
      if (/email|correo/i.test(fieldHint)) {
        out.type = "email";
        out.placeholder = "Correo electrónico";
        out.label = "Correo electrónico";
      } else if (/contraseña|password/i.test(fieldHint)) {
        out.type = "password";
        out.placeholder = "Contraseña";
        out.label = "Contraseña";
      } else {
        out.placeholder = fieldHint.slice(0, 80);
      }
    }
    if (fields.como && !out.label) out.label = fields.como;
    out.value = "";
    out.onChange = "function(){}";
    return out;
  }

  if (lower.includes("alert") || lower.includes("aviso") || lower.includes("notice")) {
    out.title = "Aviso";
    out.variant = "info";
    out.children =
      fields.acceptanceCriteria[0] ??
      fields.para ??
      fields.quiero ??
      "Mensaje informativo";
    return out;
  }

  if (lower.includes("checkbox") || lower.includes("switch")) {
    out.label = fields.quiero ?? fields.como ?? "Opción";
    out.checked = true;
    out.onChange = "function(){}";
    return out;
  }

  if (fields.quiero) {
    out.children = fields.quiero;
  } else if (fields.acceptanceCriteria[0]) {
    out.children = fields.acceptanceCriteria[0];
  }

  return out;
}

/**
 * Builds a JS props literal for iframe preview: DS props + CU/HU context, with DS winning on conflicts.
 */
export function buildComponentPreviewPropsLiteral(
  componentName: string,
  dsPropsCell: string | undefined,
  requirementsText: string,
  snippetSource = "",
  screenContext?: ScreenPreviewContext,
): string {
  const fromScreen = screenContext
    ? inferPropsFromScreenContext(componentName, screenContext)
    : {};
  const fromReq = inferPropsFromRequirements(componentName, requirementsText);
  const fromDs = parseDsPropsCell(dsPropsCell ?? "");

  const merged: Record<string, string | boolean> = { ...fromScreen, ...fromReq };
  for (const [k, v] of Object.entries(fromDs)) {
    if (k === "onChange" || k === "onClick" || k === "onSubmit") {
      merged[k] = v.startsWith("function") ? v : "function(){}";
    } else {
      merged[k] = v;
    }
  }

  if (Object.keys(merged).length === 0) {
    return previewPropsForComponent(componentName, snippetSource);
  }

  return propsRecordToJsLiteral(merged);
}

export function orderPreviewComponentsByDsTable<T extends { name: string }>(
  components: T[],
  dsOrder: Array<{ requiredComponent: string }>,
): T[] {
  if (dsOrder.length === 0) return components;
  const rank = new Map<string, number>();
  dsOrder.forEach((row, i) => {
    rank.set(row.requiredComponent.toLowerCase(), i);
  });
  return [...components].sort((a, b) => {
    const ra = rank.get(a.name.toLowerCase()) ?? 999;
    const rb = rank.get(b.name.toLowerCase()) ?? 999;
    return ra - rb;
  });
}
