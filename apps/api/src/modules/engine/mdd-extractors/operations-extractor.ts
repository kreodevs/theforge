/**
 * Extractor de operations.json desde MDD §1-§4.
 * Deriva qué operaciones CRUD, endpoints, auth y páginas frontend
 * tiene cada entidad basándose en el modelo de datos + contratos API.
 */

import { MddTypesJson, MddEntity } from "./types-extractor.js";

export interface ApiRoute {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD";
  path: string;
  action: "create" | "read" | "update" | "delete" | "list" | "restore" | "search" | "health";
  auth?: string[]; // roles permitidos; vacío = público
  params?: string[]; // path params, ej: ["id"]
  body?: string; // nombre del DTO de request
  response?: string; // nombre del DTO de response
  softDelete?: boolean;
  description?: string;
  pagination?: { type: "cursor" | "offset"; pageSize?: number } | boolean;
  searchable?: string[]; // campos buscables
  sortable?: string[]; // campos sortable
  rateLimit?: { requests: number; window: string };
}

export interface FrontendPage {
  route: string;
  component: string;
  layout?: string; // "admin", "public", "dashboard"
  features?: string[]; // ej: ["dataTable", "search", "filters", "tabs"]
  dataTable?: boolean;
  search?: boolean;
  filters?: string[];
  tabs?: string[];
  form?: string; // librería de formulario, ej: "react-hook-form+zod"
  states?: string[]; // "empty", "loading", "error", "success"
}

export interface EntityOperation {
  entity: string;
  type: "crud" | "read-only" | "write-only" | "custom";
  routes: ApiRoute[];
  frontend?: {
    admin?: boolean;
    public?: boolean;
    publicRoute?: string;
    pages: FrontendPage[];
  };
  overrides?: {
    crudAuto?: boolean;
    softDelete?: boolean;
    pagination?: "cursor" | "offset" | false;
    rbac?: string[] | false;
  };
}

export interface GlobalFeatures {
  pagination: { type: "cursor" | "offset"; pageSizes: number[] };
  search: { type: "fulltext" | "like"; minLength: number };
  softDelete: { enabled: boolean; restorable: boolean };
  audit: { fields: string[]; enabled: boolean };
  auth: { type: "jwt" | "session" | "apikey" | "none"; optional?: boolean };
}

export interface InferenceSettings {
  mode: "strict" | "auto" | "suggest";
  confidenceThreshold: number;
  maxInferredTasks: number;
  defaults: {
    pagination: "cursor" | "offset";
    pageSize: number;
    auth: string[];
    frontendFramework: string;
    stateManagement: string;
    formLibrary: string;
    validation: string;
    uiLibrary: string;
    tableComponent: string;
    testFramework: string;
    e2eFramework: string;
  };
}

export interface MddOperationsJson {
  version: string;
  source: string;
  generatedAt: string;
  inferenceSettings: InferenceSettings;
  globalFeatures: GlobalFeatures;
  operations: EntityOperation[];
}

/**
 * Extrae operations.json desde MDD §3 + §4.
 * @param section3Markdown — texto de MDD §3 (Modelo de Datos)
 * @param section4Markdown — texto de MDD §4 (Contratos de API)
 * @param typesJson — types.json previamente extraído (para validar consistencia)
 */
export function extractOperationsFromMdd(
  section3Markdown: string,
  section4Markdown: string,
  typesJson: MddTypesJson,
): MddOperationsJson {
  const operations: EntityOperation[] = [];

  for (const entity of typesJson.entities) {
    const op = inferEntityOperations(entity, section4Markdown, typesJson);
    operations.push(op);
  }

  // Detectar features globales desde el MDD
  const globalFeatures = inferGlobalFeatures(section3Markdown, section4Markdown);

  return {
    version: "1.0",
    source: "mdd-sections-3-4-extracted",
    generatedAt: new Date().toISOString(),
    inferenceSettings: buildDefaultInferenceSettings(globalFeatures),
    globalFeatures,
    operations,
  };
}

