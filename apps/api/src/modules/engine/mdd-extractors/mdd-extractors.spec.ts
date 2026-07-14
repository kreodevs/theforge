/**
 * Tests para extractores MDD (types-extractor y operations-extractor).
 * Valida que el parsing de MDD §3 produzca types.json coherente.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { extractTypesFromMddSection3 } from "./types-extractor.js";
import { extractOperationsFromMdd } from "./operations-extractor.js";

const SAMPLE_MDD_SECTION3 = `
## 3. Modelo de Datos

### User
Usuarios de la plataforma.

| Campo | Tipo | Constraints | Descripción |
|---|---|---|---|
| id | uuid | PK | Identificador |
| email | varchar(255) | UNIQUE, NOT NULL | Correo |
| name | varchar(100) | | Nombre |
| role | varchar(20) | DEFAULT 'user' | user, admin, moderator |
| createdAt | timestamptz | DEFAULT now() | Creación |
| updatedAt | timestamptz | DEFAULT now() | Actualización |
| deletedAt | timestamptz | NULLABLE | Soft delete |

**Relaciones:** hasMany(Project), hasMany(Session)

### Project
Proyectos creados por usuarios.

| Campo | Tipo | Constraints | Descripción |
|---|---|---|---|
| id | uuid | PK | Identificador |
| name | varchar(255) | NOT NULL | Nombre del proyecto |
| userId | uuid | FK → users.id | Dueño |
| createdAt | timestamptz | DEFAULT now() | Creación |
`;

const SAMPLE_MDD_SECTION4 = `
## 4. Contratos de API

### User
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | /api/users | Crear | admin |
| GET | /api/users | Listar | admin |
| GET | /api/users/:id | Obtener | admin, self |
| PATCH | /api/users/:id | Actualizar | admin, self |
| DELETE | /api/users/:id | Eliminar (soft) | admin |
`;

describe("types-extractor", () => {
  it("extrae entidades desde tablas markdown", () => {
    const result = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);

    assert.strictEqual(result.version, "1.0");
    assert.strictEqual(result.entities.length, 2);

    const user = result.entities.find((e) => e.name === "User");
    assert.ok(user, "Debe extraer entidad User");
    assert.strictEqual(user.fields.length, 7);
    assert.ok(user.fields.some((f) => f.name === "email" && f.type === "EMAIL"));
    assert.ok(user.fields.some((f) => f.name === "deletedAt" && f.type === "TIMESTAMP_NULLABLE"));
    assert.ok(user.flags?.includes("soft_deletable"));
    assert.ok(user.flags?.includes("auditable"));
    assert.ok(user.flags?.includes("searchable")); // email + name
  });

  it("detecta relaciones desde texto y campos Id", () => {
    const result = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    const user = result.entities.find((e) => e.name === "User")!;
    const project = result.entities.find((e) => e.name === "Project")!;

    assert.ok(user.relations?.some((r) => r.target === "Project"));
    assert.ok(project.relations?.some((r) => r.target === "User" && r.field === "userId"));
  });

  it("genera Zod schemas correctos", () => {
    const result = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    const user = result.entities.find((e) => e.name === "User")!;
    const emailField = user.fields.find((f) => f.name === "email")!;

    assert.ok(emailField.zodSchema?.includes("email()"));
  });

  it("genera enums implícitos", () => {
    const result = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    assert.ok(result.enums.length > 0);
    assert.ok(result.enums.some((e) => e.name.includes("Role")));
  });
});

describe("operations-extractor", () => {
  it("deriva operations.json desde MDD §4", () => {
    const types = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    const ops = extractOperationsFromMdd(SAMPLE_MDD_SECTION3, SAMPLE_MDD_SECTION4, types);

    assert.strictEqual(ops.version, "1.0");
    assert.strictEqual(ops.operations.length, 2);

    const userOp = ops.operations.find((o) => o.entity === "User")!;
    assert.strictEqual(userOp.type, "crud");
    assert.strictEqual(userOp.routes.length, 5);
    assert.ok(userOp.routes.some((r) => r.method === "POST" && r.action === "create"));
    assert.ok(userOp.routes.some((r) => r.method === "DELETE" && r.softDelete));
    assert.ok(userOp.frontend?.admin);
  });

  it("infiere paginación por defecto", () => {
    const types = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    const ops = extractOperationsFromMdd(SAMPLE_MDD_SECTION3, SAMPLE_MDD_SECTION4, types);

    const listRoute = ops.operations[0].routes.find((r) => r.action === "list")!;
    assert.ok(listRoute.pagination);
    assert.strictEqual(listRoute.searchable?.length, 2); // email + name
  });

  it("respeta overrides de read-only", () => {
    const types = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    // Simular override
    types.entities[0].flags = ["read-only"];
    const ops = extractOperationsFromMdd(SAMPLE_MDD_SECTION3, SAMPLE_MDD_SECTION4, types);

    const userOp = ops.operations.find((o) => o.entity === "User")!;
    assert.strictEqual(userOp.type, "read-only");
    assert.ok(!userOp.routes.some((r) => r.method === "POST")); // Sin POST
  });
});

describe("integration types + operations", () => {
  it("types_json y operations_json son coherentes", () => {
    const types = extractTypesFromMddSection3(SAMPLE_MDD_SECTION3);
    const ops = extractOperationsFromMdd(SAMPLE_MDD_SECTION3, SAMPLE_MDD_SECTION4, types);

    for (const op of ops.operations) {
      const entity = types.entities.find((e) => e.name === op.entity);
      assert.ok(
        entity,
        `La entidad ${op.entity} en operations.json debe existir en types.json`,
      );

      if (op.overrides?.softDelete) {
        assert.ok(
          entity.fields.some((f) => f.name === "deletedAt"),
          `Entidad ${op.entity} declara softDelete pero no tiene campo deletedAt`,
        );
      }
    }
  });
});
