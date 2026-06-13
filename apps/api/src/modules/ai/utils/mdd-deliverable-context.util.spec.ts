import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildMddContextForUseCases,
  buildMddContextForUserStories,
  MDD_DELIVERABLE_BUDGET,
} from "./mdd-deliverable-context.util.js";

const SAMPLE_MDD = (filler: string) => `## 1. Contexto y alcance

### Capacidades funcionales del producto (MVP)

- **Onboarding con IA:** Chat que genera pipeline.
- **Facturación SaaS vía Stripe:** Membresías de tenant.

### Usuarios y casos de uso clave

1. **Administrador de negocio** → Configuración inicial instantánea.
2. **Comercial** → Pipeline kanban.

### Criterios de aceptación (UAT)

1. **Onboarding Zero-Form:** Pipeline de 4+ etapas.
2. **Seguridad MFA:** Usuario sin MFA recibe 403.

## 4. Contratos de API

| Método | Ruta | Descripción |
| GET | \`/api/v1/auth/login\` | Login |
| POST | \`/api/v1/leads\` | Crear lead |

## 6. Seguridad

MFA TOTP obligatorio.

${filler}`;

describe("buildMddContextForDeliverable", () => {
  it("devuelve el MDD íntegro si cabe en el presupuesto", () => {
    const mdd = "## 1. Contexto\n\nCorto.";
    assert.equal(buildMddContextForUserStories(mdd), mdd);
    assert.equal(buildMddContextForUseCases(mdd), mdd);
  });

  it("prioriza checklist para historias de usuario", () => {
    const filler = "x".repeat(MDD_DELIVERABLE_BUDGET + 5000);
    const out = buildMddContextForUserStories(SAMPLE_MDD(filler));
    assert.ok(out.length <= MDD_DELIVERABLE_BUDGET);
    assert.ok(out.includes("HU o Tarea técnica"));
    assert.ok(out.includes("Onboarding con IA"));
    assert.ok(!out.includes(filler.slice(0, 200)));
  });

  it("prioriza checklist para casos de uso", () => {
    const filler = "x".repeat(MDD_DELIVERABLE_BUDGET + 5000);
    const out = buildMddContextForUseCases(SAMPLE_MDD(filler));
    assert.ok(out.length <= MDD_DELIVERABLE_BUDGET);
    assert.ok(out.includes("Caso de uso"));
    assert.ok(out.includes("MFA TOTP"));
    assert.ok(!out.includes(filler.slice(0, 200)));
  });
});