function inferEntityOperations(
  entity: MddEntity,
  section4Markdown: string,
  typesJson: MddTypesJson,
): EntityOperation {
  const routes: ApiRoute[] = [];
  const plural = pluralize(entity.name);
  const hasSoftDelete = entity.flags?.includes("soft_deletable") ?? false;
  const isReadOnly = entity.flags?.includes("read-only") ?? false;
  const isWriteOnly = entity.flags?.includes("write-only") ?? false;
  const isAuditLog = entity.name.toLowerCase().includes("audit") || entity.name.toLowerCase().includes("log");

  // Determinar tipo de operación
  let opType: EntityOperation["type"] = "crud";
  if (isReadOnly) opType = "read-only";
  if (isWriteOnly) opType = "write-only";
  if (isAuditLog) opType = "read-only"; // Audit logs normalmente no se mutan por API

  // Si hay contratos API explícitos en §4, usarlos (filtrar según opType)
  let explicitRoutes = extractExplicitRoutes(section4Markdown, entity.name, plural);
  if (explicitRoutes.length > 0) {
    if (opType === "read-only") {
      explicitRoutes = explicitRoutes.filter((r) => r.method === "GET");
    } else if (opType === "write-only") {
      explicitRoutes = explicitRoutes.filter((r) => r.method !== "GET");
    }
    routes.push(...explicitRoutes);
  } else {
    // Inferir rutas por defecto basado en tipo de operación
    routes.push(...inferDefaultRoutes(entity, opType, hasSoftDelete, plural));
  }

  // Enriquecer rutas list con valores por defecto cuando no vienen explícitos
  const searchableFields = entity.fields
    .filter((f) => f.searchable || f.name === "email" || f.name === "name" || f.name === "title")
    .map((f) => f.name);
  const sortableFields = entity.fields
    .filter((f) => f.sortable || f.name === "createdAt")
    .map((f) => f.name);
  for (const route of routes) {
    if (route.action === "list") {
      if (!route.pagination) {
        route.pagination = { type: "cursor", pageSize: 20 };
      }
      if (!route.searchable || route.searchable.length === 0) {
        route.searchable = searchableFields;
      }
      if (!route.sortable || route.sortable.length === 0) {
        route.sortable = sortableFields;
      }
    }
  }

  // Inferir frontend
  const frontend = inferFrontend(entity, routes, typesJson);

  return {
    entity: entity.name,
    type: opType,
    routes,
    frontend,
    overrides: {
      crudAuto: opType === "crud",
      softDelete: hasSoftDelete,
      pagination: "cursor",
      rbac: ["admin"], // default
    },
  };
}

function inferDefaultRoutes(
  entity: MddEntity,
  opType: string,
  hasSoftDelete: boolean,
  plural: string,
): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const basePath = `/api/${plural}`;

  if (opType === "crud" || opType === "write-only") {
    routes.push({
      method: "POST",
      path: basePath,
      action: "create",
      auth: ["admin"],
      body: `Create${entity.name}Dto`,
      response: `${entity.name}Response`,
    });
  }

  if (opType === "crud" || opType === "read-only") {
    routes.push({
      method: "GET",
      path: basePath,
      action: "list",
      auth: ["admin", "moderator"],
      pagination: { type: "cursor", pageSize: 20 },
      searchable: entity.fields
        .filter((f) => f.searchable || f.name === "email" || f.name === "name" || f.name === "title")
        .map((f) => f.name),
      sortable: entity.fields.filter((f) => f.sortable || f.name === "createdAt").map((f) => f.name),
      response: `Paginated${entity.name}Response`,
    });

    routes.push({
      method: "GET",
      path: `${basePath}/:id`,
      action: "read",
      auth: ["admin", "moderator", "self"],
      params: ["id"],
      response: `${entity.name}Response`,
    });
  }

  if (opType === "crud" || opType === "write-only") {
    routes.push({
      method: "PATCH",
      path: `${basePath}/:id`,
      action: "update",
      auth: ["admin", "self"],
      params: ["id"],
      body: `Update${entity.name}Dto`,
      response: `${entity.name}Response`,
    });

    if (hasSoftDelete) {
      routes.push({
        method: "DELETE",
        path: `${basePath}/:id`,
        action: "delete",
        auth: ["admin"],
        params: ["id"],
        softDelete: true,
        response: "DeleteResponse",
      });

      routes.push({
        method: "POST",
        path: `${basePath}/:id/restore`,
        action: "restore",
        auth: ["admin"],
        params: ["id"],
        response: `${entity.name}Response`,
      });
    } else {
      routes.push({
        method: "DELETE",
        path: `${basePath}/:id`,
        action: "delete",
        auth: ["admin"],
        params: ["id"],
        response: "DeleteResponse",
      });
    }
  }

  return routes;
}

