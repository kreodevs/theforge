/**
 * @fileoverview Genera instrucciones de prototipo UI (UiProjectInstructions v1) desde plan + pantallas MCP.
 * Solo debe usarse cuando el MCP gráfico activo expone soporte de prototipo (p. ej. validate_ui_project_instructions).
 */
import type { ScreenSpec } from "@theforge/shared-types";
import { UI_PROJECT_JSON_MARKER } from "@theforge/shared-types";
import type { PantallaPlanItem } from "./ui-screens-plan.util.js";
import { slugifyRouteSegment } from "./ui-screen-routes.util.js";

export { UI_PROJECT_JSON_MARKER, splitPantallasAndUiProject } from "@theforge/shared-types";

export interface UiProjectInstructionsV1 {
  version: string;
  project: {
    slug: string;
    name: string;
    clientRef?: string;
  };
  context: {
    locale: string;
    brand: { systemName: string };
    theme: { mode: "light" | "dark" | "system"; preset?: string };
    navigation: {
      appShell: boolean;
      primaryItems: Array<{ label: string; icon: string; screenKey: string }>;
    };
  };
  constraints: {
    preferredComponents: string[];
    maxScreensPerRequest?: number;
  };
  screens: UiProjectScreen[];
  output?: {
    mode: "sync";
    storybook?: {
      baseUrl?: string;
      embed?: { viewMode: string; globals?: Record<string, string> };
    };
  };
}

export interface UiProjectScreen {
  key: string;
  title: string;
  useCase?: {
    id?: string;
    name?: string;
    actors?: string[];
  };
  ui: {
    intent: string;
    layout: "app-shell" | "landing";
    sections: Array<Record<string, unknown>>;
  };
  states: Array<{ key: string; description?: string }>;
}

const COMPONENT_TO_SECTION: Record<string, string> = {
  DataTable: "data-table",
  DynamicForm: "dynamic-form",
  DashboardKPI: "stats-row",
  ChartModern: "chart-panel",
  EmptyState: "empty-state",
  AdvancedFilterBar: "filter-bar",
  PaginationBar: "pagination",
  KanbanBoard: "kanban-board",
};

const COMPONENT_ICON: Record<string, string> = {
  dashboard: "layout-dashboard",
  login: "log-in",
  register: "user-plus",
  settings: "settings",
  default: "layout-grid",
};

function projectSlug(name: string): string {
  const slug = slugifyRouteSegment(name);
  return slug || "project";
}

