import {
  type MddDocumentAst,
  type DocumentSection,
  type PatchOp,
  type PatchTarget,
  type DomainModelSection,
  type PhysicalModelSection,
  type DocumentEntity,
  type DocumentField,
  patchOpSchema,
} from "@theforge/shared-types/document-ast";
import { cloneAst } from "./mdd-markdown-transpiler.js";

/**
 * RFC-001 §3.3: DocumentPatchEngine — Aplica operaciones atómicas al AST.
 *
 * Support operations:
 *   ADD          → añade nueva section/entity/field/relation/context
 *   MODIFY       → edita un campo existente (entity description, field type, context feature, etc.)
 *   DELETE       → elimina element atomicamente
 *   REPLACE_SECTION → reemplaza una sección entera (mapea type conocido → render)
 *   REPLACE_FIELD   → reemplaza un campo específico dentro de una entity
 *   ADD_FIELD       → añade nuevo campo a un entity existente
 *
 * Idempotencia: misma operación aplicada 2 veces = no-op la segunda (hash/entity-id check).
 * Isolación: múltiples operaciones dentro de un patch se aplican en orden; si una falla
 *   rollback a estado original (deep clone).
 *
 * ⚠️ Safety: NO parsea markdown. Trabaja directamente sobre objetos AST.
 */

export interface ApplyPatchResult {
  success: boolean;
  appliedOperations: number;
  failedOperations: { op: PatchOp; reason: string }[];
  newVersion: number;
  /** Deep-cloned AST modificado (no side-effects sobre el original) */
  ast: MddDocumentAst;
}

/** Deep finds a section by id or type fallback. */
function findSection(ast: MddDocumentAst, target: PatchTarget): DocumentSection | undefined {
  if (target.sectionType) {
    return ast.sections.find((s) => s.type === target.sectionType);
  }
  if (target.sectionId) {
    return ast.sections.find((s) => s.id === target.sectionId);
  }
  return undefined;
}

function findSectionIndex(ast: MddDocumentAst, target: PatchTarget): number {
  if (target.sectionType) {
    return ast.sections.findIndex((s) => s.type === target.sectionType);
  }
  if (target.sectionId) {
    return ast.sections.findIndex((s) => s.id === target.sectionId);
  }
  return -1;
}

function findEntity(section: DocumentSection, entityId: string): DocumentEntity | undefined {
  if (section.type === "domain_model" || section.type === "physical_model") {
    return (section as DomainModelSection | PhysicalModelSection).entities.find(
      (e) => e.id === entityId || e.name === entityId,
    );
  }
  return undefined;
}

function findEntityField(entity: DocumentEntity, fieldId: string): DocumentField | undefined {
  return entity.fields.find((f) => f.id === fieldId || f.name === fieldId);
}

// ─── ADD ───────────────────────────────────────────────────────────────────────
function applyAdd(ast: MddDocumentAst, op: PatchOp): string | null {
  // Section-level add
  if (op.target.sectionType && !op.target.entityId && !op.target.fieldId) {
    const existing = findSectionIndex(ast, op.target);
    if (existing >= 0) return `Section with id/type already exists`;
    const newSection = op.value as DocumentSection;
    if (!newSection) return "ADD operation missing value";
    ast.sections.push(newSection);
    return null;
  }

  // Entity-level add (within domain/physical model section)
  const sec = op.target.sectionId
    ? findSection(ast, op.target)
    : ast.sections.find(
        (s) => s.type === "domain_model" || s.type === "physical_model",
      );
  if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
    return "Target section not found or not an entity-holding section";
  }
  const modelSec = sec as DomainModelSection | PhysicalModelSection;
  const newEntity = op.value as DocumentEntity;
  if (!newEntity) return "ADD entity missing value";
  if (modelSec.entities.some((e) => e.id === newEntity.id || e.name === newEntity.name)) {
    return `Entity '${newEntity.name}' already exists`;
  }
  modelSec.entities.push(newEntity);
  // Update entityIndex
  if (ast.entityIndex) {
    ast.entityIndex[newEntity.name] = {
      type: sec.type === "domain_model" ? "domain" : "physical",
      sectionIds: [sec.id],
      canonicalName: newEntity.name,
    };
  }
  return null;
}

