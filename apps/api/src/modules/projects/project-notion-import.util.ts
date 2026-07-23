import type JSZip from "jszip";
import {
  csvRowToRecord,
  emptyIntegrationHandoff,
  integrationHandoffItemSchema,
  joinPantallasAndUiProject,
  NOTION_PORTABILITY_FORMAT,
  parseCsv,
  parseIntegrationHandoff,
  resolveStageDocFieldFromBasename,
  type IntegrationHandoffItem,
  type NotionImportBody,
  type NotionIntegrationLinkFile,
  type NotionPortabilityIdMap,
  type NotionPortabilityManifest,
} from "@theforge/shared-types";

export interface ParsedNotionImportStage {
  exportId: string;
  ordinal: number;
  key: string | null;
  name: string | null;
  workflowStatus: string;
  status: string;
  precisionScore: number;
  isLegacy: boolean;
  linkedNewProjectExportId: string | null;
  handoffImportedAt: string | null;
  docs: Record<string, string>;
  assets: Record<string, unknown>;
}

export interface ParsedNotionImportTrace {
  newLegId: string;
  legacyStoryId: string | null;
  legacyStageExportId: string | null;
  screenOrEndpoint: string | null;
  status: string;
}

export interface ParsedNotionHandoffRow {
  item: IntegrationHandoffItem;
  legacyStageExportId: string | null;
}

export interface ParsedNotionImportBundle {
  manifest: NotionPortabilityManifest;
  idMap: NotionPortabilityIdMap;
  projectDocs: Record<string, string>;
  stages: ParsedNotionImportStage[];
  handoffItems: ParsedNotionHandoffRow[];
  traces: ParsedNotionImportTrace[];
  integrationLink: NotionIntegrationLinkFile | null;
  warnings: string[];
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("string");
}

function listZipPaths(zip: JSZip): string[] {
  return Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
}

function detectRootPrefix(paths: string[]): string {
  const manifestPath = paths.find((p) => p.endsWith("_theforge/manifest.json"));
  if (manifestPath) {
    const idx = manifestPath.indexOf("_theforge/manifest.json");
    return idx > 0 ? manifestPath.slice(0, idx) : "";
  }
  const first = paths[0];
  if (!first?.includes("/")) return "";
  return first.split("/")[0] ?? "";
}

function prefixed(prefix: string, relative: string): string {
  return prefix ? `${prefix}${relative}` : relative;
}

function parseJsonFile<T>(raw: string | null): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseStageFolderName(folderName: string): { ordinal: number; exportId: string } | null {
  const match = folderName.match(/^Etapa\s+(\d+)(?:\s+—\s+.+)?\s+([0-9a-f]{32})$/i);
  if (!match) return null;
  return { ordinal: Number.parseInt(match[1]!, 10), exportId: match[2]!.toLowerCase() };
}

