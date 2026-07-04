import { extractSection3Body } from "./mdd-sanitize.js";
import {
  heuristicUiComponentResolver,
  type UiComponentResolver,
} from "../../ui-mcp/ui-component-resolver.js";
import { extractRolesFromMdd, shouldAvoidKanban } from "../../ui-mcp/ui-screen-routes.util.js";

// ---------------------------------------------------------------------------
// UI/UX Design Intent Enrichment
// ---------------------------------------------------------------------------

/**
 * Clasificación semántica de una entidad de dominio.
 */
type EntityClassification = "WorkflowProcess" | "DataRegistry" | "Configuration";

/**
 * Análisis semántico de una entidad extraída del modelo de datos.
 */
interface EntitySemanticAnalysis {
  /** Nombre de la entidad (ej. "projects") */
  name: string;
  /** Clasificación semántica */
  classification: EntityClassification;
  /** Estados del lifecycle (solo para WorkflowProcess) */
  lifecycleStates?: string[];
  /** Colores sugeridos (solo para WorkflowProcess) */
  lifecycleColors?: Record<string, string>;
  /** Tipo de componente UI sugerido (real del MCP si se resolvió, si no genérico heurístico) */
  componentType: string;
  /** Paquete npm del componente cuando proviene de un MCP compatible */
  componentPackage?: string;
  /** Versión del componente cuando proviene de un MCP compatible */
  componentVersion?: string;
  /** Procedencia del componente: heurístico o MCP */
  componentSource?: "heuristic" | "mcp";
  /** Propiedades relevantes del modelo */
  keyFields?: string[];
  /** Nota adicional */
  note?: string;
}

/** Colores pastel para estados de workflow */
const STATE_COLORS: Record<string, string> = {
  draft: "#94A3B8",
  pending: "#FCD34D",
  active: "#60A5FA",
  in_progress: "#60A5FA",
  processing: "#818CF8",
  completed: "#34D399",
  approved: "#22C55E",
  rejected: "#EF4444",
  cancelled: "#A1A1AA",
  archived: "#A1A1AA",
  failed: "#EF4444",
  paused: "#FBBF24",
  published: "#34D399",
  reviewed: "#22C55E",
  submitted: "#60A5FA",
  confirmed: "#22C55E",
  default: "#94A3B8",
};

/**
 * Heurísticas para clasificar una entidad según su nombre y campos.
 * WorkflowProcess: entidades con estados/ciclos de vida (verbs + status/state columns)
 * DataRegistry: entidades CRUD puras (nouns, reference/lookup data)
 * Configuration: entidades de configuración (settings, precios, parámetros)
 */
function classifyEntity(name: string): EntityClassification {
  const lower = name.toLowerCase();

  // Logs / outbox / sesiones — registros append-only o técnicos, no kanban
  if (/^audit_events?$/.test(lower) || /^outbox_events?$/.test(lower) || /^sessions?$/.test(lower)) {
    return "DataRegistry";
  }

  // Configuraciones — entidades de parámetros, precios, settings
  const configPatterns = [
    /^config/, /^setting/, /^param/, /^price/, /^rate/, /^fee/,
    /^tariff/, /^threshold/, /^policy/, /^rule/, /^plan$/,
    /^promotion/, /^discount/, /^tax/, /^commission/,
  ];
  if (configPatterns.some((p) => p.test(lower))) return "Configuration";

  // WorkflowProcess — entidades con lifecycle (verbos, estados)
  const workflowPatterns = [
    /order/, /request/, /task/, /job/, /booking/, /reservation/,
    /appointment/, /claim/, /ticket/, /shipment/, /delivery/,
    /invoice/, /payment/, /transaction/, /application/,
    /process/, /workflow/, /campaign/, /project$/,
    /session/, /review/, /audit/, /subscription/,
    /enrollment/, /registration/, /nomination/, /proposal/,
    /incident/, /complaint/, /feedback/, /evaluation/,
    /approval/, /leave/, /attendance/, /notification/,
  ];
  if (workflowPatterns.some((p) => p.test(lower))) return "WorkflowProcess";

  // DataRegistry — entidades CRUD (sustantivos, referencias, catálogos)
  const registryPatterns = [
    /user/, /customer/, /client/, /member/, /patient/,
    /employee/, /vendor/, /supplier/, /partner/,
    /product/, /service/, /item/, /inventory/,
    /category/, /tag/, /label/, /type$/, /status/,
    /role/, /permission/, /group/, /team/, /department/,
    /location/, /address/, /branch/, /office/, /store/,
    /account/, /profile/, /contact/, /document$/,
    /file/, /image/, /asset/, /resource/,
    /template/, /content/, /article/, /post/,
    /schedule/, /calendar/, /event/,
  ];
  if (registryPatterns.some((p) => p.test(lower))) return "DataRegistry";

  // Por defecto: DataRegistry (seguro)
  return "DataRegistry";
}

