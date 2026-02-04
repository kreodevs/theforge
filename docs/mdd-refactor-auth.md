# Master Design Document

## 1. Contexto y alcance

Sistema de autenticación y sesiones con MFA (TOTP), refresh tokens revocables, JWKS público y despliegue en Dokploy. Backend NestJS, PostgreSQL, Argon2 para hashing de contraseñas.

---

## 2. Modelo de datos

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

- **password_hash:** Algoritmo **Argon2** (id o argon2id). Nunca almacenar contraseña en claro.
- **mfa_secret:** Secret TOTP v32 (base32), opcional; si está presente el usuario tiene MFA habilitado.

---

## 3. Contratos de API

### POST /api/auth/login

Autenticación con email y contraseña. Si el usuario tiene MFA, responde 202 con `requiresMfa: true` y se completa con POST /api/auth/mfa/verify.

**Request body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200:**

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 900
}
```

**Response 202 (MFA pendiente):**

```json
{
  "requiresMfa": true,
  "tempToken": "string"
}
```

### POST /api/auth/refresh

Canje de refresh token por nuevo access token. Invalida el refresh token usado (rotación).

**Request body:**

```json
{
  "refreshToken": "string"
}
```

**Response 200:**

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 900
}
```

### POST /api/auth/logout

Revocación de sesión: marcar el refresh token asociado como revocado.

**Request body:** (opcional) `{ "refreshToken": "string" }` para revocar uno concreto; si no se envía, revocar todos los del usuario autenticado.

**Response 204:** No content.

### GET /.well-known/jwks.json

Endpoint público (sin autenticación) que expone las claves públicas JWK para validación de JWT por terceros.

**Response 200:**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "string",
      "n": "string",
      "e": "AQAB"
    }
  ]
}
```

- **Contrato:** Siempre un objeto con clave `keys` (array de JWK). Incluir al menos la clave activa usada para firmar los access tokens.

---

## Seguridad

- **Contraseñas:** Argon2 (argon2id) para `password_hash`. Nunca almacenar en claro ni loguear.
- **MFA:** TOTP con secretos base32 (32 caracteres). Opción futura: WebAuthn (biométricos/llave de seguridad).
- **Sesiones:** Access token JWT (corto, ej. 15 min); refresh token opaco almacenado hasheado en `refresh_tokens`. Revocación vía `revoked_at` o eliminación de fila.
- **JWKS:** Endpoint `GET /.well-known/jwks.json` público; solo claves públicas. Rotación de claves documentada en runbook.

---

## Integración

### Infraestructura (Dokploy)

- **Despliegue:** Dokploy (sin Jenkins ni Kubernetes). Configuración específica:
  - Servicio API: imagen Docker construida con el Dockerfile multi-stage (ver abajo).
  - Variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `ARGON2_*`, etc.
  - Health check: `GET /health` cada 30s.
- **Dockerfile multi-stage (NestJS):**
  - Stage 1 (`builder`): Node 20 Alpine, `pnpm install --frozen-lockfile`, `pnpm build` del workspace (solo `apps/api` y dependencias).
  - Stage 2 (`runner`): Node 20 Alpine, solo `node_modules` de producción y `dist/`. Usuario no root. `CMD ["node", "dist/apps/api/main.js"]`.
  - Optimizaciones: `.dockerignore` con `node_modules`, `.git`, tests; capas cacheadas para dependencias.

### Circuit Breaker

- **Timeout:** 2 segundos por llamada a dependencia externa (ej. servicio de correo, proveedor MFA).
- **Reintentos:** 3 intentos con backoff exponencial (ej. 200ms, 400ms, 800ms) antes de abrir el circuito.
- **Estado:** Abierto tras N fallos consecutivos; medio abierto tras ventana de prueba (ej. 30s). Incluir en diagrama de integración (Mermaid) si se documenta flujo.

---

## Estimación

- **Entidades:** users, refresh_tokens (y tablas auxiliares si se añaden).
- **Endpoints:** login, refresh, logout, jwks, health, MFA verify (según conteo del parser).
- **Complejidad:** Argon2, MFA, JWKS, refresh revocable, Dokploy, Dockerfile multi-stage, Circuit Breaker.
- **Objetivo:** totalHours tal que costo interno (totalHours × $185 MXN/hr × riskFactor 1.0) se acerque a **$28,875 MXN** → aproximadamente **156 h** (156 × 185 = 28,860). Asegurar que el MDD incluye suficientes entidades y endpoints para que el Estimador refleje esta complejidad en totalHours.
