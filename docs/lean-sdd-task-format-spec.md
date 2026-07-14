# Lean SDD: Especificación del Formato de Tasks Ejecutable

> **Versión:** 2.0  
> **Fecha:** 2026-07-14  
> **Rama:** `lean-sdd`  
> **Estado:** DRAFT  
> **Audiencia:** Agentes de código (Cursor, Claude, OpenHands, etc.)

---

## 1. Propósito

Este documento define el **formato exacto** que debe tener cada tarea en `tasks.md` para que un agente de código pueda:

1. Entender QUÉ hacer sin ambigüedad
2. Saber EN QUÉ ARCHIVO hacerlo
3. Conocer el CÓDIGO ESPERADO o la estructura objetivo
4. Verificar que lo hizo correctamente
5. Inferir automáticamente tareas relacionadas (CRUD, tests, frontend)

**Meta:** Producir el 85-90% del código sin intervención humana.

---

## 2. Estructura General del Archivo tasks.md

```markdown
# Tasks

## Metadata
```yaml
version: "2.0"
project: "Nombre del Proyecto"
stage: "Etapa 1"
mdd_hash: "abc123..."
generated_at: "2026-07-14T10:00:00Z"
auto_rules:
  - crud-auto
  - soft-delete
  - pagination-default
  - rbac-auto
  - zod-auto
```

## User Story: US-001 — Gestión de Usuarios
**Checkpoint:** Los usuarios pueden registrarse, loguearse y gestionar su perfil

### Backend

---
id: T-001
title: "Crear modelo Prisma User"
change_type: create
target_files:
  - packages/database/schema.prisma
language: prisma
dependencies: []
parallel: true
estimated_minutes: 5
mdd_ref: "§3 User"
story_ref: US-001
entity: User
operations: [create]
---

#### Descripción

Crear el modelo `User` en el schema de Prisma con los campos y relaciones definidos en el MDD §3.

#### Código Esperado

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  role      String   @default("user")
  password  String   // hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  projects  Project[]
  sessions  Session[]

  @@map("users")
}
```

#### Reglas de Inferencia

- [crud-auto] Este modelo requiere CRUD completo. Ver T-002 a T-007.
- [soft-delete] El campo `deletedAt` indica soft-delete. No uses `@deletedAt` de Prisma; usa query manual.
- [auditable] Los campos `createdAt` y `updatedAt` se manejan automáticamente.

#### Verificación

```bash
cd packages/database && npx prisma validate
```

**Output esperado:** "The schema is valid"

---
[id: T-002]
[title: "Generar migración para User"]
... (más tareas)

### Frontend

