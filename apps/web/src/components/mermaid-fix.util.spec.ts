import { describe, expect, it } from "vitest";
import {
  assessMermaidFixStrategy,
  repairMermaidBlockForRender,
} from "./mermaid-fix.util";

const BROKEN_LICENSE_FLOW = `sequenceDiagram
    par ticipant User as Cliente
    par ticipant Web as Portal Web
    par ticipant Stripe as Stripe/Payment
    par ticipant DB as Portal DB
    par ticipant Core as The Forge Core
    par ticipant Plugin as Plugin Comercial
  end
  end
  end
  end
  end
  end
User->>Web: Selecciona tier
    Web->>Stripe: Crear Checkout Session
    Stripe-->>User: Redirect a pago
    User->>Stripe: Completa pago
    Stripe-->>Web: Webhook payment_intent.succeeded
    Web->>DB: Crear License (status: active)
    DB-->>Web: License creada + API Key
    Web->>User: Mostrar API Key + instrucciones
    User->>Core: Configura PLUGIN_LICENSE_KEY en .env
    Core->>Plugin: onPluginInit()
    Plugin->>Web: POST /licenses/validate
    Web->>DB: Validar API Key + tier + fechas`;

describe("assessMermaidFixStrategy", () => {
  it("marca regenerar cuando hay par ticipant, ends huérfanos y flujo truncado", () => {
    const assessment = assessMermaidFixStrategy(BROKEN_LICENSE_FLOW);
    expect(assessment.strategy).toBe("regenerate");
    expect(assessment.reasons).toContain("participant_keyword_split");
    expect(assessment.reasons).toContain("orphan_end_lines");
  });
});

describe("repairMermaidBlockForRender", () => {
  it("corrige par ticipant y elimina end huérfanos localmente", () => {
    const out = repairMermaidBlockForRender(BROKEN_LICENSE_FLOW);
    expect(out).toMatch(/participant User as Cliente/i);
    expect(out).not.toMatch(/par ticipant/i);
    expect(out.match(/^\s*end\s*$/gim) ?? []).toHaveLength(0);
  });
});
