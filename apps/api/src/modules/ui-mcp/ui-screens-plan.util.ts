/**
 * @fileoverview Cruce §3 MDD + Historias de Usuario para el deliverable Pantallas.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type { EntityClassification, ListScreensEntity } from "@theforge/shared-types";
import { extractEntityNamesFromMdd } from "./ui-screens-mdd.util.js";
import {
  extractHttpEndpointsFromMarkdown,
  formatEndpointList,
  inferAuthEndpoints,
  matchEndpointsForEntity,
} from "./api-contract-endpoints.util.js";
import {
  extractRolesFromMdd,
  inferPageComponentName,
  inferScreenRoute,
  inferUiStates,
  normalizeRoleLabel,
} from "./ui-screen-routes.util.js";

/** Historia de usuario parseada del markdown de backlog. */
export interface ParsedUserStory {
  id?: string;
  title: string;
  role?: string;
  want?: string;
  benefit?: string;
  /** Texto concatenado para matching heurístico con entidades §3. */
  searchText: string;
}

/** Ítem del plan de pantallas (entidad §3 enriquecida o flujo solo-HU). */
export interface PantallaPlanItem extends ListScreensEntity {
  screenName: string;
  purpose: string;
  uiHint?: string;
  resolveContext?: string;
  userStoryRefs?: string[];
  source: "entity" | "entity+hu" | "hu-only";
  /** Rol/journey (desde HU o MDD §1). */
  role?: string;
  route?: string;
  pageName?: string;
  uiStates?: string;
  primaryApi?: string;
  userStoryId?: string;
  implementationMode?: "pull-registry" | "prototype-iframe";
}

const STORY_HEADER =
  /^#{2,3}\s+(?:Historia\s+de\s+usuario|HU)\s*:?\s*(?:\[?(US-[A-Z0-9]+)\]?\s*)?(.*)$/im;

const COMO = /\*\*Como:\*\*\s*(.+?)(?:\r?\n|$)/i;
const QUIERO = /\*\*Quiero:\*\*\s*(.+?)(?:\r?\n|$)/i;
const PARA = /\*\*Para:\*\*\s*(.+?)(?:\r?\n|$)/i;
const CLASSIC_STORY =
  /Como\s+(.+?),\s*quiero\s+(.+?)\s+para\s+(.+?)(?:\.|$)/i;

/** Variantes singular/plural de un nombre de tabla para matching en texto HU. */
export function entityMatchTokens(entityName: string): string[] {
  const lower = entityName.toLowerCase().trim();
  const tokens = new Set<string>([lower]);
  if (lower.endsWith("ies") && lower.length > 4) {
    tokens.add(lower.slice(0, -3) + "y");
  } else if (lower.endsWith("ses") && lower.length > 4) {
    tokens.add(lower.slice(0, -2));
  } else if (lower.endsWith("es") && lower.length > 3) {
    tokens.add(lower.slice(0, -2));
    tokens.add(lower.slice(0, -1));
  } else if (lower.endsWith("s") && lower.length > 2) {
    tokens.add(lower.slice(0, -1));
  }
  return [...tokens].filter((t) => t.length >= 3);
}

function tokenAppearsInText(token: string, text: string): boolean {
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(text);
}

/** ¿La HU menciona la entidad (nombre de tabla o variantes)? */
export function storyMatchesEntity(story: ParsedUserStory, entityName: string): boolean {
  const haystack = story.searchText.toLowerCase();
  return entityMatchTokens(entityName).some((token) => tokenAppearsInText(token, haystack));
}

function parseStoryBlock(headerLine: string, body: string): ParsedUserStory | null {
  const headerMatch = headerLine.match(STORY_HEADER);
  if (!headerMatch) return null;

  const id = headerMatch[1]?.trim();
  const titleFromHeader = (headerMatch[2] ?? "").trim();

  let role: string | undefined;
  let want: string | undefined;
  let benefit: string | undefined;

  const como = body.match(COMO)?.[1]?.trim();
  const quiero = body.match(QUIERO)?.[1]?.trim();
  const para = body.match(PARA)?.[1]?.trim();
  if (como || quiero || para) {
    role = como;
    want = quiero;
    benefit = para;
  } else {
    const classic = body.match(CLASSIC_STORY);
    if (classic) {
      role = classic[1]?.trim();
      want = classic[2]?.trim();
      benefit = classic[3]?.trim();
    }
  }

  const title =
    titleFromHeader ||
    (want ? want.slice(0, 80) : undefined) ||
    id ||
    "Historia de usuario";

  const searchParts = [title, id, role, want, benefit, body.slice(0, 2000)].filter(Boolean);
  return {
    id,
    title,
    role,
    want,
    benefit,
    searchText: searchParts.join(" "),
  };
}

