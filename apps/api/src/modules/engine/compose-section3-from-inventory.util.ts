/**
 * Deterministic §3 CREATE TABLE stubs from domain inventory (PLAN-CASCADE-90 P0).
 * Fills gaps when MDD is auth-skewed or missing business entities — does not invent columns beyond id + timestamps.
 */

import { AUTH_ENTITY_FAMILY, type DomainInventory } from "@theforge/shared-types";
import { extractEntities } from "./conformance.service.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

function stubCreateTable(entity: string): string {
  return `CREATE TABLE ${entity} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
}

/** Business entities from inventory missing in MDD §3. */
export function missingDomainEntities(
  inventory: DomainInventory,
  mddMarkdown: string,
): string[] {
  const existing = extractEntities(
    extractSectionByNumber(mddMarkdown, 3) || mddMarkdown,
  );
  return inventory.suggestedEntities.filter(
    (e) => !AUTH_ENTITY_FAMILY.has(e) && !existing.has(e),
  );
}

/**
 * Builds a SQL appendix of CREATE TABLE stubs for missing domain entities.
 */
export function composeDomainTableStubsSql(
  inventory: DomainInventory,
  mddMarkdown: string,
): string {
  const missing = missingDomainEntities(inventory, mddMarkdown);
  if (missing.length === 0) return "";
  return missing.map(stubCreateTable).join("\n\n");
}

/**
 * Merges stub CREATE TABLE statements into the first ```sql fence of §3, or appends a new fence.
 * Idempotent: skips entities already present as CREATE TABLE.
 */
export function mergeDomainTablesIntoMdd(
  mddMarkdown: string,
  inventory: DomainInventory,
): { markdown: string; injected: string[] } {
  const draft = (mddMarkdown ?? "").trim();
  if (!draft) return { markdown: draft, injected: [] };
  const injected = missingDomainEntities(inventory, draft);
  if (injected.length === 0) return { markdown: draft, injected: [] };

  if (/-- Domain inventory stubs/i.test(draft)) {
    const stillMissing = injected.filter(
      (entity) => !new RegExp(`\\bCREATE\\s+TABLE\\s+${entity}\\b`, "i").test(draft),
    );
    if (stillMissing.length === 0) return { markdown: draft, injected: [] };
  }

  const stubs = composeDomainTableStubsSql(inventory, draft);
  if (!stubs) return { markdown: draft, injected: [] };
  const section3 = extractSectionByNumber(draft, 3);
  if (!section3 || section3.length < 20) {
    const appendix =
      `\n\n## 3. Modelo de Datos\n\n\`\`\`sql\n${stubs}\n\`\`\`\n\n` +
      "```TechnicalMetadata\n[domain_inventory_stubs]\n```\n";
    return { markdown: draft + appendix, injected };
  }

  const sqlFence = /```sql\n([\s\S]*?)```/i;
  const match = section3.match(sqlFence);
  if (match) {
    const existingSql = match[1] ?? "";
    const mergedSql = `${existingSql.trimEnd()}\n\n-- Domain inventory stubs (deterministic)\n${stubs}\n`;
    const newSection3 = section3.replace(sqlFence, `\`\`\`sql\n${mergedSql}\`\`\``);
    return { markdown: draft.replace(section3, newSection3), injected };
  }

  const injection = `\n\n\`\`\`sql\n${stubs}\n\`\`\`\n`;
  const newSection3 = section3.trimEnd() + injection;
  return { markdown: draft.replace(section3, newSection3), injected };
}

/** Prompt block forcing SA to expand stubs into real columns. */
export function domainSchemaCompositionPromptBlock(
  inventory: DomainInventory,
  mddMarkdown: string,
): string {
  const missing = missingDomainEntities(inventory, mddMarkdown);
  if (missing.length === 0 && inventory.suggestedEntities.length === 0) return "";
  const lines = [
    "**Composición determinista de §3 (inventario de dominio):**",
    `Entidades de negocio obligatorias: ${inventory.suggestedEntities
      .filter((e) => !AUTH_ENTITY_FAMILY.has(e))
      .slice(0, 30)
      .join(", ")}`,
  ];
  if (missing.length > 0) {
    lines.push(
      `Faltan en el borrador (debe crearlas o expandir stubs): ${missing.slice(0, 20).join(", ")}`,
    );
    lines.push(
      "Si ves stubs `id/created_at/updated_at` para esas tablas, **expándelas** con columnas de dominio derivadas del BRD/§1; no las borres.",
    );
  }
  return lines.join("\n");
}
