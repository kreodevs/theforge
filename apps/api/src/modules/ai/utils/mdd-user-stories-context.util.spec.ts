import { describe, it } from "node:test";
import assert from "node:assert";
import { buildMddContextForUserStories, USER_STORIES_MDD_BUDGET } from "./mdd-user-stories-context.util.js";

describe("buildMddContextForUserStories", () => {
  it("devuelve el MDD íntegro si cabe en el presupuesto", () => {
    const mdd = "## 1. Contexto\n\nCorto.";
    assert.equal(buildMddContextForUserStories(mdd), mdd);
  });

  it("prioriza checklist y §1/§4 cuando el MDD excede el presupuesto", () => {
    const filler = "x".repeat(USER_STORIES_MDD_BUDGET + 5000);
    const mdd = `## 1. Contexto y alcance

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

    const out = buildMddContextForUserStories(mdd);
    assert.ok(out.length <= USER_STORIES_MDD_BUDGET);
    assert.ok(out.includes("CHECKLIST DE COBERTURA OBLIGATORIA"));
    assert.ok(out.includes("Onboarding con IA"));
    assert.ok(out.includes("Facturación SaaS"));
    assert.ok(out.includes("MFA TOTP"));
    assert.ok(out.includes("/api/v1/auth/login"));
    assert.ok(!out.includes(filler.slice(0, 200)));
  });
});