function extractExplicitRoutes(
  section4Markdown: string,
  entityName: string,
  plural: string,
): ApiRoute[] {
  const routes: ApiRoute[] = [];

  // Heurística: buscar tablas markdown en §4 que mencionen la entidad
  const entityPattern = new RegExp(
    `^#{2,4}.*?(?:${entityName}|${plural})`,
    "gim",
  );

  const blocks = splitMarkdownByHeaders(section4Markdown);
  for (const block of blocks) {
    if (entityPattern.test(block)) {
      // Extraer tabla de endpoints si existe
      const tableRoutes = parseEndpointTable(block);
      routes.push(...tableRoutes);
    }
  }

  return routes;
}

function parseEndpointTable(block: string): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const lines = block.split("\n").map((l) => l.trimEnd());

  // Buscar header de tabla markdown
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (
      l.startsWith("|") &&
      l.endsWith("|") &&
      /método|method|ruta|path|descripción|description/.test(l.toLowerCase())
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0 || headerIdx + 1 >= lines.length) return routes;

  // Validar separador markdown
  const sep = lines[headerIdx + 1].trim();
  if (!sep.startsWith("|") || !sep.endsWith("|") || !sep.includes("-")) return routes;

  // Extraer celdas del header (sin pipes externos)
  const headerCells = lines[headerIdx].trim().slice(1, -1).split("|").map((h) => h.trim().toLowerCase());

  const getCol = (row: string[], possibleNames: string[]) => {
    for (const name of possibleNames) {
      const idx = headerCells.indexOf(name);
      if (idx >= 0 && idx < row.length) return row[idx];
    }
    return "";
  };

  // Iterar filas de body
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) break;
    const row = line.slice(1, -1).split("|").map((c) => c.trim());
    if (row.length < 3) continue;

    const method = getCol(row, ["método", "method", "http", "verb"]);
    const path = getCol(row, ["ruta", "path", "route", "url", "endpoint"]);
    const desc = getCol(row, ["descripción", "description", "desc"]);
    const authText = getCol(row, ["auth", "autenticación", "roles", "permisos"]);

    if (!method || !path) continue;

    const normalizedMethod = method.toUpperCase().trim() as ApiRoute["method"];
    const action = inferActionFromMethod(normalizedMethod, path);

    const auth: string[] = [];
    if (authText.toLowerCase().includes("admin")) auth.push("admin");
    if (authText.toLowerCase().includes("moderator")) auth.push("moderator");
    if (authText.toLowerCase().includes("self")) auth.push("self");

    const softDelete = desc.toLowerCase().includes("soft") || desc.toLowerCase().includes("lógico");

    routes.push({
      method: normalizedMethod,
      path,
      action,
      auth: auth.length > 0 ? auth : undefined,
      description: desc || undefined,
      softDelete: softDelete || undefined,
    });
  }

  return routes;
}

function inferActionFromMethod(method: string, path: string): ApiRoute["action"] {
  if (method === "POST") {
    if (path.includes("/restore")) return "restore";
    return "create";
  }
  if (method === "GET") {
    if (path.includes("/:id") || path.includes("/{id}")) return "read";
    if (path.includes("/search")) return "search";
    return "list";
  }
  if (method === "PATCH" || method === "PUT") return "update";
  if (method === "DELETE") return "delete";
  return "health";
}

function inferFrontend(
  entity: MddEntity,
  routes: ApiRoute[],
  _typesJson: MddTypesJson,
): EntityOperation["frontend"] {
  const pages: FrontendPage[] = [];
  const hasAdmin = routes.some((r) => r.auth?.includes("admin"));
  const hasList = routes.some((r) => r.action === "list");
  const hasCreate = routes.some((r) => r.action === "create");
  const hasRead = routes.some((r) => r.action === "read");
  const hasUpdate = routes.some((r) => r.action === "update");
  const plural = pluralize(entity.name);

  if (hasList) {
    pages.push({
      route: `/admin/${plural}`,
      component: `${entity.name}ListPage`,
      layout: "admin",
      features: ["dataTable", "pagination"],
      dataTable: true,
      search: true,
      filters: entity.fields
        .filter((f) => f.type === "ENUM" || f.name === "createdAt" || f.name === "status")
        .map((f) => f.name),
      states: ["empty", "loading", "error"],
    });
  }

  if (hasRead) {
    pages.push({
      route: `/admin/${plural}/:id`,
      component: `${entity.name}DetailPage`,
      layout: "admin",
      tabs: hasUpdate ? ["view", "edit", "history"] : ["view", "history"],
      states: ["loading", "error", "not-found"],
    });
  }

  if (hasCreate || hasUpdate) {
    pages.push({
      route: `/admin/${plural}/new`,
      component: `${entity.name}CreatePage`,
      layout: "admin",
      form: "react-hook-form+zod",
      features: ["validation", "auto-save"],
      states: ["submitting", "success", "error", "validation-error"],
    });

    if (hasUpdate) {
      pages.push({
        route: `/admin/${plural}/:id/edit`,
        component: `${entity.name}EditPage`,
        layout: "admin",
        form: "react-hook-form+zod",
        features: ["validation", "dirty-check"],
        states: ["submitting", "success", "error", "not-found"],
      });
    }
  }

  // Páginas públicas (si no es solo admin)
  const publicEntities = ["Product", "Category", "Article", "Post", "Event"];
  const isPublic = publicEntities.some((pe) => entity.name.toLowerCase().includes(pe.toLowerCase()));

  if (isPublic && hasList) {
    pages.push({
      route: `/${plural}`,
      component: `Public${entity.name}ListPage`,
      layout: "public",
      features: ["dataTable", "pagination"],
      dataTable: true,
      search: true,
      states: ["empty", "loading", "error"],
    });

    if (hasRead) {
      pages.push({
        route: `/${plural}/:slug`,
        component: `Public${entity.name}DetailPage`,
        layout: "public",
        states: ["loading", "error", "not-found"],
      });
    }
  }

  return {
    admin: hasAdmin,
    public: isPublic,
    pages,
  };
}

