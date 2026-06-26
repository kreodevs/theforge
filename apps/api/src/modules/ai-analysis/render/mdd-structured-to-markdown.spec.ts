import { describe, it } from "node:test";
import assert from "node:assert";
import { mddStructuredToMarkdown } from "./mdd-structured-to-markdown.js";
import type { MddStructured } from "../state/mdd-structured.schema.js";

/** MDD de referencia (SSO) con modeloDatos, seguridad, integración. */
const referenceMdd: MddStructured = {
  title: "Master Design Document: SSO",
  contextoAlcance:
    "El sistema de Single Sign-On (SSO) proporciona autenticación centralizada. Alcance: MFA TOTP, JWT, sin OAuth.",
  modeloDatos: {
    sql: "CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(255) NOT NULL UNIQUE,\n  password_hash VARCHAR(255) NOT NULL\n);",
    diagramaEr: "erDiagram\n  users {\n    uuid id PK\n    string email\n    string password_hash\n  }",
    technicalMetadata: ["[high_security]"],
  },
  contratosApi: {
    summary: "| POST | /api/auth/login | Login |",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/login",
        description: "Authenticate user.",
        requestBody: '{"username":"user@example.com","password":"***"}',
        responses: { "200": '{"token":"..."}', "401": '{"error":"Invalid credentials"}' },
      },
    ],
  },
  arquitecturaFrontend: "React, Zustand, React Router. Login, Dashboard, ProtectedRoute.",
  seguridad: [
    { title: "Autenticación", content: ["MFA TOTP obligatorio.", "JWT para sesiones."] },
    { title: "Almacenamiento", content: ["Hash bcrypt/Argon2.", "Secretos TOTP en DB."] },
  ],
  integracion: {
    subsections: [
      { title: "Flujo de integración", content: "App detecta token inválido, redirige a login, SSO valida, redirige con token." },
      { title: "Nota/Pendiente", content: ["Definir orquestación con el usuario."] },
    ],
    manifest: { stack: [], pending: "Definir con el usuario: orquestación y despliegue" },
  },
};

describe("mddStructuredToMarkdown", () => {
  it("generates markdown with ## 1. Contexto (canónico SDD)", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("## 1. Contexto"), "debe contener sección 1 Contexto");
  });

  it("generates markdown with ## 3. Modelo de Datos", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("## 3. Modelo de Datos"), "debe contener sección 3");
  });

  it("generates markdown with ```sql block", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("```sql") && md.includes("CREATE TABLE"), "debe contener bloque sql");
  });

  it("generates markdown with ```mermaid block", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("```mermaid") && md.includes("erDiagram"), "debe contener bloque mermaid");
  });

  it("prefiere erDiagram derivado del SQL sobre diagramaEr del LLM", () => {
    const md = mddStructuredToMarkdown({
      ...referenceMdd,
      modeloDatos: {
        sql: "CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255));\nCREATE TABLE sessions (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id));",
        diagramaEr:
          "erDiagram\n  users { uuid id PK uuid default string email FK }\n  sessions ||--o{ users : \"wrong\"",
        technicalMetadata: ["[high_security]"],
      },
    });
    assert.doesNotMatch(md, /uuid default/i);
    assert.match(md, /users \|\|--o\{ sessions/);
  });

  it("generates markdown with metadata (high_security)", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("Metadata") && md.includes("high_security"), "debe contener metadata high_security");
  });

  it("generates markdown with ## 6. Seguridad", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("## 6. Seguridad"), "debe contener sección 6 Seguridad");
  });

  it("generates markdown with ## 7. Infraestructura (integración + manifest)", () => {
    const md = mddStructuredToMarkdown(referenceMdd);
    assert.ok(md.includes("## 7. Infraestructura"), "debe contener sección 7 Infraestructura");
    assert.ok(
      md.includes("Flujo de integración") || md.includes("Manifest"),
      "debe incluir subsecciones de integración o manifest",
    );
  });

  it("uses default title when mdd is empty", () => {
    const md = mddStructuredToMarkdown({});
    assert.ok(md.includes("Master Design Document"), "debe contener título por defecto");
  });

  it("uses (Pendiente) for missing sections", () => {
    const md = mddStructuredToMarkdown({ title: "Test" });
    assert.ok(md.includes("(Pendiente)"), "debe mostrar Pendiente en secciones vacías");
  });
});