/**
 * Infiere estados de lifecycle basados en el nombre de la entidad.
 */
function inferLifecycle(name: string): string[] {
  const lower = name.toLowerCase();

  if (/^export_requests?$/.test(lower)) {
    return ["pending", "first_approved", "approved", "completed", "rejected", "expired"];
  }

  const lifecycleMap: Record<string, string[]> = {
    // Órdenes / transacciones
    order: ["draft", "confirmed", "processing", "completed", "cancelled"],
    transaction: ["pending", "processing", "completed", "failed", "reversed"],
    payment: ["pending", "processing", "completed", "failed", "refunded"],
    invoice: ["draft", "sent", "overdue", "paid", "cancelled"],
    booking: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
    reservation: ["pending", "confirmed", "checked_in", "checked_out", "cancelled"],
    // Solicitudes / peticiones
    request: ["draft", "submitted", "reviewing", "approved", "rejected"],
    application: ["draft", "submitted", "reviewing", "approved", "rejected"],
    claim: ["draft", "submitted", "verifying", "approved", "rejected"],
    proposal: ["draft", "submitted", "reviewing", "accepted", "rejected"],
    // Tareas / jobs
    task: ["pending", "in_progress", "completed", "blocked", "cancelled"],
    job: ["pending", "running", "completed", "failed", "cancelled"],
    project: ["draft", "active", "in_progress", "completed", "archived"],
    campaign: ["draft", "scheduled", "active", "paused", "completed"],
    // Envíos / logística
    shipment: ["preparing", "in_transit", "delivered", "failed", "returned"],
    delivery: ["pending", "assigned", "in_transit", "delivered", "failed"],
    // Suscripciones
    subscription: ["active", "paused", "past_due", "cancelled", "expired"],
    enrollment: ["pending", "active", "completed", "dropped", "cancelled"],
    // Notificaciones / auditoría
    notification: ["pending", "sent", "delivered", "failed", "read"],
    audit: ["pending", "in_progress", "completed", "resolved"],
    review: ["pending", "in_progress", "completed", "appealed"],
    approval: ["pending", "approved", "rejected", "escalated"],
    export: ["pending", "first_approved", "approved", "completed", "rejected", "expired"],
    session: ["pending", "active", "completed", "expired", "cancelled"],
    feedback: ["draft", "submitted", "reviewed", "acknowledged"],
    incident: ["reported", "investigating", "resolved", "closed"],
    ticket: ["open", "in_progress", "resolved", "closed", "reopened"],
  };

  // Check exact match first
  if (lifecycleMap[lower]) return [...lifecycleMap[lower]];

  // Check substring match
  for (const [key, states] of Object.entries(lifecycleMap)) {
    if (lower.includes(key) || key.includes(lower)) return [...states];
  }

  // Default lifecycle
  return ["draft", "active", "completed", "archived"];
}

/**
 * Asigna colores a estados de lifecycle.
 */
function assignColors(states: string[]): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const state of states) {
    colors[state] = STATE_COLORS[state] ?? STATE_COLORS.default;
  }
  return colors;
}