function inferGlobalFeatures(
  section3Markdown: string,
  section4Markdown: string,
): GlobalFeatures {
  const text = `${section3Markdown}\n${section4Markdown}`.toLowerCase();

  const hasSoftDelete = text.includes("soft") || text.includes("deletedat") || text.includes("eliminado lógico");
  const hasAudit = text.includes("audit") || text.includes("createdby") || text.includes("updatedby");
  const hasAuth = text.includes("jwt") || text.includes("auth") || text.includes("session");

  return {
    pagination: {
      type: text.includes("offset") ? "offset" : "cursor",
      pageSizes: [10, 20, 50, 100],
    },
    search: {
      type: text.includes("fulltext") ? "fulltext" : "like",
      minLength: 3,
    },
    softDelete: {
      enabled: hasSoftDelete,
      restorable: hasSoftDelete,
    },
    audit: {
      fields: hasAudit ? ["createdAt", "updatedAt", "createdBy", "updatedBy"] : [],
      enabled: hasAudit,
    },
    auth: {
      type: hasAuth ? "jwt" : "none",
    },
  };
}

function buildDefaultInferenceSettings(globalFeatures: GlobalFeatures): InferenceSettings {
  return {
    mode: "auto",
    confidenceThreshold: 0.8,
    maxInferredTasks: 100,
    defaults: {
      pagination: globalFeatures.pagination.type,
      pageSize: globalFeatures.pagination.pageSizes[1] ?? 20,
      auth: globalFeatures.auth.type !== "none" ? ["jwt"] : [],
      frontendFramework: "react",
      stateManagement: "tanstack-query",
      formLibrary: "react-hook-form",
      validation: "zod",
      uiLibrary: "shadcn",
      tableComponent: "data-table",
      testFramework: "jest",
      e2eFramework: "playwright",
    },
  };
}

// Utilidades
function pluralize(singular: string): string {
  const irregulars: Record<string, string> = {
    child: "children",
    person: "people",
    man: "men",
    woman: "women",
    tooth: "teeth",
    foot: "feet",
    mouse: "mice",
    goose: "geese",
    ox: "oxen",
    datum: "data",
    criterium: "criteria",
    phenomenon: "phenomena",
  };

  if (irregulars[singular.toLowerCase()]) return irregulars[singular.toLowerCase()];

  if (singular.endsWith("y") && !singular.endsWith("ay") && !singular.endsWith("ey") && !singular.endsWith("oy") && !singular.endsWith("uy")) {
    return singular.slice(0, -1) + "ies";
  }
  if (singular.endsWith("s") || singular.endsWith("x") || singular.endsWith("z") || singular.endsWith("ch") || singular.endsWith("sh")) {
    return singular + "es";
  }
  if (singular.endsWith("f")) {
    return singular.slice(0, -1) + "ves";
  }
  if (singular.endsWith("fe")) {
    return singular.slice(0, -2) + "ves";
  }

  return singular + "s";
}

function splitMarkdownByHeaders(md: string): string[] {
  const blocks: string[] = [];
  const lines = md.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{2,4}\s+/.test(line)) {
      if (current.length) blocks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

export default {
  extractOperationsFromMdd,
};