---
[id: T-008]
[title: "Crear página de login"]
... (más tareas)
```

---

## 3. Front-matter de Tarea (YAML)

Cada tarea DEBE comenzar con un separador `---` seguido de YAML front-matter.

### 3.1 Campos obligatorios

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | string | `T-001` | Identificador único. Formato: `T-` + número de 3 dígitos |
| `title` | string | `"Crear modelo Prisma User"` | Título breve y accionable (máx 80 caracteres) |
| `change_type` | enum | `create` | Ver sección 4 |
| `target_files` | string[] | `["src/users/users.controller.ts"]` | Archivos a modificar/crear |

### 3.2 Campos recomendados (alto impacto en precisión)

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `language` | string | `typescript` | Lenguaje del código objetivo |
| `dependencies` | string[] | `["T-001", "T-003"]` | IDs de tareas bloqueantes |
| `parallel` | boolean | `true` | Si puede ejecutarse en paralelo |
| `estimated_minutes` | number | `15` | Estimación de tiempo |
| `mdd_ref` | string | `"§3 User"` | Referencia al MDD |
| `story_ref` | string | `"US-001"` | Referencia a User Story |
| `entity` | string | `"User"` | Entidad del dominio |
| `operations` | string[] | `["create", "list"]` | Operaciones CRUD |
| `insert_after` | string | `"// TODO: add email field"` | Contexto de inserción |
| `lines` | object | `{start: 45, end: 60}` | Rango de líneas (para modify/replace) |

### 3.3 Campos de verificación (requeridos para 90%+ precisión)

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `test_command` | string | `"npm test -- users.controller"` | Comando para verificar |
| `test_expected` | string | `"PASS src/users/users.controller.spec.ts"` | String esperado en output |
| `build_command` | string | `"npm run build"` | Comando de build |
| `lint_command` | string | `"npm run lint"` | Comando de lint |

---

## 4. Tipos de change_type

### 4.1 Catálogo completo

| Tipo | Cuándo usar | Ejemplo |
|------|-------------|---------|
| `create` | Archivo nuevo | `users.controller.ts` |
| `modify` | Cambiar archivo existente | Agregar campo a DTO existente |
| `delete` | Eliminar archivo | Borrar componente obsoleto |
| `append` | Añadir al final | Nueva ruta en array de rutas |
| `insert` | Insertar en posición | Campo después de línea N |
| `replace` | Reemplazar bloque | Refactorizar función completa |
| `run` | Ejecutar comando | `prisma migrate dev` |
| `configure` | Cambiar config | `tsconfig.json`, `.env` |
| `generate` | Generar desde template | `prisma generate`, `openapi-generator` |
| `install` | Instalar dependencia | `npm install zod` |
| `rename` | Renombrar archivo/mueve | `git mv old.ts new.ts` |
| `merge` | Fusionar cambios | Resolución de conflictos |

### 4.2 Semántica por tipo

#### `create`

El agente debe:
1. Verificar que el archivo NO existe
2. Crear directorios intermedios si no existen
3. Escribir el contenido completo del archivo
4. Añadir al sistema de control de versiones

```yaml
change_type: create
target_files: ["src/users/users.controller.ts"]
```

#### `modify`

El agente debe:
1. Leer el archivo existente
2. Aplicar cambios según el bloque de código esperado
3. Preservar el resto del archivo intacto

```yaml
change_type: modify
target_files: ["src/users/dto/create-user.dto.ts"]
lines: { start: 12, end: 18 }  # líneas a reemplazar
```

#### `insert`

El agente debe:
1. Buscar el ancla (`insert_after`) en el archivo
2. Insertar el bloque después de la ancla
3. Mantener indentación consistente

```yaml
change_type: insert
target_files: ["packages/database/schema.prisma"]
insert_after: "model Project {"
```

#### `run`

El agente debe:
1. Ejecutar el comando en el directorio correcto
2. Verificar que el output contiene `test_expected`
3. Si falla, reportar error y NO continuar con tareas dependientes

```yaml
change_type: run
test_command: "npx prisma migrate dev --name add_user"
test_expected: "Your database is now in sync"
```

---

## 5. Bloques Especiales en el Cuerpo

### 5.1 `#### Código Esperado`

Contiene el código que el agente debe producir.

**Para `create`:** Código completo del archivo.
**Para `modify`:** Solo el bloque modificado (el agente debe fusionar).
**Para `insert`:** Bloque a insertar.
**Para `replace`:** Bloque nuevo completo.

```markdown
#### Código Esperado

```typescript
// Para CREATE: archivo completo
import { Controller, Get, Post } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```
```

### 5.2 `#### Diff Esperado`

Alternativa al Código Esperado para cambios precisos:

```markdown
#### Diff Esperado

```diff
  export class CreateUserDto {
    @IsEmail()
    email: string;
+
+   @IsString()
+   @MinLength(2)
+   name: string;
  }
```
```

### 5.3 `#### Reglas de Inferencia`

Señales de control para el agente. Cada regla es una instrucción condicional:

```markdown
#### Reglas de Inferencia

- [crud-auto] Esta entidad requiere CRUD completo. Si faltan tareas de controller/service/tests, generarlas.
- [soft-delete] El DELETE usa `UPDATE ... SET deletedAt = NOW()` no `DELETE FROM`.
- [pagination-default] LIST usa cursor pagination con pageSize=20.
- [search-auto] Añadir búsqueda por email y name en el endpoint LIST.
- [rbac-auto] POST/PATCH/DELETE requieren `role === 'admin'`. GET permite `self`.
- [zod-auto] Validar email con `z.string().email()`. Validar name con `z.string().min(2)`.
- [frontend-auto] Crear DataTable con sorting, filtering y pagination.
```

### 5.4 `#### Contexto de Tipos`

Define los tipos TypeScript/Zod relevantes para la tarea:

```markdown
#### Contexto de Tipos

```json
{
  "CreateUserDto": {
    "email": "string (email, unique)",
    "name": "string (min 2, max 100)",
    "role": "UserRole = 'user' | 'admin' | 'moderator'",
    "password": "string (min 8, max 100)"
  },
  "UserResponse": {
    "id": "UUID",
    "email": "string",
    "name": "string | null",
    "role": "UserRole",
    "createdAt": "ISO 8601 datetime"
  },
  "UpdateUserDto": "Partial<CreateUserDto> & { id: UUID }"
}
```
```

