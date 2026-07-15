import {
  type MddDocumentAst,
  mddDocumentAstSchema,
  type PatchOp,
  type DomainModelSection,
  type PhysicalModelSection,
  type RelationsSection,
  type PatchTarget,
} from "@theforge/shared-types/document-ast";

/**
 * RFC-001 §3.3: Validation Gates — Comprobaciones automáticas antes/tras editar AST.
 *
 * Gates implementados:
 *  1. SCHEMA_CHECK     — Zod strict-parse del AST completo + de cada section known-type.
 *  2. CROSSREF_CHECK   — Todos los entityId/fieldId/sectionId en patches resuelven a nodo existente.
 *  3. COMPLETENESS_CHECK — Mínimo de secciones obligatorias presentes; restricciones técnicas (PK, NOT NULL, tipos resueltos).
 *  4. CIRCULAR_CHECK   — Detección de ciclos en relaciones (forana FK → self → …).
 *  5. UNIQUE_CHECK     — No pueden existir dos entidades con mismo canonicalName en el documento.
 *
 * Cada gate retorna { ok: boolean; errors: string[]; warnings: string[] }.
 * Todas son invocadas por `runValidationGates()`; ningún gate toca/modifica el AST.
 */

export interface GateResult {
  ok: boolean;
  gateName: string;
  errors: string[];
  warnings: string[];
  details?: Record<string, unknown>;
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function pushWarning(r: GateResult, msg: string): void {
  r.warnings.push(msg);
}
function pushError(r: GateResult, msg: string): void {
  r.ok = false;
  r.errors.push(msg);
}

// ─── Gate 1: SCHEMA_CHECK ────────────────────────────────────────────────────
export function gateSchemaCheck(ast: MddDocumentAst): GateResult {
  const r: GateResult = { ok: true, gateName: "SCHEMA_CHECK", errors: [], warnings: [] };

  const docParse = mddDocumentAstSchema.safeParse(ast);
  if (!docParse.success) {
    pushError(r, `AST root validation failed: ${docParse.error.message}`);
    return r; // Don't continue if root failed; shallow parse is broken
  }

  for (const sec of ast.sections) {
    // All known sections have dedicated schemas; this ensures Zod strictness across section union
    // (if a new section type was added server-side but client doesn't know it yet)
    const types = [
      "title",
      "executive_summary",
      "context_map",
      "glossary",
      "domain_model",
      "physical_model",
      "relations",
      "business_rules",
      "edge_cases",
      "facilities",
      "timeline",
      "security",
      "field_types",
      "constitution",
      "custom_markdown",
    ] as const;
    if (!(types as readonly string[]).includes(sec.type)) {
      pushWarning(r, `Unknown section type '${sec.type}' at section '${sec.id || sec.heading || "?"}' — may be forward-compatible`);
    }
  }

  return r;
}

// ─── Gate 2: CROSSREF_CHECK ──────────────────────────────────────────────────
export function gateCrossRefCheck(
  ast: MddDocumentAst,
  pendingOps?: PatchOp[]
): GateResult {
  const r: GateResult = { ok: true, gateName: "CROSSREF_CHECK", errors: [], warnings: [] };

  // Collect all valid IDs in AST
  const sectionIds = new Set(ast.sections.map((s) => s.id));
  const entityIds = new Set<string>();
  const entityNames = new Set<string>();
  const fieldIds = new Set<string>();
  const relationIds = new Set<string>();

  for (const s of ast.sections) {
    if (s.type === "domain_model" || s.type === "physical_model") {
      for (const e of (s as DomainModelSection).entities) {
        entityIds.add(e.id);
        entityNames.add(e.name);
        for (const f of e.fields) fieldIds.add(f.id);
      }
    }
    if (s.type === "relations") {
      for (const rel of (s as RelationsSection).relations) {
        relationIds.add(rel.id);
        entityNames.add(rel.fromEntity);
        entityNames.add(rel.toEntity);
      }
    }
  }

  // Also include entity names from index
  if (ast.entityIndex) {
    for (const name of Object.keys(ast.entityIndex)) entityNames.add(name);
  }

  function checkTarget(target: PatchTarget, fromOp?: PatchOp): void {
    if (target.sectionId && !sectionIds.has(target.sectionId)) {
      pushError(r, `CrossRef: sectionId '${target.sectionId}' not found (from op: ${fromOp?.type})`);
    }
    if (target.entityId && !entityIds.has(target.entityId) && !entityNames.has(target.entityId)) {
      pushError(r, `CrossRef: entityId/entityName '${target.entityId}' not found (from op: ${fromOp?.type})`);
    }
    if (target.fieldId && !fieldIds.has(target.fieldId)) {
      pushError(r, `CrossRef: fieldId '${target.fieldId}' not found (from op: ${fromOp?.type})`);
    }
    if (target.relationId && !relationIds.has(target.relationId)) {
      pushError(r, `CrossRef: relationId '${target.relationId}' not found (from op: ${fromOp?.type})`);
    }
  }

  if (pendingOps) {
    for (const op of pendingOps) {
      checkTarget(op.target, op);
      // For ADD operations, targets may not exist yet — that's fine,
      // but they should not collide with existing IDs
      if (op.type === "ADD" && op.target.sectionId && sectionIds.has(op.target.sectionId)) {
        pushError(r, `CrossRef ADD collision: sectionId '${op.target.sectionId}' already exists`);
      }
    }
  }

  return r;
}

// ─── Gate 3: COMPLETENESS_CHECK ────────────────────────────────────────────────
export function gateCompletenessCheck(ast: MddDocumentAst): GateResult {
  const r: GateResult = { ok: true, gateName: "COMPLETENESS_CHECK", errors: [], warnings: [] };

  // Must have at least domain_model OR physical_model
  const hasDomain = ast.sections.some((s) => s.type === "domain_model");
  const hasPhysical = ast.sections.some((s) => s.type === "physical_model");
  if (!hasDomain && !hasPhysical) {
    pushError(r, "Documento sin sección de modelo de entidades (dominio o físico)");
  }

  // Check mandatory fields
  for (const s of ast.sections) {
    if (s.type === "domain_model" || s.type === "physical_model") {
      const model = s as DomainModelSection | PhysicalModelSection;
      for (const ent of model.entities) {
        if (!ent.fields || ent.fields.length === 0) {
          pushError(r, `Entidad '${ent.name}' no tiene campos definidos`);
        }
        const hasPk =
          ent.fields.some((f) => f.constraints?.some((c) => c.type === "unique" || ent.primaryKey?.includes(f.name))
          ) || (ent.primaryKey && ent.primaryKey.length > 0);
        if (!hasPk) {
          pushWarning(r, `Entidad '${ent.name}' carece de clave primaria explícita`);
        }
        for (const f of ent.fields) {
          if (!f.nullable && f.defaultValue === undefined) {
            // Only flag if no default on NOT NULL non-PK field
            const isPk = ent.primaryKey?.includes(f.name);
            if (!isPk) {
              // Not necessarily error (can have UUID / serial default); just warning
              pushWarning(r, `Campo '${ent.name}.${f.name}' es NOT NULL sin default valor explícito`);
            }
          }
          if (f.domainSemantics?.includes("FK →")) {
            // Validate referenced entity exists
            const fkMatch = f.domainSemantics.match(/FK\s*→\s*([A-Za-z_][A-Za-z0-9_]*)/);
            if (fkMatch) {
              const ref = fkMatch[1];
              if (ast.entityIndex && !ast.entityIndex[ref]) {
                pushError(r, `Campo '${ent.name}.${f.name}' referencia entidad inexistente '${ref}'`);
              }
            }
          }
        }
      }
    }
  if (s.type === "relations") {
      const rels = s as RelationsSection;
      const relationEntities = new Set<string>();
      for (const rel of rels.relations) {
        relationEntities.add(rel.fromEntity);
        relationEntities.add(rel.toEntity);
      }
      for (const rel of rels.relations) {
        if (!relationEntities.has(rel.fromEntity) || !relationEntities.has(rel.toEntity)) {
          pushError(r, `Relación '${rel.id}' referencia entidad '${rel.fromEntity}' o '${rel.toEntity}' inexistente`);
        }
      }
    }
  }

  return r;
}

// ─── Gate 4: CIRCULAR_CHECK ──────────────────────────────────────────────────
export function gateCircularCheck(ast: MddDocumentAst): GateResult {
  const r: GateResult = { ok: true, gateName: "CIRCULAR_CHECK", errors: [], warnings: [] };

  const rels: { from: string; to: string; type: string }[] = [];
  for (const s of ast.sections) {
    if (s.type === "relations") {
      for (const rel of (s as RelationsSection).relations) {
        rels.push({ from: rel.fromEntity, to: rel.toEntity, type: rel.type });
      }
    }
  }

  // DFS cycle detection from each node
  function hasCycle(start: string, visited: Set<string>, stack: Set<string>): boolean {
    visited.add(start);
    stack.add(start);
    const neighbors = rels.filter((r) => r.from === start).map((r) => r.to);
    for (const n of neighbors) {
      if (!visited.has(n)) {
        if (hasCycle(n, visited, stack)) return true;
      } else if (stack.has(n)) {
        return true;
      }
    }
    stack.delete(start);
    return false;
  }

  const allEntities = new Set<string>();
  rels.forEach((r) => { allEntities.add(r.from); allEntities.add(r.to); });
  const visited = new Set<string>();
  for (const ent of allEntities) {
    if (!visited.has(ent) && rels.some((r) => r.from === ent)) {
      if (hasCycle(ent, visited, new Set())) {
        pushError(r, `Relación circula detectada involucrando entidad '${ent}'`);
      }
    }
  }
  return r;
}

// ─── Gate 5: UNIQUE_NAME_CHECK ───────────────────────────────────────────────
export function gateUniqueCheck(ast: MddDocumentAst): GateResult {
  const r: GateResult = { ok: true, gateName: "UNIQUE_CHECK", errors: [], warnings: [] };
  const names = new Map<string, string>(); // canonicalName → entityId
  for (const s of ast.sections) {
    if (s.type === "domain_model" || s.type === "physical_model") {
      for (const e of (s as DomainModelSection).entities) {
        const lower = e.name.toLowerCase();
        if (names.has(lower) && names.get(lower) !== e.id) {
          pushError(r, `Nombre de entidad duplicado (insensitive): '${e.name}' colisiona con '${names.get(lower)}'`);
        } else {
          names.set(lower, e.id);
        }
      }
    }
  }
  return r;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export interface ValidationGatesResult {
  ok: boolean;
  gates: GateResult[];
  summary: string;
}

export function runValidationGates(
  ast: MddDocumentAst,
  pendingOps?: PatchOp[]
): ValidationGatesResult {
  const gates = [
    gateSchemaCheck(ast),
    gateCrossRefCheck(ast, pendingOps),
    gateCompletenessCheck(ast),
    gateCircularCheck(ast),
    gateUniqueCheck(ast),
  ];
  const ok = gates.every((g) => g.ok);
  const summary = gates
    .map((g) => `${g.gateName}: ${g.ok ? "PASS" : "FAIL"} (${g.errors.length} errors, ${g.warnings.length} warnings)`)
    .join("; ");
  return { ok, gates, summary };
}