function screenKeyFromPlan(item: PantallaPlanItem): string {
  const route = (item.route ?? "").replace(/^\//, "");
  if (route) return route.replace(/\//g, "-") || "home";
  return slugifyRouteSegment(item.screenName) || slugifyRouteSegment(item.name) || "screen";
}

function inferUiIntent(item: PantallaPlanItem, components: string[]): string {
  const route = (item.route ?? "").toLowerCase();
  if (/login|register|otp/.test(route)) return "auth-form";
  if (/dashboard|panel|home/.test(route) || components.some((c) => /dashboard|kpi|chart/i.test(c))) {
    return "dashboard";
  }
  if (components.includes("DynamicForm") && !components.includes("DataTable")) return "form-with-validation";
  if (components.includes("DataTable")) return "data-list";
  if (components.includes("KanbanBoard")) return "workflow-board";
  return "general";
}

function inferNavIcon(route: string): string {
  const r = route.toLowerCase();
  if (/dashboard|panel|home/.test(r)) return COMPONENT_ICON.dashboard;
  if (/login/.test(r)) return COMPONENT_ICON.login;
  if (/register/.test(r)) return COMPONENT_ICON.register;
  if (/settings|config/.test(r)) return COMPONENT_ICON.settings;
  return COMPONENT_ICON.default;
}

function componentsForItem(item: PantallaPlanItem, screens: ScreenSpec[]): string[] {
  const entity = item.name;
  const screen = screens.find(
    (s) =>
      s.name === item.screenName ||
      s.components.some((c) => c.entity === entity || c.entity === item.name),
  );
  if (!screen?.components.length) return [];
  return [...new Set(screen.components.map((c) => c.component))];
}

function buildSections(
  item: PantallaPlanItem,
  components: string[],
): Array<Record<string, unknown>> {
  const sections: Array<Record<string, unknown>> = [];
  const title = item.pageName ?? item.screenName;

  sections.push({
    id: "header",
    type: "page-header",
    title,
    breadcrumbs: item.role ? [item.role] : undefined,
  });

  for (const comp of components) {
    const type = COMPONENT_TO_SECTION[comp];
    if (!type || type === "page-header") continue;
    if (sections.some((s) => s.type === type)) continue;
    sections.push({
      id: slugifyRouteSegment(type) || type,
      type,
      title: comp === "DataTable" ? title : undefined,
    });
  }

  if (components.length === 0) {
    sections.push({ id: "content", type: "markdown-content", title: "Contenido" });
  }

  return sections;
}

function parseUiStates(states?: string): Array<{ key: string; description?: string }> {
  const raw = (states ?? "loading, empty, error").split(",").map((s) => s.trim()).filter(Boolean);
  const keys = raw.length > 0 ? raw : ["default"];
  if (!keys.includes("default")) keys.unshift("default");
  return keys.map((key) => ({ key }));
}

/** Construye UiProjectInstructions v1 desde plan de pantallas y specs MCP. */
export function buildUiProjectInstructions(input: {
  projectName: string;
  plan: PantallaPlanItem[];
  screens: ScreenSpec[];
  locale?: string;
  themeMode?: "light" | "dark" | "system";
  themePreset?: string;
}): UiProjectInstructionsV1 {
  const name = (input.projectName ?? "Proyecto").trim() || "Proyecto";
  const slug = projectSlug(name);
  const navSeen = new Set<string>();
  const primaryItems: UiProjectInstructionsV1["context"]["navigation"]["primaryItems"] = [];
  const preferred = new Set<string>(["AppLayout", "EmptyState", "PageHeader"]);
  const uiScreens: UiProjectScreen[] = [];

  for (const item of input.plan) {
    const key = screenKeyFromPlan(item);
    const components = componentsForItem(item, input.screens);
    for (const c of components) preferred.add(c);

    const route = item.route ?? `/${key}`;
    if (!navSeen.has(key) && !/^\/(login|register|otp)/.test(route)) {
      navSeen.add(key);
      primaryItems.push({
        label: item.pageName ?? item.screenName,
        icon: inferNavIcon(route),
        screenKey: key,
      });
    }

    uiScreens.push({
      key,
      title: item.pageName ?? item.screenName,
      useCase: item.userStoryId
        ? { id: item.userStoryId, name: item.purpose, actors: item.role ? [item.role] : undefined }
        : undefined,
      ui: {
        intent: inferUiIntent(item, components),
        layout: /^\/(login|register)/.test(route) ? "landing" : "app-shell",
        sections: buildSections(item, components),
      },
      states: parseUiStates(item.uiStates),
    });
  }

  return {
    version: "1.0.0",
    project: { slug, name },
    context: {
      locale: input.locale ?? "es-MX",
      brand: { systemName: name },
      theme: {
        mode: input.themeMode ?? "system",
        ...(input.themePreset ? { preset: input.themePreset } : {}),
      },
      navigation: {
        appShell: true,
        primaryItems: primaryItems.slice(0, 16),
      },
    },
    constraints: {
      preferredComponents: [...preferred].slice(0, 24),
      maxScreensPerRequest: 12,
    },
    screens: uiScreens.slice(0, 24),
    output: { mode: "sync" },
  };
}

/** Anexa bloque JSON embebido al final del markdown de pantallas. */
export function appendUiProjectToPantallas(
  pantallasMd: string,
  instructions: UiProjectInstructionsV1,
): string {
  const base = pantallasMd.trimEnd();
  const json = JSON.stringify(instructions, null, 2);
  return `${base}\n\n${UI_PROJECT_JSON_MARKER}\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}
