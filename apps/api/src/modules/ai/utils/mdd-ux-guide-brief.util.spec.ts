import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildMddContextForUxGuide,
  UX_GUIDE_MDD_BRIEF_MAX,
} from "./mdd-ux-guide-brief.util.js";

const FINTECH_MDD = `## 1. Contexto y alcance

Plataforma B2B de inversión bursátil con broker Alpaca y dashboard TradingView.
Usuarios: traders profesionales y asesores financieros.

### Capacidades funcionales del producto (MVP)

- Onboarding KYC
- Portafolio en tiempo real

## 2. Arquitectura y Stack

- **Frontend:** React 18 + Vite + Tailwind + shadcn/ui
- **API:** NestJS
- **Mobile:** responsive web, PWA

## 3. Modelo de Datos

### portfolios
### transactions
### users

CREATE TABLE orders (
  id uuid PRIMARY KEY
);

## 4. Contratos de API

| GET | /api/v1/portfolio | Portafolio |
${"Detalle API irrelevante para diseño. ".repeat(80)}

## 5. Lógica y Edge Cases

- Estado vacío sin posiciones abiertas
- Carga asíncrona de cotizaciones
- Error de broker: mostrar banner y reintento

## 6. Seguridad

MFA obligatorio en login.

## 7. Infraestructura

Docker compose.
`;

describe("buildMddContextForUxGuide", () => {
  it("extrae §1, stack UI, entidades y señales sin el MDD completo", () => {
    const brief = buildMddContextForUxGuide(FINTECH_MDD);
    assert.ok(brief.includes("Resumen MDD para inferencia de Design System"));
    assert.ok(brief.includes("inversión bursátil"));
    assert.ok(brief.includes("React"));
    assert.ok(brief.includes("Tailwind"));
    assert.ok(brief.includes("- portfolios"));
    assert.ok(brief.includes("Estado vacío"));
    assert.ok(brief.includes("B2B"));
    assert.ok(!brief.includes("## 4. Contratos de API"));
    assert.ok(!brief.includes("Docker compose"));
    assert.ok(brief.length < FINTECH_MDD.length);
  });

  it("preserva keywords de dominio para auto-match de design reference", () => {
    const brief = buildMddContextForUxGuide(FINTECH_MDD);
    assert.match(brief.toLowerCase(), /fintech|inversi|trading|broker|alpaca/);
  });

  it("respeta presupuesto maxChars", () => {
    const huge = `${FINTECH_MDD}\n${"x".repeat(20_000)}`;
    const brief = buildMddContextForUxGuide(huge, { maxChars: 500 });
    assert.ok(brief.length <= 503);
  });

  it("devuelve vacío si no hay MDD", () => {
    assert.equal(buildMddContextForUxGuide(""), "");
  });

  it("el presupuesto por defecto es UX_GUIDE_MDD_BRIEF_MAX", () => {
    const filler = "z".repeat(30_000);
    const huge = `## 1. Contexto\n\n${filler}`;
    const brief = buildMddContextForUxGuide(huge);
    assert.ok(brief.length <= UX_GUIDE_MDD_BRIEF_MAX + 4);
  });
});
