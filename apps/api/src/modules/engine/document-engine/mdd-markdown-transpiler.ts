import {
  type MddDocumentAst,
  type DocumentSection,
  type DomainModelSection,
  type PhysicalModelSection,
  type RelationsSection,
  type ContextMapSection,
  type FacilitiesSection,
  type TimelineSection,
  type ConstitutionSection,
  type GlossarySection,
  type BusinessRulesSection,
  type SecuritySection,
  type EdgeCasesSection,
  type FieldTypesSection,
} from "@theforge/shared-types/document-ast";

/**
 * RFC-001: MddMarkdownTranspiler — AST → Markdown determinístico.
 *
 * Cada section type tiene su propia plantilla de renderizado.
 * El motor tiene un Map<SectionType, renderer> registrado dinámicamente.
 * Si no hay renderer, cae a markdown genérico (nested headings).
 *
 * La salida es 100% predecible: múltiples pasadas del mismo AST producen
 * exactamente el mismo string (útil para diffing y patch-semantic basado en posición).
 */

export type SectionRenderer = (section: DocumentSection) => string;

/** Render registry: section type → renderer */
const renderRegistry = new Map<string, SectionRenderer>();

export function registerSectionRenderer(type: string, renderer: SectionRenderer): void {
  renderRegistry.set(type, renderer);
}