/**
 * Parsea historias de usuario del markdown de backlog (plantilla The Forge).
 * Ignora Epics y tareas técnicas.
 */
export function parseUserStoriesMarkdown(content: string): ParsedUserStory[] {
  const text = (content ?? "").trim();
  if (!text) return [];

  const headerRe = /^#{2,3}\s+(?:Historia\s+de\s+usuario|HU)\s*:/gim;
  const headers: { index: number; line: string }[] = [];

  for (const match of text.matchAll(headerRe)) {
    if (match.index == null) continue;
    const lineEnd = text.indexOf("\n", match.index);
    const line = text.slice(match.index, lineEnd === -1 ? undefined : lineEnd);
    headers.push({ index: match.index, line });
  }

  const stories: ParsedUserStory[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    const body = chunk.slice(headers[i].line.length);
    const parsed = parseStoryBlock(headers[i].line, body);
    if (parsed) stories.push(parsed);
  }

  return stories;
}

/** Infiere hint de UI a partir del texto de la HU o del nombre de entidad. */
export function inferUiHintFromText(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/kanban|pipeline|tablero|embudo|funnel|etapas?/.test(t)) return "kanban";
  if (/formulario|registrar|crear|editar|alta|capturar|inscribir/.test(t)) return "form";
  if (/calendario|agenda|cita|horario/.test(t)) return "calendar";
  if (/wizard|paso a paso|onboarding/.test(t)) return "wizard";
  if (/dashboard|panel|métricas|metricas|kpi|resumen ejecutivo/.test(t)) return "dashboard";
  if (/tabla|listado|consultar|ver lista|grid|catálogo|catalogo/.test(t)) return "table";
  return undefined;
}

/** Clasificación semántica ligera (nombre de entidad + texto HU). */
export function inferClassification(
  entityName: string,
  storyText?: string,
): EntityClassification {
  const combined = `${entityName} ${storyText ?? ""}`.toLowerCase();

  if (/^config|^setting|^param|^price|^rate|^plan$|^policy/.test(entityName.toLowerCase())) {
    return "Configuration";
  }

  const hint = inferUiHintFromText(combined);
  if (hint === "form" || hint === "wizard") return "Configuration";
  if (hint === "kanban") return "WorkflowProcess";

  const workflowPatterns = [
    /order/, /request/, /task/, /ticket/, /invoice/, /payment/, /booking/,
    /appointment/, /claim/, /shipment/, /workflow/, /campaign/, /lead/,
    /subscription/, /incident/, /approval/, /project$/,
  ];
  if (workflowPatterns.some((p) => p.test(combined))) return "WorkflowProcess";

  return "DataRegistry";
}

function formatStoryPurpose(story: ParsedUserStory): string {
  const lines: string[] = [];
  if (story.role || story.want || story.benefit) {
    if (story.role) lines.push(`**Como:** ${story.role}`);
    if (story.want) lines.push(`**Quiero:** ${story.want}`);
    if (story.benefit) lines.push(`**Para:** ${story.benefit}`);
  } else {
    lines.push(story.title);
  }
  if (story.id) lines.push(`\n*Referencia:* ${story.id}`);
  return lines.join("  \n");
}

function defaultEntityScreenName(entityName: string): string {
  return `Gestión de ${entityName}`;
}

function defaultEntityPurpose(entityName: string): string {
  return `Pantalla para administrar la entidad \`${entityName}\`.`;
}

function storyRef(story: ParsedUserStory): string {
  return story.id ? `${story.id} — ${story.title}` : story.title;
}

function resolveContextFromStory(story: ParsedUserStory): string | undefined {
  const parts = [story.role, story.want].filter(Boolean);
  if (parts.length === 0) return story.title;
  return `Como ${story.role ?? "usuario"}, quiero ${story.want ?? story.title}`;
}

/** Slug estable para pantallas derivadas solo de HU (sin tabla §3). */
export function huOnlyEntitySlug(story: ParsedUserStory): string {
  if (story.id) return story.id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return story.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "hu-screen";
}

