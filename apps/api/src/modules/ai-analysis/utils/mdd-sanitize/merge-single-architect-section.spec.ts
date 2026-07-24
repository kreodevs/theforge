import { describe, expect, it } from "vitest";
import { mergeSingleArchitectSectionIntoDraft } from "./section-merge.js";

const BASELINE = `# Master Design Document

## 1. Contexto
Baseline contexto único ALPHA.

## 2. Arquitectura y Stack
${"Baseline stack NestJS PostgreSQL. ".repeat(10)}

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE baseline_tenants (id UUID PRIMARY KEY);
\`\`\`
${"Más modelo baseline. ".repeat(20)}

## 4. Contratos de API
| Método | Ruta |
| GET | /api/v1/baseline-only |
${"Más contratos baseline. ".repeat(20)}

## 5. Lógica y Edge Cases
${"Baseline lógica edge cases. ".repeat(20)}

## 6. Seguridad
${"Baseline seguridad Argon2. ".repeat(20)}

## 7. Infraestructura
${"Baseline infra Docker. ".repeat(20)}
`;

const ARCHITECT = `# Master Design Document

## 1. Contexto
Architect overwrote context — BAD.

## 2. Arquitectura y Stack
${"Architect NEW stack Redis Kafka. ".repeat(10)}

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE architect_orders (id UUID PRIMARY KEY);
\`\`\`
${"Architect NEW modelo. ".repeat(20)}

## 4. Contratos de API
| Método | Ruta |
| POST | /api/v1/architect-only |
${"Architect NEW contratos. ".repeat(20)}

## 5. Lógica y Edge Cases
${"Architect NEW lógica. ".repeat(20)}

## 6. Seguridad
Architect wiped security — BAD.

## 7. Infraestructura
Architect wiped infra — BAD.
`;

describe("mergeSingleArchitectSectionIntoDraft", () => {
  it("§3: solo reemplaza modelo; preserva §2/§4/§5/§6/§7 del baseline", () => {
    const out = mergeSingleArchitectSectionIntoDraft(BASELINE, ARCHITECT, 3);
    expect(out).toContain("Baseline contexto único ALPHA");
    expect(out).toContain("Baseline stack NestJS PostgreSQL");
    expect(out).toContain("CREATE TABLE architect_orders");
    expect(out).not.toContain("CREATE TABLE baseline_tenants");
    expect(out).toContain("/api/v1/baseline-only");
    expect(out).not.toContain("/api/v1/architect-only");
    expect(out).toContain("Baseline lógica edge cases");
    expect(out).toContain("Baseline seguridad Argon2");
    expect(out).toContain("Baseline infra Docker");
  });

  it("§4: solo reemplaza contratos; preserva §2/§3 del baseline", () => {
    const out = mergeSingleArchitectSectionIntoDraft(BASELINE, ARCHITECT, 4);
    expect(out).toContain("Baseline stack NestJS PostgreSQL");
    expect(out).toContain("CREATE TABLE baseline_tenants");
    expect(out).toContain("/api/v1/architect-only");
    expect(out).not.toContain("/api/v1/baseline-only");
    expect(out).toContain("Baseline lógica edge cases");
  });

  it("§2: solo reemplaza arquitectura; preserva §3/§4 del baseline", () => {
    const out = mergeSingleArchitectSectionIntoDraft(BASELINE, ARCHITECT, 2);
    expect(out).toContain("Architect NEW stack Redis Kafka");
    expect(out).not.toContain("Baseline stack NestJS PostgreSQL");
    expect(out).toContain("CREATE TABLE baseline_tenants");
    expect(out).toContain("/api/v1/baseline-only");
  });

  it("si el cuerpo del architect es placeholder, conserva el baseline entero", () => {
    const badArchitect = BASELINE.replace(
      /## 3\. Modelo de Datos[\s\S]*?(?=\n## 4\.)/,
      "## 3. Modelo de Datos\n\n(Pendiente)\n\n",
    );
    const out = mergeSingleArchitectSectionIntoDraft(BASELINE, badArchitect, 3);
    expect(out).toContain("CREATE TABLE baseline_tenants");
  });

  it("§4: conserva baseline cuando merge quirúrgico trunca contratos sustanciales", () => {
    const richBody =
      "GET /api/v1/baseline-only-endpoint\n".repeat(50) +
      "\n```json\n{\"ok\":true}\n```\n";
    const richBaseline = BASELINE.replace(
      /## 4\. Contratos de API[\s\S]*?(?=\n## 5\.)/,
      `## 4. Contratos de API\n${richBody}`,
    );
    const thinArchitect = BASELINE.replace(
      /## 4\. Contratos de API[\s\S]*?(?=\n## 5\.)/,
      "## 4. Contratos de API\nGET /api/v1/journey\nPOST /api/v1/journey\n".repeat(8),
    );
    const out = mergeSingleArchitectSectionIntoDraft(richBaseline, thinArchitect, 4);
    expect(out).toContain("/api/v1/baseline-only-endpoint");
    expect(out).not.toContain("/api/v1/journey");
  });
});
