import { Injectable } from "@nestjs/common";
import type { MddDocumentAst, PatchOp } from "@theforge/shared-types/document-ast";
import { parseDualOutputResponse } from "./document-engine/document-response-parser.js";
import { applyPatch } from "./document-engine/document-patch-engine.js";
import { runValidationGates } from "./document-engine/validation-gates.js";
import { classifyAndRouteEditRequest, type RoutedIntent } from "./document-engine/intent-router.service.js";
import type { DocumentEditRequest } from "@theforge/shared-types/document-ast";

/**
 * RFC-001: DocumentEngineService — API de alto nivel para procesar respuestas
 * estructuradas, aplicar patches al AST y validar gates.
 *
 * Esta capa desacopla `SessionService` / `LegacyCoordinator` de la lógica
 * del motor de documentos (transpiler, patches, validación).
 */

export interface ApplyEditResult {
  ok: boolean;
  /** AST modificado (deep clone) — null si no hay cambios que aplicar */
  updatedAst: MddDocumentAst | null;
  /** Markdown canónico desde el AST (si transpilación fue exitosa) */
  canonicalMarkdown: string | null;
  /** Mensaje de error si ok=false */
  error?: string;
  /** Errores detallados de validación */
  validationErrors: string[];
  /** Cantidad de operaciones aplicadas */
  appliedOps: number;
  /** Nueva versión del patch */
  newVersion: number;
  /** Detección de intención (si se solicitó) */
  intent?: RoutedIntent;
}

export interface ParseDocumentResponseResult {
  /** Si parseo dual fue exitoso y estructuralmente válido */
  dualOutputOk: boolean;
  /** AST parseado (o null en fallback markdown) */
  ast: MddDocumentAst | null;
  /** Markdown final (canonical o fallback) */
  markdown: string | null;
  /** Warnings de divergencia / desnormalización */
  warnings: string[];
}

@Injectable()
export class DocumentEngineService {
  /**
   * Intenta parsear una respuesta LLM como Dual Output Protocol.
   * Si no lo logra, cae a markdown fallback.
   */
  parseResponse(raw: string): ParseDocumentResponseResult {
    const parse = parseDualOutputResponse(raw, {
      allowMarkdownFallback: true,
      divergenceThreshold: 0.15,
      enforceDeterminism: true,
    });

    if (parse.success && parse.response) {
      return {
        dualOutputOk: true,
        ast: parse.response.documentAst,
        markdown: parse.canonicalMarkdown || parse.response.documentMarkdown || parse.fallbackMarkdown || null,
        warnings: parse.validationErrors || [],
      };
    }

    // Fallback: raw markdown (legacy path)
    return {
      dualOutputOk: false,
      ast: null,
      markdown: parse.fallbackMarkdown || raw.trim() || null,
      warnings: parse.error ? [parse.error] : [],
    };
  }

  /**
   * Aplica un conjunto de operaciones (patches) al AST actual.
   * Ejecuta validation gates antes y después de aplicar.
   */
  applyPatches(
    ast: MddDocumentAst,
    ops: PatchOp[],
    options: { skipPreValidation?: boolean; skipPostValidation?: boolean } = {},
  ): ApplyEditResult {
    // Pre-validation (gates on current AST)
    const preVal = runValidationGates(ast, ops);
    if (!preVal.ok && !options.skipPreValidation) {
      return {
        ok: false,
        updatedAst: null,
        canonicalMarkdown: null,
        error: `Pre-validation failed: ${preVal.summary}`,
        validationErrors: preVal.gates.flatMap((g) => g.errors),
        appliedOps: 0,
        newVersion: ast.metadata?.patchVersion ?? 0,
      };
    }

    // Apply patches via engine
    const patchResult = applyPatch(ast, ops);

    // Post-validation
    const postVal = runValidationGates(patchResult.ast);
    if (!postVal.ok && !options.skipPostValidation) {
      return {
        ok: false,
        updatedAst: null,
        canonicalMarkdown: null,
        error: `Post-validation failed after applying ${patchResult.appliedOperations} ops: ${postVal.summary}`,
        validationErrors: postVal.gates.flatMap((g) => g.errors),
        appliedOps: patchResult.appliedOperations,
        newVersion: ast.metadata?.patchVersion ?? 0,
      };
    }

    return {
      ok: true,
      updatedAst: patchResult.ast,
      canonicalMarkdown: null, // caller can transpile if needed
      validationErrors: [],
      appliedOps: patchResult.appliedOperations,
      newVersion: patchResult.newVersion,
    };
  }

  /**
   * Clasifica una instrucción de edición y rutea al agente adecuado.
   * (Wrapper público del IntentRouter interno.)
   */
  classifyIntent(request: DocumentEditRequest): RoutedIntent {
    return classifyAndRouteEditRequest(request);
  }
}
