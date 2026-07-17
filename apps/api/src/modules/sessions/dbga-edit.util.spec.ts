import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BENCHMARK_CHAT_ACK,
  benchmarkAssistantChatMessage,
  dbgaContainsUserEditKeywords,
  dbgaReflectsUserEditIntent,
  extractDbgaEditKeywords,
  isDbgaContentNearlyIdentical,
  isPartialBenchmarkDoc,
  looksLikeDbgaEditRequest,
  mergeBenchmarkPartialDoc,
  parseBenchmarkResponse,
  wouldShrinkDbgaDangerously,
} from "./dbga-edit.util.js";

describe("looksLikeDbgaEditRequest", () => {
  it("detecta petición de cambio multi-tenant", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Hay que hacer modificaciones. El catálogo debe ser multi tenant con tenant_id en OBP y OBP4MO",
      ),
    );
  });

  it("detecta integrar Kill Switch al documento", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Haz las modificaciones al documento. Integrar Kill Switch y tablero de aprobación humana.",
      ),
    );
  });
});

describe("dbgaReflectsUserEditIntent", () => {
  it("falla si piden tenant_id y el doc no lo tiene", () => {
    const doc = "# Research Report\n\n## Módulo 01\nSin tenant.";
    const user =
      "todo el microservicio sea multi tenant lógico a través de un tenant_id";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), false);
  });

  it("pasa si el doc incluye tenant_id", () => {
    const doc = "## Multi-tenancy\n`tenant_id` en catálogo y tablas espejo.";
    const user = "multi tenant con tenant_id";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), true);
  });

  it("falla si piden tablas espejo geográficas y el doc no las menciona", () => {
    const doc = "# Research Report\n\n## Catálogo\nSolo costos.";
    const user =
      "diagrama con paises, estados, ciudades; debemos tener espejo con tenant_id";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), false);
  });

  it("pasa si piden id de origen e id propio en tablas espejo", () => {
    const doc = `### Tablas espejo
| tabla | tenant_id | origin_id | id_espejo |
| paises_espejo | uuid | int origen | bigint PK |`;
    const user =
      "En todas las tablas espejo necesitamos el id de origen y el id propio de la tabla espejo";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), true);
  });

  it("falla si piden Kill Switch y el doc no lo menciona", () => {
    const doc = "# Research Report\n\n## Propósito\nAutomatización básica.";
    const user =
      "Integrar Kill Switch con tablero de aprobación humana y firma digital antes de Google Ads";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), false);
  });

  it("pasa si piden Kill Switch y el doc lo incluye", () => {
    const doc =
      "# Research Report\n\n## Kill Switch\nTablero de aprobación humana con firma digital antes de montar Google Ads.";
    const user = "Integrar Kill Switch y tablero de aprobación";
    assert.equal(dbgaReflectsUserEditIntent(doc, user), true);
  });
});

describe("looksLikeDbgaEditRequest — ajustes", () => {
  it("detecta «haz los ajustes» con contexto espejo", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "En todas las tablas espejo necesitamos el id de origen y el id propio, haz los ajustes",
      ),
    );
  });

  it("no trata brainstorming de arquitectura como edición", () => {
    assert.equal(
      looksLikeDbgaEditRequest(
        "Tenemos que aislar el núcleo del negocio de las APIs. Vamos a usar adaptadores.",
      ),
      false,
    );
  });
});

describe("benchmarkAssistantChatMessage", () => {
  it("no afirma éxito si no hubo persistencia", () => {
    const msg = benchmarkAssistantChatMessage(BENCHMARK_CHAT_ACK, undefined);
    assert.match(msg, /No se guardaron cambios/i);
  });

  it("mantiene ack cuando sí hubo doc", () => {
    const msg = benchmarkAssistantChatMessage(BENCHMARK_CHAT_ACK, "# DBGA\n\ntenant_id");
    assert.equal(msg, BENCHMARK_CHAT_ACK);
  });

  it("rechaza afirmación falsa de documento actualizado", () => {
    const msg = benchmarkAssistantChatMessage(
      "He actualizado el documento completo integrando el Kill Switch en el panel.",
      undefined,
    );
    assert.match(msg, /No se guardaron cambios/i);
  });

  it("colapsa cuerpo de documento en chat cuando sí hubo persistencia", () => {
    const docBody =
      "1. Resumen Ejecutivo\n\nForgeOps es una plataforma.\n\n2. Benchmark de Industria\n\n".repeat(25);
    const msg = benchmarkAssistantChatMessage(
      `He integrado la especificación del Portal de Licencias.\n\n${docBody}`,
      "# Domain Benchmark\n\nSección licenciamiento actualizada.",
    );
    assert.equal(msg, BENCHMARK_CHAT_ACK);
  });
});

describe("extractDbgaEditKeywords", () => {
  it("extrae conceptos relevantes del pedido", () => {
    const keys = extractDbgaEditKeywords(
      "Integrar Kill Switch con tablero de aprobación humana y firma digital",
    );
    assert.ok(keys.includes("kill"));
    assert.ok(keys.includes("switch") || keys.some((k) => k.includes("kill")));
    assert.ok(keys.includes("tablero") || keys.includes("aprobación") || keys.includes("aprobacion"));
  });
});

describe("dbgaContainsUserEditKeywords", () => {
  it("detecta solapamiento doc vs pedido", () => {
    const doc = "## Kill Switch\nTablero de aprobación con firma digital.";
    const user = "Integrar Kill Switch y tablero de aprobación";
    assert.equal(dbgaContainsUserEditKeywords(doc, user), true);
  });
});