/**
 * Determina el tipo de componente UI recomendado según la clasificación.
 */
function suggestComponentType(
  classification: EntityClassification,
  name: string,
): string {
  const lower = name.toLowerCase();
  switch (classification) {
    case "WorkflowProcess":
      if (/order|booking|reservation/.test(lower)) return "KanbanOrderBoard";
      if (/request|application|claim|proposal/.test(lower)) return "KanbanRequestBoard";
      if (/task|job|project/.test(lower)) return "KanbanTaskBoard";
      return "KanbanBoard";
    case "DataRegistry":
      if (/user|customer|client|member|employee/.test(lower)) return "UserTable";
      if (/product|service|item|inventory/.test(lower)) return "CatalogGrid";
      if (/document|file|content|article/.test(lower)) return "DocumentList";
      if (/category|tag|label|type|status|role/.test(lower)) return "ReferenceTable";
      return "DataTable";
    case "Configuration":
      if (/^plan$|price|rate|fee/.test(lower)) return "PropertyGrid";
      if (/setting|config|param/.test(lower)) return "SettingsPanel";
      return "PropertyGrid";
  }
}

/** Extrae nombres de columna del bloque CREATE TABLE de una entidad en §3. */
function extractColumnsFromCreateTable(section3: string, tableName: string): string[] {
  const tableRe = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    "i",
  );
  const match = section3.match(tableRe);
  if (!match?.[1]) return [];
  const cols: string[] = [];
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    const col = trimmed.match(/^(\w+)\s+/);
    if (!col?.[1]) continue;
    const name = col[1];
    if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|REFERENCES)$/i.test(name)) continue;
    if (!cols.includes(name)) cols.push(name);
  }
  return cols;
}

