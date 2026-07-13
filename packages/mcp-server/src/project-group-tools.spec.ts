import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatNestApiError } from "./api-error.util.js";
import {
  PROJECT_GROUP_TOOL_NAMES,
  PROJECT_GROUP_TOOLS,
  createProjectGroupHandlers,
} from "./project-group-tools.js";

describe("formatNestApiError", () => {
  test("403 con mensaje de rol admin", () => {
    const msg = formatNestApiError(
      403,
      JSON.stringify({ statusCode: 403, message: "Se requiere rol admin" }),
    );
    assert.equal(msg, "Acceso denegado (403): Se requiere rol admin");
  });

  test("404 grupo no encontrado", () => {
    const msg = formatNestApiError(
      404,
      JSON.stringify({ statusCode: 404, message: "Grupo no encontrado" }),
    );
    assert.equal(msg, "No encontrado (404): Grupo no encontrado");
  });

  test("403 protección grupo por defecto", () => {
    const msg = formatNestApiError(
      403,
      JSON.stringify({
        statusCode: 403,
        message: "El grupo por defecto no se puede eliminar",
      }),
    );
    assert.equal(msg, "Acceso denegado (403): El grupo por defecto no se puede eliminar");
  });
});

describe("project group MCP tools", () => {
  test("cada tool definida tiene handler", () => {
    const handlers = createProjectGroupHandlers({
      get: async () => [],
      post: async () => ({}),
      patch: async () => ({}),
      delete: async () => ({}),
    });
    for (const name of PROJECT_GROUP_TOOL_NAMES) {
      assert.ok(typeof handlers[name] === "function", `Falta handler para ${name}`);
    }
  });

  test("create_project_group valida nombre vacío antes de llamar API", async () => {
    const handlers = createProjectGroupHandlers({
      get: async () => [],
      post: async () => {
        throw new Error("no debería llamar API");
      },
      patch: async () => ({}),
      delete: async () => ({}),
    });
    await assert.rejects(
      () => handlers.create_project_group!({ name: "" }),
      /String must contain at least 1 character|nombre/i,
    );
  });

  test("get_project_group devuelve 404 en español si no existe", async () => {
    const handlers = createProjectGroupHandlers({
      get: async () => [{ id: "00000000-0000-4000-8000-000000000002", name: "Otros" }],
      post: async () => ({}),
      patch: async () => ({}),
      delete: async () => ({}),
    });
    await assert.rejects(
      () =>
        handlers.get_project_group!({
          groupId: "00000000-0000-4000-8000-000000000099",
        }),
      /No encontrado \(404\): Grupo no encontrado/,
    );
  });

  test("move_project_to_group valida UUIDs", async () => {
    const handlers = createProjectGroupHandlers({
      get: async () => [],
      post: async () => ({}),
      patch: async () => {
        throw new Error("no debería llamar API");
      },
      delete: async () => ({}),
    });
    await assert.rejects(
      () => handlers.move_project_to_group!({ projectId: "x", groupId: "y" }),
      /UUID válido/,
    );
  });

  test("PROJECT_GROUP_TOOLS tiene 7 herramientas", () => {
    assert.equal(PROJECT_GROUP_TOOLS.length, 7);
  });
});
