import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMoveToFirstUpdates,
  sortProjectGroupsByOrder,
} from "./project-group-order.util.js";

const DEFAULT_ID = "00000000-0000-4000-8000-000000000001";
const GROUP_B = "00000000-0000-4000-8000-000000000002";
const GROUP_C = "00000000-0000-4000-8000-000000000003";

describe("sortProjectGroupsByOrder", () => {
  it("ordena por sortOrder y desempata por nombre", () => {
    const sorted = sortProjectGroupsByOrder([
      { id: "b", sortOrder: 1, name: "Zeta" },
      { id: "a", sortOrder: 0, name: "Beta" },
      { id: "c", sortOrder: 0, name: "Alpha" },
    ]);
    assert.deepEqual(
      sorted.map((g) => g.id),
      ["c", "a", "b"],
    );
  });
});

describe("computeMoveToFirstUpdates", () => {
  const groups = [
    { id: DEFAULT_ID, sortOrder: 0, name: "Proyectos" },
    { id: GROUP_B, sortOrder: 1, name: "Clientes" },
    { id: GROUP_C, sortOrder: 2, name: "Internos" },
  ];

  it("devuelve null si el grupo no existe", () => {
    assert.equal(computeMoveToFirstUpdates(groups, "missing"), null);
  });

  it("devuelve array vacío si ya es el primero (no-op)", () => {
    assert.deepEqual(computeMoveToFirstUpdates(groups, DEFAULT_ID), []);
  });

  it("mueve el grupo objetivo a sortOrder 0 y desplaza los demás", () => {
    const updates = computeMoveToFirstUpdates(groups, GROUP_C);
    assert.deepEqual(updates, [
      { id: GROUP_C, sortOrder: 0 },
      { id: DEFAULT_ID, sortOrder: 1 },
      { id: GROUP_B, sortOrder: 2 },
    ]);
  });

  it("mueve un grupo intermedio al frente", () => {
    const updates = computeMoveToFirstUpdates(groups, GROUP_B);
    assert.deepEqual(updates, [
      { id: GROUP_B, sortOrder: 0 },
      { id: DEFAULT_ID, sortOrder: 1 },
      { id: GROUP_C, sortOrder: 2 },
    ]);
  });
});
