/**
 * Barrel export for engine/mdd-extractors
 * Exports both v1 (legacy) and v2 (lean-sdd) extractors.
 */
export {
  extractTypesFromMddSection3,
  type ExtractedMddType,
  type MddEntityField,
  type MddTypeDefinition,
} from "./types-extractor.js";

export {
  extractOperationsFromMdd,
  type ExtractedOperations,
  type CrudOperations,
  type ApiEndpoint,
  type FrontendPageRule,
} from "./operations-extractor.js";
