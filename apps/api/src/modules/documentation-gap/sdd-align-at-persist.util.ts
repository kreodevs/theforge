import { qualifyBlueprintPostMvpUiMentions } from "../engine/blueprint-enrich-ui-system.js";
import {
  alignDeliverableMarkdownWithMddSecurity,
  countMddSection3CreateTables,
  sanitizeMddAtPersist,
} from "../ai-analysis/utils/mdd-sanitize.js";
import {
  resolveAuthoritativeMessageBroker,
  resolveAuthoritativeOrm,
  resolveAuthoritativePackageManager,
} from "../ai/utils/suggest-agent-governance-artifacts.js";
import {
  alignDockerfilePackageManager,
  extractMddSection,
  repairInfraMarkdown,
} from "@theforge/shared-types";

export interface SddDeliverablePersistFields {
  mddContent: string;
  tasksContent?: string | null;
  userStoriesContent?: string | null;
  blueprintContent?: string | null;
  infraContent?: string | null;
}

export interface AlignedSddDeliverablesResult {
  mddContent: string;
  tasksContent?: string | null;
  userStoriesContent?: string | null;
  blueprintContent?: string | null;
  infraContent?: string | null;
  changed: boolean;
}

function alignMessagingWithMddAuthority(mddMarkdown: string, content: string): string {
  const broker = resolveAuthoritativeMessageBroker(mddMarkdown);
  if (broker === "rabbitmq") {
    return content
      .replace(/\bBullMQ\b/gi, "RabbitMQ")
      .replace(/\bBull\b/gi, "RabbitMQ")
      .replace(/\bKafka\b/gi, "RabbitMQ");
  }
  if (broker === "bull") {
    return content
      .replace(/\bRabbitMQ\b/gi, "BullMQ")
      .replace(/\bKafka\b/gi, "BullMQ");
  }
  if (broker === "kafka") {
    return content.replace(/\bRabbitMQ\b/gi, "Kafka").replace(/\bBullMQ\b/gi, "Kafka");
  }
  return content;
}

function replaceTypeOrmHedging(content: string): string {
  return content
    .replace(/\bTypeORM\s+(?:o|or)\s+raw\s+SQL\b/gi, "TypeORM migrations")
    .replace(/\bTypeORM\s+(?:o|or)\s+SQL\s+directo\b/gi, "TypeORM migrations")
    .replace(/\bTypeORM\s+y\s+raw\s+SQL\b/gi, "TypeORM migrations")
    .replace(/\bmigraci[oó]n(?:es)?\s+(?:con\s+)?SQL\b/gi, "migraciones TypeORM")
    .replace(/\bcon\s+SQL\s+directo\b/gi, "con TypeORM migrations");
}

/** Rutas planas bajo migrations/ → .ts (TypeORM); no toca init-db.sql ni Prisma folder/migration.sql. */
function replaceTypeOrmMigrationSqlPaths(content: string): string {
  return content.replace(
    /((?:[\w.-]+\/)*migrations\/[\w.-]+)\.sql\b/gi,
    "$1.ts",
  );
}

function alignTypeOrmAuthority(content: string): string {
  return replaceTypeOrmMigrationSqlPaths(
    replaceTypeOrmHedging(
      content
        .replace(/\bPrisma\b/g, "TypeORM")
        .replace(/schema\.prisma/gi, "entidades TypeORM"),
    ),
  );
}

function mddSection2And3Corpus(mddMarkdown: string): string {
  return [extractMddSection(mddMarkdown, 2), extractMddSection(mddMarkdown, 3)].filter(Boolean).join("\n");
}

function alignOrmWithMddAuthority(mddMarkdown: string, content: string): string {
  const orm = resolveAuthoritativeOrm(mddMarkdown);
  if (orm === "typeorm") {
    return alignTypeOrmAuthority(content);
  }
  if (orm === "prisma") {
    return content
      .replace(/\bTypeORM\b/g, "Prisma")
      .replace(/entidades TypeORM/gi, "schema.prisma");
  }
  const authority = mddSection2And3Corpus(mddMarkdown);
  if (/\btypeorm\b/i.test(authority) && !/\bprisma\b/i.test(authority)) {
    return replaceTypeOrmMigrationSqlPaths(replaceTypeOrmHedging(content));
  }
  return content;
}

/** Gestor de paquetes declarado en MDD (§2, §7 manifest, overlay gobernanza, corpus). */
export function resolvePackageManagerFromMddSection2(
  mddMarkdown: string,
  extraCorpus?: string,
): "pnpm" | "yarn" | "npm" | null {
  return resolveAuthoritativePackageManager(mddMarkdown, extraCorpus);
}

const ENTITY_COUNT_RE =
  /\b(\d{1,3})\s+(tablas?|entidades?|tables?|entities?)\b/gi;

const ENTITY_COUNT_FOOTNOTE =
  "\n\n> **Nota (alineación MDD):** Recuento de entidades/tablas normalizado al total de `CREATE TABLE` en MDD §3.\n";

/** Corrige recuentos obvios de tablas/entidades en user stories según §3 SQL. */
export function alignUserStoriesEntityCountsWithMdd(
  mddMarkdown: string,
  userStoriesMarkdown: string,
): string {
  if (!userStoriesMarkdown?.trim()) return userStoriesMarkdown;
  const authoritativeCount = countMddSection3CreateTables(mddMarkdown);
  if (authoritativeCount <= 0) return userStoriesMarkdown;

  let changed = false;
  const out = userStoriesMarkdown.replace(ENTITY_COUNT_RE, (full, num: string, noun: string) => {
    const parsed = Number.parseInt(num, 10);
    if (parsed === authoritativeCount) return full;
    changed = true;
    return `${authoritativeCount} ${noun}`;
  });

  if (!changed) return userStoriesMarkdown;
  if (out.includes("Nota (alineación MDD):")) return out;
  return `${out.trimEnd()}${ENTITY_COUNT_FOOTNOTE}`;
}

