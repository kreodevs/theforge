# mdd-sanitize (extracción modular)

Submódulos extraídos de `../mdd-sanitize.ts` durante el refactor GOD-REFACTOR (Fase 1+).

| Archivo | Export público | Notas |
|---------|----------------|-------|
| `json-section-to-markdown.ts` | `jsonSectionToMarkdown` | JSON de sección → markdown; `subsectionsToMarkdown` reutilizado por el barrel |
| `section-body.util.ts` | — (interno) | `extractMddSectionBody` compartido entre submódulos |
| `security-manifest.ts` | `draftUsesLdapPrimaryAuth` (re-export barrel) | `fixSecurityManifestCoherence`, `fixIntegrationMetadataCoherence` |
| `sql-repair.ts` | 7 exports (re-export barrel) | Sanitización/reparación SQL en bloques ```sql del MDD |
| `section-merge.ts` | ~35 exports (re-export barrel) | Merge/preserve/restore §1–§7, dedupe, validateMddStructure |
| `brace.util.ts` | — (interno) | `findBalancedBrace`, `findBalancedBraceRespectingStrings` |
| `mermaid-fences.ts` | 5 exports (re-export barrel) | Fences mermaid: strip, fix doble fence, unescape, §3 repair |

El entrypoint estable para consumidores sigue siendo `../mdd-sanitize.ts` (re-exports).

**Exports públicos de `sql-repair.ts`:** `sanitizeSqlBrokenCommentsAndProse`, `stripIndexesOnCommentedSqlColumns`, `repairSqlProseInTableBodies`, `repairSqlDetachedCheckConstraints`, `sanitizeAllSqlBlocksInDraft`, `formatSqlBlockWithNewlines`, `detectUnclosedSqlFences`.

**Exports principales de `section-merge.ts`:** `mergeSection1IntoDraft`, `preserveUntouchedMddSectionsFromBaseline`, `restoreMddSectionsFromBaselineStrict`, `deduplicateAndReorderMddSections`, `validateMddStructure`, `getSection6Or7Range`, `replaceSection6Or7InDraft`.

**Exports de `mermaid-fences.ts`:** `stripMermaidFences`, `fixDoubleMermaidFences`, `unescapeMermaidLiteralNewlines`, `fixSection2UnclosedSqlAndGluedMermaid`.
