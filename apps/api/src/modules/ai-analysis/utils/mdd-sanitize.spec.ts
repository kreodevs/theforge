import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeSeguridadIntegracionRawJson } from "./mdd-sanitize.js";

describe("sanitizeSeguridadIntegracionRawJson", () => {
  it("descontamina sección Seguridad cuando viene como bullet list con líneas de JSON", () => {
    const contaminated = `
## Seguridad

### Seguridad

 - {
 - "title": "## Seguridad",
 - "content": [
 - {
 - "heading": "1. Autenticación y Autorización",
 - "details": [
 - "**Autenticación de Usuarios**: Se utiliza un sistema de autenticación basado en tokens.",
 - "**Autorización de Acceso**: Los roles y permisos se gestionan a través de la tabla roles."
 - ]
 - },
 - {
 - "heading": "2. Protección de Datos",
 - "details": [
 - "**Cifrado de Contraseñas**: Las contraseñas se almacenan como hashes.",
 - "**Borrados Lógicos**: Se utiliza el campo isActive."
 - ]
 - }
 - ],
 - "conclusion": "Estas medidas protegen el sistema."
 - }
`;

    const result = sanitizeSeguridadIntegracionRawJson(contaminated);

    assert.ok(result.includes("## Seguridad"), "debe conservar ## Seguridad");
    assert.ok(
      result.includes("### 1. Autenticación y Autorización") || result.includes("### Autenticación y Autorización"),
      "debe convertir heading a ###"
    );
    assert.ok(
      result.includes("Autenticación de Usuarios") && result.includes("tokens"),
      "debe incluir viñetas de details"
    );
    assert.ok(result.includes("### 2. Protección de Datos") || result.includes("### Protección de Datos"));
    assert.ok(result.includes("Cifrado de Contraseñas"));
    assert.ok(!result.includes('"title":'), "no debe dejar JSON crudo");
    assert.ok(!result.includes(' - {'), "no debe dejar viñetas con fragmentos JSON");
  });

  it("no modifica sección Seguridad que ya es markdown legible", () => {
    const clean = `
## Seguridad

### 1. Autenticación
- Tokens JWT.
- Argon2 para contraseñas.

### 2. Autorización
- RBAC por roles.
`;

    const result = sanitizeSeguridadIntegracionRawJson(clean);
    assert.strictEqual(result.trim(), clean.trim());
  });

  it("no modifica body que no parece bullet list as JSON", () => {
    const other = `
## Seguridad

(Pendiente de definir.)
`;
    const result = sanitizeSeguridadIntegracionRawJson(other);
    assert.ok(result.includes("(Pendiente de definir.)"));
  });
});