function alignInfraWithMddAuthority(
  mddMarkdown: string,
  content: string,
  extraCorpus?: string,
): string {
  const pm = resolvePackageManagerFromMddSection2(mddMarkdown, extraCorpus);
  if (pm === "pnpm") {
    return alignDockerfilePackageManager(content, "pnpm");
  }
  return content;
}

/** Alinea Dockerfile infra con gestor de paquetes declarado en MDD §2. */
export function alignInfraPackageManagerWithMdd(
  mddMarkdown: string,
  infraMarkdown: string,
  extraCorpus?: string,
): string {
  if (!infraMarkdown?.trim()) return infraMarkdown;
  return alignInfraWithMddAuthority(mddMarkdown, infraMarkdown, extraCorpus);
}

/** Alinea tasks.md con decisiones del MDD (ORM, cola, JWT). */
export function alignTasksWithMddConflicts(mddMarkdown: string, tasksMarkdown: string): string {
  if (!tasksMarkdown?.trim()) return tasksMarkdown;
  let out = tasksMarkdown;
  out = alignOrmWithMddAuthority(mddMarkdown, out);
  out = alignMessagingWithMddAuthority(mddMarkdown, out);
  out = alignDeliverableMarkdownWithMddSecurity(mddMarkdown, out);
  return out;
}

/** Alinea user stories con decisiones del MDD (ORM, cola, recuentos §3). */
export function alignUserStoriesWithMddConflicts(
  mddMarkdown: string,
  userStoriesMarkdown: string,
): string {
  if (!userStoriesMarkdown?.trim()) return userStoriesMarkdown;
  let out = userStoriesMarkdown;
  out = alignOrmWithMddAuthority(mddMarkdown, out);
  out = alignMessagingWithMddAuthority(mddMarkdown, out);
  out = alignUserStoriesEntityCountsWithMdd(mddMarkdown, out);
  return out;
}

/** Cadena completa de infra para export/handoff (PM §2/§7, fences, JWT). */
export function finalizeInfraMarkdownForExport(
  mddMarkdown: string,
  infraMarkdown: string,
  jwtOpts?: { extraCorpus?: string; packageManagerCorpus?: string },
): string {
  if (!infraMarkdown?.trim()) return infraMarkdown;
  const pmCorpus = [jwtOpts?.packageManagerCorpus, jwtOpts?.extraCorpus]
    .filter(Boolean)
    .join("\n");
  let out = alignMessagingWithMddAuthority(mddMarkdown, infraMarkdown);
  out = alignInfraWithMddAuthority(mddMarkdown, out, pmCorpus || undefined);
  out = repairInfraMarkdown(out);
  out = alignDeliverableMarkdownWithMddSecurity(mddMarkdown, out, jwtOpts);
  return out;
}

/** Cadena completa de user stories para export/handoff. */
export function finalizeUserStoriesMarkdownForExport(
  mddMarkdown: string,
  userStoriesMarkdown: string,
): string {
  return alignUserStoriesWithMddConflicts(mddMarkdown, userStoriesMarkdown);
}

/**
 * Correcciones deterministas en campos persistidos (no solo export).
 * El MDD es autoridad para ORM, broker y JWT RS256.
 */
export function alignSddDeliverablesAtPersist(
  fields: SddDeliverablePersistFields,
): AlignedSddDeliverablesResult {
  const mddRaw = (fields.mddContent ?? "").trim();
  const mddContent = mddRaw ? sanitizeMddAtPersist(mddRaw) : mddRaw;

  const tasksRaw = fields.tasksContent ?? null;
  const tasksContent = tasksRaw?.trim()
    ? alignTasksWithMddConflicts(mddContent, tasksRaw)
    : tasksRaw;

  const userStoriesRaw = fields.userStoriesContent ?? null;
  const userStoriesContent = userStoriesRaw?.trim()
    ? alignUserStoriesWithMddConflicts(mddContent, userStoriesRaw)
    : userStoriesRaw;

  const jwtCorpus = [tasksContent, userStoriesContent].filter(Boolean).join("\n");
  const jwtOpts = jwtCorpus.trim() ? { extraCorpus: jwtCorpus } : undefined;

  const blueprintRaw = fields.blueprintContent ?? null;
  const blueprintContent = blueprintRaw?.trim()
    ? alignDeliverableMarkdownWithMddSecurity(
        mddContent,
        qualifyBlueprintPostMvpUiMentions(
          mddContent,
          alignOrmWithMddAuthority(
            mddContent,
            alignMessagingWithMddAuthority(mddContent, blueprintRaw),
          ),
        ),
        jwtOpts,
      )
    : blueprintRaw;

  const infraRaw = fields.infraContent ?? null;
  const infraContent = infraRaw?.trim()
    ? finalizeInfraMarkdownForExport(mddContent, infraRaw, jwtOpts)
    : infraRaw;

  const changed =
    mddContent !== mddRaw ||
    tasksContent !== tasksRaw ||
    userStoriesContent !== userStoriesRaw ||
    blueprintContent !== blueprintRaw ||
    infraContent !== infraRaw;

  return {
    mddContent,
    tasksContent,
    userStoriesContent,
    blueprintContent,
    infraContent,
    changed,
  };
}
