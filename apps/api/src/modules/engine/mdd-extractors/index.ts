/**
 * Barrel export for engine/mdd-extractors
 * Exports both v1 (legacy) and v2 (lean-sdd) extractors.
 */
export {
  extractTypesFromMddSection3,
  type MddField,
  type MddEntity,
  type MddEnum,
  type MddTypesJson,
} from "./types-extractor.js";

export {
  extractOperationsFromMdd,
  type ApiRoute,
  type EntityOperation,
  type FrontendPage,
  type MddOperationsJson,
} from "./operations-extractor.js";