### 5.5 `#### Verificación`

Define cómo el agente sabe que la tarea está completa:

```markdown
#### Verificación

**Comando:**
```bash
npm test -- users.service.spec.ts
```

**Output esperado (incluye al menos):**
```
PASS  src/users/users.service.spec.ts
  UsersService
    ✓ should create a user (45ms)
    ✓ should find all users (32ms)
    ✓ should find one user (28ms)
    ✓ should update a user (35ms)
    ✓ should soft delete a user (30ms)
```

**Criterios adicionales:**
- [ ] El archivo `users.service.ts` compila sin errores de TypeScript
- [ ] `npm run lint` no reporta errores en el archivo
- [ ] El endpoint POST /api/users responde con 201 y body de tipo UserResponse
```

### 5.6 `#### Dependencias Resueltas`

Indica qué tareas previas proveen contexto necesario:

```markdown
#### Dependencias Resueltas

- **T-001** (modelo Prisma): Define los campos `id`, `email`, `name`, `role`, `createdAt`, `updatedAt`, `deletedAt`
- **T-003** (CreateUserDto): Define el schema Zod de creación
- **T-004** (UsersService): Define los métodos `create`, `findAll`, `findOne`, `update`, `remove`
```

---

## 6. Patrones de Task por Capa

### 6.1 Backend (NestJS + Prisma)

#### Patrón: CRUD completo de entidad

Para cada entidad con `operations: [create, read, update, delete, list]`:

```
T-NN0: Modelo Prisma
T-NN1: DTO Create (Zod)
T-NN2: DTO Update (Zod, partial)
T-NN3: DTO Response (serialización)
T-NN4: Interface/Type TypeScript
T-NN5: Service (business logic)
T-NN6: Controller (REST endpoints)
T-NN7: Módulo NestJS
T-NN8: Tests unitarios (Service)
T-NN9: Tests e2e (Controller)
```

Ejemplo de tarea de Service:

```markdown
---
id: T-005
title: "Implementar UsersService"
change_type: create
target_files:
  - src/users/users.service.ts
  - src/users/users.service.spec.ts
language: typescript
dependencies: ["T-001", "T-002", "T-003"]
parallel: false
entity: User
operations: [create, read, update, delete, list]
---

#### Descripción

Implementar el service de usuarios con todos los métodos CRUD, incluyendo soft-delete y paginación.

#### Código Esperado

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: { ...dto, password: await hash(dto.password, 10) },
    });
  }

  async findAll(cursor?: string, limit = 20) {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // verify exists and not deleted
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

#### Reglas de Inferencia

- [soft-delete] `remove()` usa `update({ deletedAt: new Date() })`, NO `delete()`.
- [pagination-default] `findAll()` usa cursor pagination: `take: limit + 1` para detectar hasMore.
- [rbac-auto] Este service es llamado por controller con guard de autenticación.
```

### 6.2 Frontend (React + Vite + Tailwind)

#### Patrón: Página de lista con DataTable

```markdown
---
id: T-015
title: "Crear página de lista de usuarios"
change_type: create
target_files:
  - apps/web/src/pages/admin/UsersPage.tsx
  - apps/web/src/hooks/useUsers.ts
language: typescript
dependencies: ["T-006", "T-009"]
parallel: true
entity: User
operations: [list]
---

#### Descripción

Crear la página `/admin/users` con una DataTable que muestre usuarios con paginación, búsqueda y filtros.

#### Código Esperado

```typescript
// apps/web/src/hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useUsers(cursor?: string, search?: string) {
  return useQuery({
    queryKey: ['users', cursor, search],
    queryFn: () => api.get('/users', { params: { cursor, q: search } }).then(r => r.data),
  });
}

// apps/web/src/pages/admin/UsersPage.tsx
import { useState } from 'react';
import { useUsers } from '../../hooks/useUsers';
import { DataTable } from '../../components/DataTable';
import { SearchInput } from '../../components/SearchInput';
import { Pagination } from '../../components/Pagination';