/** Elige columnas de UI a partir del DDL real (fallback a heurística por nombre). */
function pickDisplayColumns(tableName: string, allCols: string[]): string[] {
  if (allCols.length === 0) return suggestKeyFields(tableName);
  const picked: string[] = [];
  if (allCols.includes("id")) picked.push("id");
  for (const candidate of ["name", "title", "label", "username", "email", "display_name"]) {
    if (allCols.includes(candidate) && !picked.includes(candidate)) {
      picked.push(candidate);
      break;
    }
  }
  for (const candidate of ["state", "status", "is_active"]) {
    if (allCols.includes(candidate) && !picked.includes(candidate)) {
      picked.push(candidate);
      break;
    }
  }
  for (const candidate of ["key_type", "algorithm", "created_at", "updated_at", "expires_at"]) {
    if (allCols.includes(candidate) && picked.length < 5 && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  for (const col of allCols) {
    if (picked.length >= 5) break;
    if (picked.includes(col)) continue;
    if (/_hash$|_encrypted$|password_hash/i.test(col)) continue;
    if (/_id$/.test(col) && col !== "id") continue;
    picked.push(col);
  }
  return picked.length > 0 ? picked : suggestKeyFields(tableName);
}

/**
 * Sugiere fields clave del modelo para mapear a props del componente.
 */
function suggestKeyFields(name: string): string[] {
  const lower = name.toLowerCase();

  if (lower.includes("user") || lower.includes("customer") || lower.includes("member")) {
    return ["id", "name", "email", "status"];
  }
  if (lower.includes("order") || lower.includes("booking") || lower.includes("reservation")) {
    return ["id", "status", "created_at", "updated_at"];
  }
  if (lower.includes("product") || lower.includes("service") || lower.includes("item")) {
    return ["id", "name", "price", "status"];
  }

  return ["id", "name", "status"];
}

/**
 * Sugiere nota semántica adicional.
 */
function suggestNote(name: string, classification: EntityClassification): string | undefined {
  const lower = name.toLowerCase();
  if (classification === "WorkflowProcess") {
    return `Requiere tracking de cambios de estado y auditoría de transiciones.`;
  }
  if (classification === "DataRegistry") {
    if (/user|customer|client|member/.test(lower)) {
      return `Requiere búsqueda y filtrado avanzado.`;
    }
    if (/category|tag|label|type|role/.test(lower)) {
      return `Catálogo referencial de valores predefinidos.`;
    }
  }
  if (classification === "Configuration") {
    return `Valores editables por administrador con validación de reglas de negocio.`;
  }
  return undefined;
}

/**
 * Parsea los nombres de entidades (CREATE TABLE) de la sección §3 del MDD.
 */
function parseEntitiesFromSection3(section3: string): string[] {
  const entities: string[] = [];
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|)(\w+)(?:`|"|'|)/gi;
  let match;
  while ((match = regex.exec(section3)) !== null) {
    const name = match[1];
    if (name && !entities.includes(name)) {
      entities.push(name);
    }
  }
  return entities;
}

/**
 * Analiza semánticamente una entidad del modelo de datos.
 *
 * El componente UI se calcula primero por heurística (`suggestComponentType`) y luego se delega al
 * `resolver`: con el resolver heurístico (por defecto) el resultado es idéntico al comportamiento
 * previo; con un `McpUiComponentResolver` puede sustituirse por un componente real del MCP (con
 * fallback por-entidad al heurístico si el MCP falla).
 */
async function analyzeEntity(
  name: string,
  section3: string | undefined,
  resolver: UiComponentResolver,
): Promise<EntitySemanticAnalysis> {
  const classification = classifyEntity(name);
  const ddlCols = section3 ? extractColumnsFromCreateTable(section3, name) : [];
  const keyFields = pickDisplayColumns(name, ddlCols);
  const heuristicComponent = suggestComponentType(classification, name);
  const note = suggestNote(name, classification);

  const lifecycleStates =
    classification === "WorkflowProcess" ? inferLifecycle(name) : undefined;

  const resolved = await resolver.resolve({
    name,
    classification,
    keyFields,
    lifecycleStates,
    heuristicComponent,
  });

  const analysis: EntitySemanticAnalysis = {
    name,
    classification,
    componentType: resolved.componentType,
    componentPackage: resolved.package,
    componentVersion: resolved.version,
    componentSource: resolved.source,
    keyFields,
  };

  if (classification === "WorkflowProcess" && lifecycleStates) {
    analysis.lifecycleStates = lifecycleStates;
    analysis.lifecycleColors = assignColors(lifecycleStates);
  }

  if (note) analysis.note = note;

  return analysis;
}

/** Renderiza `componente` + `(pkg@version)` cuando el componente proviene de un MCP. */
function renderComponentLabel(entity: EntitySemanticAnalysis): string {
  const base = `\`${entity.componentType}\``;
  if (entity.componentSource === "mcp" && entity.componentPackage) {
    const ver = entity.componentVersion ? `@${entity.componentVersion}` : "";
    return `${base} (\`${entity.componentPackage}${ver}\`)`;
  }
  return base;
}

function buildPersonaJourneyParagraphs(roles: string[], entityCount: number): string[] {
  const paragraphs: string[] = [];
  for (const role of roles.slice(0, 4)) {
    paragraphs.push(
      `**${role}** accede al producto con objetivos concretos del dominio descrito en §1. ` +
        `Su journey principal combina autenticación, navegación en \`AppLayout\` y tareas sobre datos ` +
        `del modelo §3 (${entityCount} entidades) sin asumir un CRUD por tabla. ` +
        `Las pantallas, rutas y APIs ejecutables se documentan en \`pantallas.md\` y deben trazarse a historias de usuario.`,
    );
  }
  if (paragraphs.length < 2 && roles.length === 1) {
    paragraphs.push(
      `El flujo transversal conecta onboarding, operación diaria y tareas puntuales (formularios, listados, feedback). ` +
        `Prioriza journeys completos sobre pantallas aisladas por entidad; estados \`loading\`, \`empty\` y \`error\` son obligatorios en login, dashboard y listados principales.`,
    );
  }
  return paragraphs.slice(0, 4);
}

/**
 * Genera la sección UI/UX Design Intent orientada a journeys (no mapeo entidad→componente).
 */
async function buildUiUxDesignIntentSection(
  mddMarkdown: string,
  section3: string,
): Promise<string | null> {
  const entityNames = parseEntitiesFromSection3(section3);
  if (entityNames.length === 0) return null;

  const roles = extractRolesFromMdd(mddMarkdown);
  const kanbanCandidates = entityNames.filter(
    (n) => classifyEntity(n) === "WorkflowProcess" && !shouldAvoidKanban(n),
  );
  const adminOnlyEntities = entityNames.filter(
    (n) => shouldAvoidKanban(n) || classifyEntity(n) === "Configuration",
  );

  const lines: string[] = [];
  lines.push("## UI/UX Design Intent");
  lines.push("");
  lines.push(
    "> Directrices de alto nivel para UI. El mapa ejecutable **pantalla → ruta → componente UI → API** " +
      "vive en `pantallas.md`. **No** uses tabla entidad→componente ni `GET /api/v1/{tabla}` genéricos.",
  );
  lines.push("");

  lines.push("### Personas y journeys");
  lines.push("");
  for (const p of buildPersonaJourneyParagraphs(roles, entityNames.length)) {
    lines.push(p);
    lines.push("");
  }

  lines.push("### Matriz pantalla→componente");
  lines.push("");
  lines.push(
    "Detalle ejecutable en **`pantallas.md`** (spec-kit). Resumen de columnas obligatorias:",
  );
  lines.push("");
  lines.push("| Ruta | Componentes UI | API (api-contracts) | Estados |");
  lines.push("|------|----------------|---------------------|---------|");
  lines.push(
    "| _ver pantallas.md_ | _catálogo MCP activo o shadcn_ | _método + ruta exacta_ | _loading, empty, error_ |",
  );
  lines.push("");
  lines.push(
    "Roles con nav: " + roles.map((r) => `\`${r}\``).join(", ") + ". Cada fila de `pantallas.md` debe trazarse a una US con **🎨 Criterios UI**.",
  );
  lines.push("");

  lines.push("### Reglas de composición");
  lines.push("");
  lines.push("- **Formularios** = componente formulario del stack + schema Zod alineado al DTO de `api-contracts.md`.");
  lines.push("- **Listados** = tabla + filtros + paginación (nombres según `pantallas.md` / MCP activo); bajo `md` → cards apiladas.");
  lines.push("- **Dashboard** = KPIs + gráficas según catálogo activo; sin duplicar métricas sin US.");
  lines.push("- **Pipeline arrastrable (Kanban)** solo si el journey lo exige (validar en `pantallas.md`).");
  lines.push("- Endpoints **solo** de `api-contracts.md`; tokens **solo** de `design-system.md`.");
  lines.push("");

  lines.push("### Componentes transversales");
  lines.push("");
  lines.push("- **Layout shell** (`AppLayout` o equivalente): nav por rol (ítems, iconos, orden); rutas protegidas JWT (`role`, `tenant_id`).");
  lines.push("- **Estado vacío:** CTA contextual en listados sin datos.");
  lines.push("- **Toast / feedback:** éxito tras POST/PUT; errores API cerca del formulario o banner.");
  lines.push("- **Modales globales:** impersonación, quota LLM 80%/100% (documentar trigger en Tasks).");
  lines.push("- **Responsive:** sm 640 / md 768 / lg 1024 / xl 1280; touch ≥ 44×44px; WCAG AA.");
  lines.push("");

  lines.push("### Fuera de alcance UI v1");
  lines.push("");
  lines.push("- CRUD admin por entidad §3 sin endpoint en `api-contracts.md`.");
  lines.push("- Pipeline arrastrable (Kanban) en entidades técnicas (sesiones OTP, audit logs, outbox).");
  if (kanbanCandidates.length > 0) {
    lines.push(
      `- Pipeline visual para \`${kanbanCandidates.slice(0, 6).join("`, `")}\` — solo si una US lo exige explícitamente.`,
    );
  }
  if (adminOnlyEntities.length > 0) {
    lines.push(
      `- Configuración interna (\`${adminOnlyEntities.slice(0, 8).join("`, `")}\`) sin pantalla en user stories.`,
    );
  }
  lines.push("");

  lines.push("### Referencia cruzada");
  lines.push("");
  lines.push("| Artefacto | Rol |");
  lines.push("|---|---|");
  lines.push("| `design-system.md` | Tokens, tema, accesibilidad (única SSOT visual) |");
  lines.push("| `pantallas.md` | Ruta, componentes UI, API, estados (**gana** sobre Blueprint §8) |");
  lines.push("| `ui-project.json` | Prototipo MCP (opcional; solo si el MCP activo lo soporta) |");
  lines.push("| `user-stories.md` / `tasks.md` | 🎨 Criterios UI y tareas **por pantalla** |");
  lines.push("");

  return lines.join("\n") + "\n";
}

/**
 * Enriquecimiento semántico: analiza el MDD y añade la sección
 * "## UI/UX Design Intent" con clasificación de entidades y sugerencias de UI.
 */
export async function enrichMddWithUiUxDesignIntent(
  markdown: string,
  _resolver: UiComponentResolver = heuristicUiComponentResolver,
): Promise<string> {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return markdown;
  if (/^##\s*UI\/UX\s+Design\s+Intent/im.test(trimmed) && isCompleteUiUxIntent(trimmed) && !isLegacyEntityUiIntent(trimmed)) {
    return markdown;
  }

  const section3 = extractSection3Body(trimmed);
  if (!section3) return markdown;

  const core = isLegacyEntityUiIntent(trimmed)
    ? trimmed.replace(/\n##\s*UI\/UX\s+Design\s+Intent[\s\S]*$/i, "").trim()
    : trimmed;

  const section = await buildUiUxDesignIntentSection(core, section3);
  if (!section) return markdown;
  return `${core}\n\n${section}`;
}

function isLegacyEntityUiIntent(markdown: string): boolean {
  return (
    /###\s*Entity Classification/i.test(markdown) ||
    /GET \/api\/v1\//i.test(markdown) ||
    /###\s*Journeys y roles/i.test(markdown) ||
    /###\s*Dominio §3 — \*\*no\*\* auto-mapear/i.test(markdown)
  );
}

function isCompleteUiUxIntent(markdown: string): boolean {
  return (
    /###\s*Personas y journeys/i.test(markdown) &&
    /###\s*Matriz pantalla/i.test(markdown) &&
    /###\s*Reglas de composición/i.test(markdown) &&
    /###\s*Componentes transversales/i.test(markdown) &&
    /###\s*Fuera de alcance UI v1/i.test(markdown)
  );
}

/** Regenera UI/UX cuando la sección existente usa columnas genéricas repetidas. */
export async function reconcileUiUxDesignIntent(
  markdown: string,
  resolver: UiComponentResolver = heuristicUiComponentResolver,
): Promise<string> {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return markdown;

  const section3 = extractSection3Body(trimmed);
  if (!section3) return markdown;

  const hasUi = /##\s*UI\/UX\s+Design\s+Intent/i.test(trimmed);
  const legacy = isLegacyEntityUiIntent(trimmed);
  const complete = isCompleteUiUxIntent(trimmed);
  const genericHits = (trimmed.match(/\bid,\s*name,\s*status\b/g) ?? []).length;
  if (hasUi && complete && !legacy && genericHits < 4) return markdown;

  const core = hasUi
    ? trimmed.replace(/\n##\s*UI\/UX\s+Design\s+Intent[\s\S]*$/i, "").trim()
    : trimmed;

  const section = await buildUiUxDesignIntentSection(core, section3);
  if (!section) return markdown;
  return `${core}\n\n${section}`;
}