describe("isDbgaContentNearlyIdentical", () => {
  it("detecta copias casi iguales", () => {
    const a = "x".repeat(10_000);
    const b = a + " ";
    assert.equal(isDbgaContentNearlyIdentical(b, a), true);
  });

  it("NO descarta una aclaración pequeña en un documento grande", () => {
    // Regresión: un DBGA de ~90 KB con una aclaración de ~250 chars no debe tratarse
    // como "sin cambios" (antes el umbral proporcional 0.008 llegaba a ~720 chars).
    const current = "# Domain Benchmark\n\n" + "contenido de dominio. ".repeat(4_000);
    const edit =
      current +
      "\n\n## PAT\nExisten dos tipos de PAT: el de la cuenta maestra de Wasender API que coordina las sesiones de cada tenant, y el del usuario provisto por el SSO corporativo.";
    assert.equal(isDbgaContentNearlyIdentical(edit, current), false);
  });
});

describe("parseBenchmarkResponse", () => {
  it("separa doc y chat con ---FIN_DBGA---", () => {
    const text = "### Módulos\n\nContenido tenant_id.\n\n---FIN_DBGA---\nListo, revisa el panel.";
    const split = parseBenchmarkResponse(text);
    assert.ok(split);
    assert.match(split!.docPart, /tenant_id/);
    assert.match(split!.chatPart, /revisa el panel/i);
  });

  it("tolera espacios en el delimitador", () => {
    const text = "## Arquitectura\n\n--- FIN_DBGA ---\nOk.";
    const split = parseBenchmarkResponse(text);
    assert.ok(split);
    assert.match(split!.docPart, /Arquitectura/);
  });

  it("tolera delimitador sin guiones finales (---FIN_DBGA)", () => {
    const text = "# Domain Benchmark\n\nContenido con tenant_id.\n\n---FIN_DBGA";
    const split = parseBenchmarkResponse(text);
    assert.ok(split);
    assert.match(split!.docPart, /tenant_id/);
    assert.doesNotMatch(split!.docPart, /FIN_DBGA/);
    assert.equal(split!.chatPart, BENCHMARK_CHAT_ACK);
  });

  it("tolera delimitador sin guiones iniciales (FIN_DBGA---)", () => {
    const text = "# Domain Benchmark\n\nContenido.\n\nFIN_DBGA---\nListo.";
    const split = parseBenchmarkResponse(text);
    assert.ok(split);
    assert.match(split!.docPart, /Contenido/);
    assert.match(split!.chatPart, /Listo/);
  });

  it("tolera delimitador en su propia línea sin guiones o envuelto", () => {
    for (const marker of ["FIN_DBGA", "## FIN_DBGA", "**FIN_DBGA**"]) {
      const text = `# Domain Benchmark\n\nCuerpo del análisis.\n\n${marker}\n\nRevisa el panel.`;
      const split = parseBenchmarkResponse(text);
      assert.ok(split, `marker=${marker}`);
      assert.match(split!.docPart, /Cuerpo del análisis/);
      assert.doesNotMatch(split!.docPart, /FIN_DBGA/);
    }
  });
});

describe("mergeBenchmarkPartialDoc", () => {
  it("conserva cabecera Research Report al recibir fragmento ### Módulos", () => {
    const current = "# Research Report — Costos\n\n**Etapa:** principal\n\n## Intro\n\nTexto previo.";
    const partial = "### Módulos del proyecto\n\n| 01 | Catálogo | tenant_id |";
    const merged = mergeBenchmarkPartialDoc(current, partial);
    assert.match(merged, /^# Research Report/);
    assert.match(merged, /tenant_id/);
    assert.doesNotMatch(merged, /Texto previo/);
  });
});

describe("wouldShrinkDbgaDangerously", () => {
  it("bloquea fragmento que borra la mayor parte del doc", () => {
    const current = "# Research Report\n\n" + "x".repeat(5000);
    const fragment = "### Módulos\n\n" + "y".repeat(800);
    assert.equal(wouldShrinkDbgaDangerously(current, fragment), true);
  });

  it("bloquea catálogo de endpoints que sustituye un DBGA largo", () => {
    const current = `# Domain Benchmark & Gap Analysis

## 1. Referencia de Industria
${"x".repeat(8000)}

## 2. Funcionalidades
Detalle del producto…`;
    const endpoints = `Aquí tienes la lista simplificada de los endpoints esenciales:

1. Gestión de Sesión
POST /v1/chats — Crea sesión.
GET /v1/chats/{chat_id} — Historial.
DELETE /v1/chats/{chat_id} — Cierra.

2. Mensajería
POST /v1/chats/{chat_id}/messages
POST /v1/chats/{chat_id}/messages/stream

3. Estado
GET /v1/chats/{chat_id}/status
POST /v1/chats/{chat_id}/stop
`;
    assert.equal(wouldShrinkDbgaDangerously(current, endpoints), true);
  });

  it("bloquea doc reducido a registro de cambios sin Research Report", () => {
    const current = `# Research Report

## Dos objetivos centrales
Objetivos…

### Módulos del proyecto
Detalle extenso ${"x".repeat(4000)}`;
    const next = `## Registro de cambios del documento

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 2.4 | Julio 2026 | Gap migración tiers |`;
    assert.equal(wouldShrinkDbgaDangerously(current, next), true);
  });

  it("bloquea Domain Benchmark reducido a solo changelog", () => {
    const current = `# Domain Benchmark & Gap Analysis (DBGA) – ForgeOps

## 1. Referencia de Industria
${"x".repeat(5000)}

## 2. Funcionalidades
Detalle…`;
    const next = `## Registro de cambios del documento

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 2.3 | Julio 2026 | Auditoría de acciones |`;
    assert.equal(wouldShrinkDbgaDangerously(current, next), true);
  });
});