export default function UsersPage() {
  const [cursor, setCursor] = useState<string>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useUsers(cursor, search);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Usuarios</h1>
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por email o nombre..." />
      <DataTable
        columns={[
          { key: 'email', label: 'Email', sortable: true },
          { key: 'name', label: 'Nombre', sortable: true },
          { key: 'role', label: 'Rol' },
          { key: 'createdAt', label: 'Fecha', sortable: true },
        ]}
        data={data?.items}
        loading={isLoading}
      />
      <Pagination
        hasMore={data?.hasMore}
        onNext={() => setCursor(data?.nextCursor)}
        onPrev={() => setCursor(undefined)}
      />
    </div>
  );
}
```

#### Reglas de Inferencia

- [frontend-auto] Usar React Query para data fetching.
- [search-auto] Debounce de 300ms en el search.
- [pagination-default] Cursor pagination con `cursor` y `hasMore`.
- [crud-auto] Incluir botón "Nuevo" que navega a `/admin/users/new`.
```

### 6.3 Base de datos (Prisma)

#### Patrón: Migración + Seed

```markdown
---
id: T-002
title: "Generar migración y seed para User"
change_type: run
target_files:
  - packages/database/prisma/migrations/
dependencies: ["T-001"]
parallel: false
entity: User
operations: [create]
---

#### Descripción

Generar la migración de Prisma y crear seed data de usuarios de prueba.

#### Comandos

```bash
# Generar migración
cd packages/database && npx prisma migrate dev --name add_user_model

# Generar seed
cd packages/database && npx prisma db seed
```

#### Seed Esperado

```typescript
// packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      password: 'hashed_password_here',
    },
  });
}

main();
```

#### Verificación

```bash
npx prisma migrate status
```

**Output esperado:** "Database schema is up to date"
```

---

## 7. Jerarquía de Dependencias

### 7.1 Reglas de ordenamiento

```
Nivel 0 (sin dependencias):
  - Modelos de base de datos
  - Configuración (tsconfig, eslint, etc.)
  - Instalación de dependencias

Nivel 1 (depende de nivel 0):
  - DTOs y Zod schemas (necesitan tipos del modelo)
  - Servicios (necesitan Prisma client)
  - Tipos TypeScript compartidos

Nivel 2 (depende de nivel 1):
  - Controllers (necesitan servicios)
  - Tests unitarios (necesitan servicios)

Nivel 3 (depende de nivel 2):
  - Tests e2e (necesitan controllers)
  - Hooks de frontend (necesitan API)

Nivel 4 (depende de nivel 3):
  - Páginas de frontend (necesitan hooks)
  - Componentes (necesitan tipos)

Nivel 5:
  - Integración y QA
```

### 7.2 Ejemplo de grapho

```yaml
tasks:
  T-001: []                    # Modelo Prisma
  T-002: [T-001]              # Migración
  T-003: [T-001]              # DTO Create
  T-004: [T-001]              # DTO Update
  T-005: [T-003, T-004]      # Service
  T-006: [T-005]              # Controller
  T-007: [T-006]              # Tests e2e
  T-008: [T-006]              # Hook useUsers
  T-009: [T-008]              # Página Users
```

---

## 8. Metadatos Globales (Auto-rules)

Al inicio del documento tasks.md, un bloque YAML define reglas globales que aplican a TODAS las tareas:

```yaml
auto_rules:
  - crud-auto          # Inferir CRUD completo por entidad
  - soft-delete        # Usar deletedAt en lugar de DELETE físico
  - pagination-default # Cursor pagination con pageSize=20
  - rbac-auto          # Verificar roles en endpoints mutantes
  - zod-auto           # Validar con Zod, no class-validator
  - audit-auto         # Añadir createdAt/updatedAt automáticamente
  - search-auto        # Búsqueda fulltext en campos marcados
  - frontend-auto      # Crear páginas frontend por entidad
  - react-query        # Usar TanStack Query para data fetching
  - react-hook-form    # Usar react-hook-form + zodResolver para formularios
```

### 8.1 Reglas disponibles

| Regla | Descripción | Impacto |
|-------|-------------|---------|
| `crud-auto` | Por cada entidad, generar las 12 tareas estándar de CRUD | +40% cobertura automática |
| `soft-delete` | DELETE lógico via deletedAt | Evita errores de integridad |
| `pagination-default` | Cursor pagination en todos los LIST | Rendimiento escalable |
| `rbac-auto` | Verificación de roles en POST/PATCH/DELETE | Seguridad |
| `zod-auto` | Validación con Zod schemas | Type safety |
| `audit-auto` | Campos createdAt/updatedBy automáticos | Traza de cambios |
| `search-auto` | Búsqueda fulltext en endpoints LIST | UX de búsqueda |
| `frontend-auto` | Páginas admin automáticas por entidad | +30% cobertura frontend |
| `react-query` | Hooks con TanStack Query | Patrón consistente |
| `react-hook-form` | Formularios con RHF + Zod | Validación robusta |
| `nest-swagger` | Documentación OpenAPI automática | API documented |
| `jest-auto` | Tests automáticos por función pública | Cobertura de tests |

