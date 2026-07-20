/** Barrel estable: re-exports de submódulos + implementación restante en internal. */
export * from "./mdd-sanitize/internal.js";
export * from "./mdd-sanitize/cross-consistency.js";
export { jsonSectionToMarkdown } from "./mdd-sanitize/json-section-to-markdown.js";
export { draftUsesLdapPrimaryAuth } from "./mdd-sanitize/security-manifest.js";
export {
  detectUnclosedSqlFences,
  formatSqlBlockWithNewlines,
  repairSqlDetachedCheckConstraints,
  repairSqlProseInTableBodies,
  sanitizeAllSqlBlocksInDraft,
  sanitizeSqlBrokenCommentsAndProse,
  stripIndexesOnCommentedSqlColumns,
} from "./mdd-sanitize/sql-repair.js";
export type { ValidateMddStructureResult } from "./mdd-sanitize/section-merge.js";
export {
  applyDeploymentStackDirectiveToDraft,
  deduplicateAndReorderMddSections,
  ensureMissingCanonicalSections,
  ensureSection6WhenSection7Present,
  extractArquitecturaSectionBody,
  extractContextSectionBody,
  extractSection3Body,
  extractSection4Body,
  extractSection6Body,
  extractSection7Body,
  fixGluedSection6Heading,
  getMddDraftSummary,
  getSection6Or7Range,
  getSectionsToPreserveFromExecutorPlan,
  hydrateStructuredFromDraft,
  isMddSectionPipelinePlaceholderBody,
  isMddSectionPlaceholderBody,
  logSection3Debug,
  mergeSection1IntoDraft,
  mddHasDuplicateSectionHeadings,
  normalizeCanonicalMddSectionHeadings,
  preserveArquitecturaSectionIfSubstantial,
  preserveContextSectionIfSubstantial,
  preserveUntouchedMddSectionsFromBaseline,
  replaceArquitecturaSectionBody,
  replaceContextSectionBody,
  replaceContextWhenInstructions,
  replaceContextWhenOnlyMetadata,
  replaceSection1BodyFromAnyHeading,
  replaceSection6Or7InDraft,
  restoreArquitecturaSectionFromBaselineIfMissing,
  restoreContextSectionFromBaselineIfMissing,
  restoreMddSectionsFromBaselineStrict,
  stripTrailingDuplicateMddSections,
  validateMddStructure,
} from "./mdd-sanitize/section-merge.js";
export { findBalancedBrace, findBalancedBraceRespectingStrings } from "./mdd-sanitize/brace.util.js";
export {
  fixDoubleMermaidFences,
  fixSection2UnclosedSqlAndGluedMermaid,
  stripMermaidFences,
  unescapeMermaidLiteralNewlines,
} from "./mdd-sanitize/mermaid-fences.js";
export {
  closeUnclosedCodeFencesInDraft,
  collapseConsecutiveHorizontalRules,
  stripStrayParenAfterJsonCodeBlocks,
} from "./mdd-sanitize/persist-format.util.js";
export {
  applyPreDeliveryGateFixes,
  demoteProseHeadingsInSections,
  finalizeMddDeliverable,
  normalizeMddFormat,
  prepareMddMarkdownForPersist,
  repairGarbageHeadings,
  repairManifestJsonClosing,
  sanitizeMddAtPersist,
  sanitizeMddForExport,
  storeMddMarkdownForPersist,
  stripUiUxSectionForApiOnlyMvp,
} from "./mdd-sanitize/persist-pipeline.js";