export function getSectionRenderer(type: string): SectionRenderer | undefined {
  return renderRegistry.get(type);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function h(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function bullet(items: string[]): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "";
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return "";
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const head = `| ${headers.join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Title / Executive Summary
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("title", (s) => {
  const ss = s as any;
  let md = h(1, ss.title || "");
  if (ss.subtitle) md += `\n\n${ss.subtitle}`;
  if (ss.version) md += `\n\n**Versión:** ${ss.version}`;
  if (ss.date) md += `\n**Fecha:** ${ss.date}`;
  if (ss.author) md += `\n**Autor:** ${ss.author}`;
  return md;
});

registerSectionRenderer("executive_summary", (s) => {
  const ss = s as any;
  let md = h(2, ss.heading || "Resumen Ejecutivo");
  if (ss.summary) md += `\n\n${ss.summary}`;
  if (ss.objectives?.length) md += `\n\n${h(3, "Objetivos")}\n\n${bullet(ss.objectives)}`;
  if (ss.deliverables?.length) md += `\n\n${h(3, "Entregables")}\n\n${bullet(ss.deliverables)}`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Context Map
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("context_map", (s) => {
  const ss = s as ContextMapSection;
  let md = h(2, ss.heading || "Mapa de Contextos de Dominio");
  for (const ctx of ss.contexts) {
    md += `\n\n${h(3, ctx.name)}\n`;
    if (ctx.description) md += `\n${ctx.description}\n`;
    if (ctx.features?.length) {
      md += `\n**Características:**\n${bullet(ctx.features)}\n`;
    }
    if (ctx.entities?.length) {
      md += `\n**Entidades:** ${ctx.entities.join(", ")}\n`;
    }
    if (ctx.constraints?.length) {
      md += `\n**Restricciones:**\n${bullet(ctx.constraints)}\n`;
    }
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Domain Model
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("domain_model", (s) => {
  const ss = s as DomainModelSection;
  let md = h(2, ss.heading || "Modelo de Dominio");
  for (const ent of ss.entities) {
    md += `\n\n${h(3, ent.name)}\n`;
    if (ent.displayName) md += `\n*Nombre visible:* ${ent.displayName}\n`;
    if (ent.description) md += `\n${ent.description}\n`;
    if (ent.fields.length) {
      const rows = ent.fields.map((f) => [
        f.name,
        f.type,
        f.nullable ? "" : "NOT NULL",
        f.description || "",
        f.domainSemantics || "",
      ]);
      md += `\n${table(["Campo", "Tipo", "NULL", "Descripción", "Semántica"], rows)}\n`;
    }
    if (ent.businessRules?.length) {
      md += `\n**Reglas de Negocio:**\n${bullet(ent.businessRules)}\n`;
    }
    if (ent.constraints?.length) {
      md += `\n**Restricciones SQL:**\n${bullet(ent.constraints)}\n`;
    }
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Physical Model
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("physical_model", (s) => {
  const ss = s as PhysicalModelSection;
  let md = h(2, ss.heading || "Modelo de Datos (Físico)");
  if (ss.tablePrefix) md += `\n\nPrefijo de tablas: \`${ss.tablePrefix}\``;
  for (const ent of ss.entities) {
    md += `\n\n${h(3, ent.name)}\n`;
    if (ent.description) md += `\n${ent.description}\n`;
    if (ent.fields.length) {
      const rows = ent.fields.map((f) => [
        f.name,
        f.type,
        f.nullable ? "" : "NOT NULL",
        f.description || "",
        f.domainSemantics || "",
      ]);
      md += `\n${table(["Campo", "Tipo", "NULL", "Descripción", "Semántica"], rows)}\n`;
    }
    if (ent.businessRules?.length) {
      md += `\n**Reglas de Negocio:**\n${bullet(ent.businessRules)}\n`;
    }
    if (ent.constraints?.length) {
      md += `\n**Restricciones SQL:**\n${bullet(ent.constraints)}\n`;
    }
  }
  if (ss.partitions?.length) {
    md += `\n\n${h(3, "Particionamiento")}\n`;
    const rows = ss.partitions.map((p) => [p.entity, p.strategy]);
    md += `${table(["Entidad", "Estrategia"], rows)}\n`;
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("relations", (s) => {
  const ss = s as RelationsSection;
  let md = h(2, ss.heading || "Relaciones entre Entidades");
  const rows = ss.relations.map((r) => [
    r.fromEntity,
    r.fromField || "",
    r.type,
    r.toEntity,
    r.toField || "",
    r.description || "",
  ]);
  md += `\n\n${table(
    ["Desde", "Campo", "Tipo", "Hacia", "Campo", "Descripción"],
    rows,
  )}`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Facilities (§4: API)
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("facilities", (s) => {
  const ss = s as FacilitiesSection;
  let md = h(2, ss.heading || "Instalaciones y Contratos de API");
  if (ss.endpoints?.length) {
    const rows = ss.endpoints.map((e) => [
      e.method,
      e.path,
      e.description || "",
      e.requestBody || "",
      e.responseBody || "",
    ]);
    md += `\n\n${table(["Método", "Path", "Descripción", "Request", "Response"], rows)}\n`;
  }
  if (ss.services?.length) {
    md += `\n**Servicios:**\n${bullet(ss.services)}\n`;
  }
  if (ss.integrations?.length) {
    md += `\n**Integraciones:**\n${bullet(ss.integrations)}\n`;
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Business Rules
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("business_rules", (s) => {
  const ss = s as BusinessRulesSection;
  let md = h(2, ss.heading || "Reglas de Negocio");
  const rows = ss.rules.map((r) => [r.priority || "", r.title, r.description]);
  md += `\n\n${table(["Prioridad", "Regla", "Descripción"], rows)}\n`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("edge_cases", (s) => {
  const ss = s as EdgeCasesSection;
  let md = h(2, ss.heading || "Casos Extremos (Edge Cases)");
  const rows = ss.cases.map((c) => [c.scenario, c.expectedBehavior, c.mitigation || ""]);
  md += `\n\n${table(["Caso", "Comportamiento Esperado", "Mitigación"], rows)}\n`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Timeline / Sprints
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("timeline", (s) => {
  const ss = s as TimelineSection;
  let md = h(2, ss.heading || "Línea de Tiempo y Sprints");
  if (ss.totalDuration) md += `\n\n**Duración Total:** ${ss.totalDuration}\n`;
  if (ss.sprints?.length) {
    const rows = ss.sprints.map((sp) => [
      sp.name,
      sp.duration || "",
      sp.stories.join("; "),
      sp.dependencies?.join(", ") || "",
    ]);
    md += `\n${table(["Sprint", "Duración", "Historias", "Dependencias"], rows)}\n`;
  }
  if (ss.milestones?.length) {
    md += `\n${h(3, "Hitos")}\n`;
    for (const m of ss.milestones) {
      md += `\n- **${m.name}**${m.date ? ` (${m.date})` : ""}${m.description ? `: ${m.description}` : ""}`;
    }
    md += "\n";
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Security
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("security", (s) => {
  const ss = s as SecuritySection;
  let md = h(2, ss.heading || "Seguridad y Control de Acceso");
  if (ss.roles?.length) {
    md += `\n\n${h(3, "Roles")}\n`;
    for (const r of ss.roles) {
      md += `\n**${r.name}**\n${bullet(r.permissions)}\n`;
    }
  }
  if (ss.policies?.length) {
    md += `\n${h(3, "Políticas")}\n${bullet(ss.policies)}\n`;
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Glossary
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("glossary", (s) => {
  const ss = s as GlossarySection;
  let md = h(2, ss.heading || "Glosario");
  const rows = ss.terms.map((t) => [
    t.term,
    t.definition,
    (t.synonyms || []).join(", "),
  ]);
  md += `\n\n${table(["Término", "Definición", "Sinónimos"], rows)}\n`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Constitution
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("constitution", (s) => {
  const ss = s as ConstitutionSection;
  let md = h(2, ss.heading || "Constitución del Documento");
  md += `\n\n`;
  if (ss.hasContextMap !== undefined) md += `- Mapa de Contexto: ${ss.hasContextMap ? "Sí" : "No"}\n`;
  if (ss.hasGlossary !== undefined) md += `- Glosario: ${ss.hasGlossary ? "Sí" : "No"}\n`;
  if (ss.hasGherkin !== undefined) md += `- Escenarios Gherkin: ${ss.hasGherkin ? "Sí" : "No"}\n`;
  if (ss.hasStackRationale !== undefined) md += `- Justificación de Stack: ${ss.hasStackRationale ? "Sí" : "No"}\n`;
  if (ss.blockers?.length) {
    md += `\n**Bloqueadores Activos:**\n`;
    md += `${ss.blockers.map((b) => `- ⚠️ ${b}`).join("\n")}`;
  }
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Field Types
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("field_types", (s) => {
  const ss = s as FieldTypesSection;
  let md = h(2, ss.heading || "Tipos de Campo");
  const rows = ss.types.map((t) => [
    t.name,
    t.sqlType || "",
    t.typescriptType || "",
    t.description || "",
    t.length || "",
    t.precision || "",
  ]);
  md += `\n\n${table(["Nombre", "SQL", "TypeScript", "Descripción", "Longitud", "Precisión"], rows)}\n`;
  return md;
});

// ──────────────────────────────────────────────────────────────────────────────
// Fallback: custom_markdown
// ──────────────────────────────────────────────────────────────────────────────
registerSectionRenderer("custom_markdown", (s) => {
  const ss = s as any;
  return ss.markdown || "";
});

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a single section to markdown.
 */
export function renderSection(section: DocumentSection): string {
  const renderer = renderRegistry.get(section.type);
  if (renderer) return renderer(section);
  // Fallback: just heading + metadata dump
  return h(2, section.heading || section.type);
}

/**
 * Render full document AST to complete markdown.
 */
export function renderDocument(doc: MddDocumentAst): string {
  if (!doc.sections) return "";
  const parts = doc.sections.map((sec) => renderSection(sec)).filter(Boolean);
  return parts.join("\n\n---\n\n");
}

/**
 * Render only a single section by its id.
 */
export function renderSectionById(doc: MddDocumentAst, sectionId: string): string | null {
  const sec = doc.sections.find((s) => s.id === sectionId);
  if (!sec) return null;
  return renderSection(sec);
}

/** Deep clone AST node (safe for mutation). */
export function cloneAst<T>(node: T): T {
  return JSON.parse(JSON.stringify(node));
}