---

## 9. Verificación Automática

### 9.1 Por tarea

Cada tarea DEBE incluir al menos UNO de:

- `test_command` + `test_expected`
- `build_command` con verificación de éxito
- `lint_command` sin errores
- Criterios manuales checklist (para tareas de UI)

### 9.2 Checklist de calidad por tarea

El agente debe auto-verificar antes de marcar como completa:

- [ ] El archivo existe (para create) o fue modificado (para modify)
- [ ] TypeScript compila sin errores (`npm run typecheck`)
- [ ] Linting pasa (`npm run lint`)
- [ ] Tests pasan (`npm test -- [archivo]`)
- [ ] El output coincide con `test_expected`
- [ ] Las dependencias están resueltas (archivos referenciados existen)

### 9.3 Verificación global post-tasks

Al completar todas las tareas de un checkpoint:

```bash
# Build completo
npm run build

# Tests completos
npm test

# Lint completo
npm run lint

# Type check
npm run typecheck

# Verificar endpoints
npm run test:e2e
```

---

## 10. Ejemplo Completo: Proyecto "User Management"

### 10.1 MDD §3 (extracto)

```markdown
## 3. Modelo de Datos

### User
Tabla principal de usuarios del sistema.

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | UUID | PK | Identificador único |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Correo electrónico |
| name | VARCHAR(100) | | Nombre completo |
| role | VARCHAR(20) | DEFAULT 'user' | user, admin, moderator |
| password | VARCHAR(255) | NOT NULL | Contraseña hasheada |
| createdAt | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |
| updatedAt | TIMESTAMPTZ | DEFAULT now() | Fecha de actualización |
| deletedAt | TIMESTAMPTZ | | Soft delete |

Operaciones: CRUD completo + búsqueda por email/nombre + paginación.
```

### 10.2 types.json (derivado)

```json
{
  "version": "1.0",
  "entities": [
    {
      "name": "User",
      "table": "users",
      "fields": [...],
      "flags": ["crud", "soft_delete", "searchable", "auditable"]
    }
  ]
}
```

### 10.3 operations.json (derivado)

```json
{
  "version": "1.0",
  "operations": [
    {
      "entity": "User",
      "type": "crud",
      "routes": [
        { "method": "POST", "path": "/api/users", "action": "create", "auth": ["admin"] },
        { "method": "GET", "path": "/api/users", "action": "list", "auth": ["admin"], "pagination": "cursor" },
        { "method": "GET", "path": "/api/users/:id", "action": "read", "auth": ["admin", "self"] },
        { "method": "PATCH", "path": "/api/users/:id", "action": "update", "auth": ["admin", "self"] },
        { "method": "DELETE", "path": "/api/users/:id", "action": "delete", "auth": ["admin"], "softDelete": true },
        { "method": "POST", "path": "/api/users/:id/restore", "action": "restore", "auth": ["admin"] }
      ]
    }
  ]
}
```

### 10.4 tasks.md (generado automáticamente)

```markdown
# Tasks

## Metadata
```yaml
version: "2.0"
project: "User Management"
stage: "Etapa 1"
auto_rules: [crud-auto, soft-delete, pagination-default, rbac-auto, zod-auto, frontend-auto]
```

## User Story: US-001 — Gestión de Usuarios
**Checkpoint:** CRUD de usuarios funcional con soft-delete y paginación

### Backend

---
id: T-001
title: "Crear modelo Prisma User"
change_type: create
target_files: [packages/database/schema.prisma]
language: prisma
dependencies: []
parallel: true
entity: User
operations: [create]
test_command: "cd packages/database && npx prisma validate"
test_expected: "The schema is valid"
---

#### Código Esperado

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  role      String   @default("user")
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@map("users")
}
```

---
id: T-002
title: "Generar migración User"
change_type: run
target_files: [packages/database/prisma/migrations/]
dependencies: [T-001]
parallel: false
test_command: "cd packages/database && npx prisma migrate status"
test_expected: "Database schema is up to date"
---

#### Comandos

```bash
cd packages/database && npx prisma migrate dev --name add_user
```