export async function parseNotionImportZip(zip: JSZip): Promise<ParsedNotionImportBundle> {
  const warnings: string[] = [];
  const paths = listZipPaths(zip);
  const prefix = detectRootPrefix(paths);

  const manifestRaw = await readZipText(zip, prefixed(prefix, "_theforge/manifest.json"));
  const manifest = parseJsonFile<NotionPortabilityManifest>(manifestRaw);
  if (!manifest || manifest.format !== NOTION_PORTABILITY_FORMAT) {
    throw new Error("ZIP inválido: falta _theforge/manifest.json de The Forge");
  }

  const idMap =
    parseJsonFile<NotionPortabilityIdMap>(await readZipText(zip, prefixed(prefix, "_theforge/id-map.json"))) ??
    ({
      projectExportId: manifest.projectExportId,
      originalProjectId: "",
      linkedLegacyProjectExportId: null,
      linkedNewProjectExportId: null,
      stages: [],
    } satisfies NotionPortabilityIdMap);

  const integrationLink = parseJsonFile<NotionIntegrationLinkFile>(
    await readZipText(zip, prefixed(prefix, "_theforge/integration-link.json")),
  );

  const projectDocs: Record<string, string> = {};
  const stagesByExportId = new Map<string, ParsedNotionImportStage>();

  const stagesCsvRaw = await readZipText(zip, prefixed(prefix, "Etapas.csv"));
  if (stagesCsvRaw) {
    const { headers, rows } = parseCsv(stagesCsvRaw);
    for (const row of rows) {
      const record = csvRowToRecord(headers, row);
      const exportId = record.exportId?.toLowerCase();
      if (!exportId) continue;
      stagesByExportId.set(exportId, {
        exportId,
        ordinal: Number.parseInt(record.ordinal ?? "1", 10) || 1,
        key: record.key || null,
        name: record.name || null,
        workflowStatus: record.workflowStatus || "DRAFT",
        status: record.status || "ROJO",
        precisionScore: Number.parseInt(record.precisionScore ?? "0", 10) || 0,
        isLegacy: record.isLegacy === "true",
        linkedNewProjectExportId: record.linkedNewProjectExportId?.toLowerCase() || null,
        handoffImportedAt: record.handoffImportedAt || null,
        docs: {},
        assets: {},
      });
    }
  }

  for (const path of paths) {
    const relative = prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : path;

    if (relative.startsWith("_theforge/") || relative === "index.html" || relative === "Etapas.csv") {
      continue;
    }

    if (relative.startsWith("Integración/") && relative.endsWith(".csv")) {
      continue;
    }

    const stageFolderMatch = relative.match(/^([^/]+)\/(.+)$/);
    if (stageFolderMatch) {
      const folderName = stageFolderMatch[1]!;
      const inner = stageFolderMatch[2]!;
      const parsedFolder = parseStageFolderName(folderName);
      if (!parsedFolder) continue;

      let stage = stagesByExportId.get(parsedFolder.exportId);
      if (!stage) {
        stage = {
          exportId: parsedFolder.exportId,
          ordinal: parsedFolder.ordinal,
          key: null,
          name: folderName.replace(/\s+[0-9a-f]{32}$/i, "").replace(/^Etapa\s+\d+\s+—\s+/, "") || null,
          workflowStatus: "DRAFT",
          status: "ROJO",
          precisionScore: 0,
          isLegacy: manifest.projectType === "LEGACY",
          linkedNewProjectExportId: null,
          handoffImportedAt: null,
          docs: {},
          assets: {},
        };
        stagesByExportId.set(parsedFolder.exportId, stage);
      }

      if (inner.startsWith("_assets/") && inner.endsWith(".json")) {
        const assetName = inner.slice("_assets/".length);
        const raw = await readZipText(zip, path);
        const parsed = parseJsonFile<unknown>(raw);
        if (parsed != null) stage.assets[assetName] = parsed;
        continue;
      }

      if (inner.endsWith(".md")) {
        const basename = inner.split("/").pop() ?? inner;
        const field = resolveStageDocFieldFromBasename(basename);
        const raw = await readZipText(zip, path);
        if (field && raw?.trim()) {
          stage.docs[field] = raw.trim();
        }
      }
      continue;
    }

    if (relative.endsWith(".md") && !relative.includes("/")) {
      const raw = await readZipText(zip, path);
      if (!raw?.trim()) continue;
      if (relative.toLowerCase().includes("benchmark")) {
        projectDocs.dbgaContent = raw.trim();
      } else if (relative.toLowerCase().includes("phase 0 deep research")) {
        projectDocs.phase0SummaryContent = raw.trim();
      }
    }
  }

  const handoffItems: ParsedNotionHandoffRow[] = [];
  const handoffCsvRaw = await readZipText(zip, prefixed(prefix, "Integración/Handoff items.csv"));
  if (handoffCsvRaw) {
    const { headers, rows } = parseCsv(handoffCsvRaw);
    for (const row of rows) {
      const record = csvRowToRecord(headers, row);
      const parsed = integrationHandoffItemSchema.safeParse({
        id: record.id,
        title: record.title,
        description: record.description,
        status: record.status || "draft",
        actor: record.actor || undefined,
        acceptanceCriteria: record.acceptanceCriteria
          ? record.acceptanceCriteria.split("|").filter(Boolean)
          : undefined,
        legacyStoryId: record.legacyStoryId || undefined,
      });
      if (parsed.success) {
        handoffItems.push({
          item: parsed.data,
          legacyStageExportId: record.legacyStageExportId?.toLowerCase() || null,
        });
      } else warnings.push(`Handoff item omitido (${record.id || "?"}): datos inválidos`);
    }
  } else {
    warnings.push("Sin Integración/Handoff items.csv; handoff vacío");
  }

  const traces: ParsedNotionImportTrace[] = [];
  const tracesCsvRaw = await readZipText(zip, prefixed(prefix, "Integración/Trazas integración.csv"));
  if (tracesCsvRaw) {
    const { headers, rows } = parseCsv(tracesCsvRaw);
    for (const row of rows) {
      const record = csvRowToRecord(headers, row);
      if (!record.newLegId) continue;
      traces.push({
        newLegId: record.newLegId,
        legacyStoryId: record.legacyStoryId || null,
        legacyStageExportId: record.legacyStageExportId?.toLowerCase() || null,
        screenOrEndpoint: record.screenOrEndpoint || null,
        status: record.status || "DRAFT",
      });
    }
  }

  const stages = [...stagesByExportId.values()].sort((a, b) => a.ordinal - b.ordinal);
  if (stages.length === 0) {
    warnings.push("Sin etapas en el bundle; se creará etapa principal vacía");
  }

  if (handoffItems.length === 0 && parseIntegrationHandoff(null).items.length === 0) {
    // ok
  }

  return {
    manifest,
    idMap,
    projectDocs,
    stages,
    handoffItems,
    traces,
    integrationLink,
    warnings,
  };
}