/**
 * Cruza entidades §3 con historias de usuario y produce el plan de pantallas.
 * - Cada entidad §3 → pantalla (enriquecida si hay HU vinculada).
 * - HU sin entidad → pantalla adicional (flujos transversales).
 */
export function buildPantallasPlan(
  mddMarkdown: string,
  userStoriesMarkdown?: string | null,
  apiContractsMarkdown?: string | null,
): PantallaPlanItem[] {
  const entityNames = extractEntityNamesFromMdd(mddMarkdown);
  const stories = parseUserStoriesMarkdown(userStoriesMarkdown ?? "");
  const endpoints = extractHttpEndpointsFromMarkdown(apiContractsMarkdown ?? "");
  const defaultRoles = extractRolesFromMdd(mddMarkdown);
  const defaultRole = defaultRoles[0] ?? "Usuario autenticado";

  const linkedByEntity = new Map<string, ParsedUserStory[]>();
  const matchedStoryIndexes = new Set<number>();

  for (const entity of entityNames) {
    const matched: ParsedUserStory[] = [];
    stories.forEach((story, idx) => {
      if (storyMatchesEntity(story, entity)) {
        matched.push(story);
        matchedStoryIndexes.add(idx);
      }
    });
    if (matched.length > 0) linkedByEntity.set(entity, matched);
  }

  const plan: PantallaPlanItem[] = [];

  for (const entityName of entityNames) {
    const linked = linkedByEntity.get(entityName) ?? [];
    const primary = linked[0];
    const storyText = linked.map((s) => s.searchText).join(" ");
    const role = primary?.role ? normalizeRoleLabel(primary.role) : defaultRole;
    const screenName = primary?.title?.trim() || defaultEntityScreenName(entityName);
    const uiHint = primary
      ? inferUiHintFromText(`${primary.want ?? ""} ${primary.title}`)
      : inferUiHintFromText(entityName);
    const matched = matchEndpointsForEntity(entityName, endpoints);
    const primaryApi =
      matched.length > 0
        ? formatEndpointList(matched, 2)
        : /login|auth|otp/i.test(screenName)
          ? formatEndpointList(inferAuthEndpoints(endpoints), 2)
          : undefined;

    plan.push({
      name: entityName,
      restEndpoint: matched[0] ? `${matched[0].method} ${matched[0].path}` : undefined,
      classification: inferClassification(entityName, storyText),
      uiHint,
      screenName,
      purpose: primary ? formatStoryPurpose(primary) : defaultEntityPurpose(entityName),
      resolveContext: primary ? resolveContextFromStory(primary) : undefined,
      userStoryRefs: linked.length > 0 ? linked.map(storyRef) : undefined,
      source: primary ? "entity+hu" : "entity",
      role,
      route: inferScreenRoute(screenName, uiHint),
      pageName: inferPageComponentName(screenName),
      uiStates: inferUiStates(screenName, uiHint),
      primaryApi: primaryApi && primaryApi !== "—" ? primaryApi : undefined,
      userStoryId: primary?.id,
      implementationMode: "pull-registry",
    });
  }

  stories.forEach((story, idx) => {
    if (matchedStoryIndexes.has(idx)) return;
    const slug = huOnlyEntitySlug(story);
    const uiHint = inferUiHintFromText(story.searchText);
    const screenName = story.title;
    const authEps = inferAuthEndpoints(endpoints);
    const matched = matchEndpointsForEntity(slug, endpoints);
    const primaryApi =
      matched.length > 0
        ? formatEndpointList(matched, 2)
        : /login|auth|otp/i.test(screenName)
          ? formatEndpointList(authEps, 2)
          : undefined;

    plan.push({
      name: slug,
      restEndpoint: matched[0] ? `${matched[0].method} ${matched[0].path}` : undefined,
      classification: inferClassification(slug, story.searchText),
      uiHint,
      screenName,
      purpose: formatStoryPurpose(story),
      resolveContext: resolveContextFromStory(story),
      userStoryRefs: [storyRef(story)],
      source: "hu-only",
      role: story.role ? normalizeRoleLabel(story.role) : defaultRole,
      route: inferScreenRoute(screenName, uiHint),
      pageName: inferPageComponentName(screenName),
      uiStates: inferUiStates(screenName, uiHint),
      primaryApi: primaryApi && primaryApi !== "—" ? primaryApi : undefined,
      userStoryId: story.id,
      implementationMode: "pull-registry",
    });
  });

  return plan;
}