// ─── MODIFY ──────────────────────────────────────────────────────────────────
function applyModify(ast: MddDocumentAst, op: PatchOp): string | null {
  // Field-level modify
  if (op.target.entityId && op.target.fieldId) {
    const sec = findSection(ast, op.target);
    if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
      return "Entity-holding section not found";
    }
    const ent = findEntity(sec, op.target.entityId);
    if (!ent) return `Entity '${op.target.entityId}' not found`;
    const field = findEntityField(ent, op.target.fieldId);
    if (!field) return `Field '${op.target.fieldId}' not found in entity '${ent.name}'`;
    const updates = op.value as Partial<DocumentField>;
    if (!updates) return "MODIFY missing value";
    Object.assign(field, updates);
    return null;
  }

  // Entity-level modify
  if (op.target.entityId) {
    const sec = findSection(ast, op.target);
    if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
      return "Entity-holding section not found";
    }
    const ent = findEntity(sec, op.target.entityId);
    if (!ent) return `Entity '${op.target.entityId}' not found`;
    const updates = op.value as Partial<DocumentEntity>;
    if (!updates) return "MODIFY missing value";
    Object.assign(ent, updates);
    return null;
  }

  // Section-level modify (heading, metadata)
  const sec = findSection(ast, op.target);
  if (!sec) return `Section not found for target`;
  const updates = op.value as Partial<DocumentSection>;
  if (!updates) return "MODIFY missing value";
  Object.assign(sec, { ...updates, id: sec.id, type: sec.type }); // protect id/type
  return null;
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
function applyDelete(ast: MddDocumentAst, op: PatchOp): string | null {
  if (op.target.sectionId && !op.target.entityId) {
    // Delete a section
    const idx = findSectionIndex(ast, op.target);
    if (idx < 0) return `Section not found`;
    const sec = ast.sections[idx];
    // If it is a domain or physical model, clean entityIndex
    if (
      ast.entityIndex &&
      (sec.type === "domain_model" || sec.type === "physical_model")
    ) {
      const model = sec as DomainModelSection | PhysicalModelSection;
      for (const ent of model.entities) {
        if (ast.entityIndex[ent.name]) {
          delete ast.entityIndex[ent.name];
        }
      }
    }
    ast.sections.splice(idx, 1);
    return null;
  }
  if (op.target.entityId && op.target.fieldId) {
    // Delete field
    const sec = findSection(ast, op.target);
    if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
      return "Entity-holding section not found";
    }
    const ent = findEntity(sec, op.target.entityId);
    if (!ent) return `Entity '${op.target.entityId}' not found`;
    const idx = ent.fields.findIndex((f) => f.id === op.target.fieldId || f.name === op.target.fieldId);
    if (idx < 0) return `Field '${op.target.fieldId}' not found`;
    ent.fields.splice(idx, 1);
    return null;
  }
  if (op.target.entityId) {
    // Delete entity
    const sec = findSection(ast, op.target);
    if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
      return "Entity-holding section not found";
    }
    const modelSec = sec as DomainModelSection | PhysicalModelSection;
    const idx = modelSec.entities.findIndex(
      (e) => e.id === op.target.entityId || e.name === op.target.entityId,
    );
    if (idx < 0) return `Entity '${op.target.entityId}' not found`;
    const entName = modelSec.entities[idx]!.name;
    modelSec.entities.splice(idx, 1);
    if (ast.entityIndex && ast.entityIndex[entName]) {
      delete ast.entityIndex[entName];
    }
    return null;
  }
  return "DELETE target not specific enough";
}

// ─── REPLACE_SECTION ───────────────────────────────────────────────────────────
function applyReplaceSection(ast: MddDocumentAst, op: PatchOp): string | null {
  const idx = findSectionIndex(ast, op.target);
  if (idx < 0) return `Section not found`;
  const replacement = op.value as DocumentSection;
  if (!replacement) return "REPLACE_SECTION missing value";
  const oldSection = ast.sections[idx];
  ast.sections[idx] = replacement;
  // Update entityIndex if replacing model section
  if (ast.entityIndex) {
    if (oldSection.type === "domain_model" || oldSection.type === "physical_model") {
      const oldModel = oldSection as DomainModelSection;
      for (const ent of oldModel.entities) {
        delete ast.entityIndex[ent.name];
      }
    }
    if (replacement.type === "domain_model" || replacement.type === "physical_model") {
      const newModel = replacement as DomainModelSection;
      for (const ent of newModel.entities) {
        ast.entityIndex[ent.name] = {
          type: replacement.type === "domain_model" ? "domain" : "physical",
          sectionIds: [replacement.id],
          canonicalName: ent.name,
        };
      }
    }
  }
  return null;
}