---
id: T-003
title: "Crear DTOs Zod para User"
change_type: create
target_files:
  - src/users/dto/create-user.dto.ts
  - src/users/dto/update-user.dto.ts
  - src/users/dto/user-response.dto.ts
language: typescript
dependencies: [T-001]
parallel: true
entity: User
operations: [create, update, read]
---

#### Código Esperado

```typescript
// create-user.dto.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  password: z.string().min(8).max(100),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// update-user.dto.ts
export const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

// user-response.dto.ts
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.string().datetime(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
```

#### Reglas de Inferencia

- [zod-auto] Usar Zod, NO class-validator.
- [crud-auto] UpdateUserDto es Partial de CreateUserDto + id requerido.

---

... (más tareas T-004 a T-012)

### Frontend

---
id: T-013
title: "Crear hook useUsers con TanStack Query"
change_type: create
target_files: [apps/web/src/hooks/useUsers.ts]
language: typescript
dependencies: [T-006]  # Controller
parallel: true
entity: User
operations: [list, read]
---

#### Código Esperado

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateUserDto, UpdateUserDto } from '../types/user';

export function useUsers(cursor?: string, search?: string) {
  return useQuery({
    queryKey: ['users', cursor, search],
    queryFn: () => api.get('/users', { params: { cursor, q: search } }).then(r => r.data),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserDto) => api.post('/users', dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => 
      api.patch(`/users/${id}`, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

---

... (más tareas T-014 a T-016)
```

---

## 11. Parser Reference

### 11.1 tasks.md → tasks.json

```typescript
interface ParsedTask {
  id: string;
  title: string;
  change_type: ChangeType;
  target_files: string[];
  language?: string;
  dependencies: string[];
  parallel: boolean;
  estimated_minutes?: number;
  mdd_ref?: string;
  story_ref?: string;
  entity?: string;
  operations?: string[];
  insert_after?: string;
  lines?: { start: number; end: number };
  test_command?: string;
  test_expected?: string;
  build_command?: string;
  lint_command?: string;
  description: string;
  code_expected?: string;
  diff_expected?: string;
  inference_rules: string[];
  type_context?: Record<string, unknown>;
  verification: {
    command?: string;
    expected_output?: string;
    checklist?: string[];
  };
  dependencies_resolved?: Array<{
    task_id: string;
    task_title: string;
    provides: string[];
  }>;
  section: string;  // "Backend", "Frontend", etc.
  checkpoint: string;
  raw_markdown: string;
}
```

### 11.2 Funciones del parser

```typescript
// packages/shared-types/src/tasks-parse-v2.ts

export function parseTasksV2(markdown: string): ParsedTask[];
export function tasksToJson(tasks: ParsedTask[]): string;
export function validateTasks(tasks: ParsedTask[]): TaskValidationResult;
export function getDependencyGraph(tasks: ParsedTask[]): DependencyGraph;
export function getExecutionOrder(tasks: ParsedTask[]): string[]; // IDs ordenados topológicamente
export function getNextRunnableTask(tasks: ParsedTask[], completed: string[]): ParsedTask | null;
export function detectCircularDependencies(tasks: ParsedTask[]): string[][];
```

---

## 12. Migración desde Formato Antiguo

### 12.1 Reglas de conversión

| Formato antiguo | Formato nuevo |
|-----------------|---------------|
| `- [ ] Crear modelo User` | `- [ ] T-001: Crear modelo Prisma User` + front-matter |
| `**Archivo:** src/...` | `target_files: ["src/..."]` en front-matter |
| `[P]` | `parallel: true` en front-matter |
| `**Checkpoint**: smoke login` | Sección `##` con `**Checkpoint**: ...` |
| `MDD: §3 User` | `mdd_ref: "§3 User"` en front-matter |
| Texto libre | YAML front-matter estructurado + cuerpo markdown |

### 12.2 Script de migración

```bash
# Conversión automática de tasks.md antiguo a formato v2
npx ts-node scripts/migrate-tasks-to-v2.ts \
  --input tasks.md \
  --output tasks-v2.md \
  --types types.json \
  --operations operations.json
```

El script:
1. Parsea tasks antiguos con regex
2. Detecta entidades y operaciones
3. Genera front-matter YAML
4. Añade bloques de código esperado desde types.json
5. Genera reglas de inferencia desde operations.json

---

> **Fin del documento.** Para ejemplos adicionales ver `docs/lean-sdd-task-examples.md`.