export function resolveImportedProjectName(manifest: NotionPortabilityManifest, body: NotionImportBody): string {
  return body.name?.trim() || manifest.projectName || "Proyecto importado";
}

/**
 * `uiScreensContent` es solo columna de Project (no Stage). El ZIP Notion lo guarda
 * como página Pantallas (+ opcional `_assets/ui-project.json`) dentro de carpetas de etapa.
 * Preferimos la etapa ACTIVE; si no hay, la de mayor ordinal con contenido.
 */
export function resolveImportedUiScreensContent(stages: ParsedNotionImportStage[]): string | null {
  const withContent = stages
    .map((stage) => {
      const md = stage.docs.uiScreensContent?.trim() ?? "";
      if (!md) return null;
      const asset = stage.assets["ui-project.json"];
      let json: string | null = null;
      if (typeof asset === "string" && asset.trim()) {
        json = asset.trim();
      } else if (asset && typeof asset === "object") {
        try {
          json = JSON.stringify(asset, null, 2);
        } catch {
          json = null;
        }
      }
      return {
        stage,
        content: joinPantallasAndUiProject(md, json),
      };
    })
    .filter((row): row is { stage: ParsedNotionImportStage; content: string } => row != null && row.content.length > 0);

  if (withContent.length === 0) return null;

  const active = withContent.find((row) => row.stage.workflowStatus === "ACTIVE");
  if (active) return active.content;

  return [...withContent].sort((a, b) => b.stage.ordinal - a.stage.ordinal)[0]!.content;
}

export function emptyHandoffIfNeeded(rows: ParsedNotionHandoffRow[]): { items: IntegrationHandoffItem[] } {
  if (rows.length === 0) return emptyIntegrationHandoff();
  return {
    items: rows.map((row) => row.item),
  };
}

export function mapHandoffItemsWithStageIds(
  rows: ParsedNotionHandoffRow[],
  stageExportToId: Map<string, string>,
): IntegrationHandoffItem[] {
  return rows.map(({ item, legacyStageExportId }) => ({
    ...item,
    legacyStageId: legacyStageExportId ? stageExportToId.get(legacyStageExportId) ?? item.legacyStageId : item.legacyStageId,
  }));
}