// ─── REPLACE_FIELD ─────────────────────────────────────────────────────────────
function applyReplaceField(ast: MddDocumentAst, op: PatchOp): string | null {
  if (!op.target.entityId || !op.target.fieldId) {
    return "REPLACE_FIELD requires entityId and fieldId in target";
  }
  const sec = findSection(ast, op.target);
  if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
    return "Entity-holding section not found";
  }
  const ent = findEntity(sec, op.target.entityId);
  if (!ent) return `Entity '${op.target.entityId}' not found`;
  const idx = ent.fields.findIndex(
    (f) => f.id === op.target.fieldId || f.name === op.target.fieldId,
  );
  if (idx < 0) return `Field '${op.target.fieldId}' not found`;
  const replacement = op.value as DocumentField;
  if (!replacement) return "REPLACE_FIELD missing value";
  ent.fields[idx] = replacement;
  return null;
}

// ─── ADD_FIELD ───────────────────────────────────────────────────────────────
function applyAddField(ast: MddDocumentAst, op: PatchOp): string | null {
  if (!op.target.entityId) return "ADD_FIELD requires entityId in target";
  const sec = findSection(ast, op.target);
  if (!sec || (sec.type !== "domain_model" && sec.type !== "physical_model")) {
    return "Entity-holding section not found";
  }
  const ent = findEntity(sec, op.target.entityId);
  if (!ent) return `Entity '${op.target.entityId}' not found`;
  const newField = op.value as DocumentField;
  if (!newField) return "ADD_FIELD missing value";
  if (ent.fields.some((f) => f.id === newField.id || f.name === newField.name)) {
    return `Field '${newField.name}' already exists in entity '${ent.name}'`;
  }
  ent.fields.push(newField);
  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a validated DocumentPatch to an MddDocumentAst.
 * Retorna nueva instancia del AST (deep clone); el original no se modifica.
 */
export function applyPatch(
  ast: MddDocumentAst,
  operations: PatchOp[],
): ApplyPatchResult {
  const workingAst = cloneAst(ast);
  const failed: { op: PatchOp; reason: string }[] = [];
  let applied = 0;

  // Validate operations first
  const validatedOps = operations.map((raw) => {
    const parse = patchOpSchema.safeParse(raw);
    if (!parse.success) {
      failed.push({ op: raw, reason: `Schema validation: ${parse.error.message}` });
      return null;
    }
    return parse.data;
  }).filter(Boolean) as PatchOp[];

  for (const op of validatedOps) {
    let err: string | null = null;
    switch (op.type) {
      case "ADD":
        err = applyAdd(workingAst, op);
        break;
      case "MODIFY":
        err = applyModify(workingAst, op);
        break;
      case "DELETE":
        err = applyDelete(workingAst, op);
        break;
      case "REPLACE_SECTION":
        err = applyReplaceSection(workingAst, op);
        break;
      case "REPLACE_FIELD":
        err = applyReplaceField(workingAst, op);
        break;
      case "ADD_FIELD":
        err = applyAddField(workingAst, op);
        break;
      default:
        err = `Unknown operation type: ${String((op as any).type)}`;
    }
    if (err) {
      failed.push({ op, reason: err });
    } else {
      applied++;
    }
  }

  const currentVersion = workingAst.metadata?.patchVersion ?? 0;
  const newVersion = currentVersion + applied;
  if (!workingAst.metadata) {
    workingAst.metadata = { patchVersion: 0 };
  }
  workingAst.metadata.patchVersion = newVersion;

  return {
    success: failed.length === 0,
    appliedOperations: applied,
    failedOperations: failed,
    newVersion,
    ast: workingAst,
  };
}

/**
 * Apply single operation (convenience wrapper).
 */
export function applySinglePatch(ast: MddDocumentAst, op: PatchOp): ApplyPatchResult {
  return applyPatch(ast, [op]);
}
