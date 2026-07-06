import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureCredentialStorageInSection6,
  isCredentialStorageSatisfied,
} from "./mdd-credential-storage.util.js";

describe("mdd-credential-storage.util", () => {
  it("isCredentialStorageSatisfied con variables de entorno + almacén en §6", () => {
    const md = `
## 1. Contexto
Autenticación con credenciales.

## 6. Seguridad
Las variables de entorno apuntan al almacén de secretos en producción.
`.trim();
    assert.equal(isCredentialStorageSatisfied(md), true);
  });

  it("ensureCredentialStorageInSection6 añade bloque cuando §6 solo menciona JWT", () => {
    const md = `
## 1. Contexto
Autenticación con credenciales.

## 6. Seguridad
JWT y RBAC documentados en detalle para el MVP del sistema.
`.trim();
    const out = ensureCredentialStorageInSection6(md);
    assert.match(out, /secrets manager|almac[eé]n de credenciales/i);
  });
});
