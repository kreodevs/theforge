import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkSpecVsApi,
  checkUserStoriesVsTasks,
  collectLowMediumReadinessGaps,
} from "./low-medium-readiness.util.js";
import { ComplexityLevel } from "@theforge/database";

test("checkUserStoriesVsTasks detecta HU sin task", () => {
  const us =
    "## HU-01 Login\n\nComo administrador quiero iniciar sesión de forma segura en el portal.";
  const tasks = "## Setup inicial\n\n- Configurar repositorio y pipeline de despliegue continuo.";
  const r = checkUserStoriesVsTasks(us, tasks);
  assert.equal(r.ok, false);
  assert.ok(r.gaps.some((g) => g.includes("HU_01") || g.includes("HU-01")));
});

test("checkSpecVsApi detecta concepto Spec sin API", () => {
  const spec =
    "## Capacidades del producto\n\n**Facturación recurrente** automatizada y **reportes** ejecutivos mensuales.";
  const api = "## Endpoints\n\nGET /api/v1/health — comprobación de disponibilidad del servicio.";
  const r = checkSpecVsApi(spec, api);
  assert.equal(r.ok, false);
});

test("collectLowMediumReadinessGaps LOW exige HU y Tasks", () => {
  const gaps = collectLowMediumReadinessGaps(ComplexityLevel.LOW, {
    userStoriesContent: null,
    tasksContent: null,
  });
  assert.ok(gaps.some((g) => g.includes("Historias de usuario")));
  assert.ok(gaps.some((g) => g.includes("Tasks")));
});

test("collectLowMediumReadinessGaps MEDIUM exige Spec y API", () => {
  const gaps = collectLowMediumReadinessGaps(ComplexityLevel.MEDIUM, {
    specContent: "x".repeat(50),
    apiContractsContent: null,
    tasksContent: "x".repeat(50),
  });
  assert.ok(gaps.some((g) => g.includes("Contratos API") || g.includes("API")));
});
