# Lean SDD: Catálogo de Patrones de Inferencia Declarativa

> **Versión:** 2.0  
> **Fecha:** 2026-07-14  
> **Rama:** `lean-sdd`  
> **Estado:** DRAFT  
> **Audiencia:** Sistema de generación de tasks + Agentes implementadores

---

## 1. Propósito

Este documento define **las reglas de inferencia automática** que aplican cuando se generan tasks desde el MDD. Un agente que lee tasks.md + operations.json + types.json debe poder:

1. **Inferir tareas que NO están explícitamente escritas** en tasks.md (ej: si tasks.md dice "Crear modelo User" y operations.json tiene `operations: [crud]`, el agente DEBE saber que también necesita controller, service, DTOs, etc.)
2. **Inferir comportamiento de código** sin que el prompt lo especifique (ej: si un campo es `deletedAt`, el DELETE es soft-delete automáticamente)
3. **Inferir estructura de frontend** desde el modelo de datos (ej: si hay una entidad con 5 campos, el form debe tener 5 inputs)

**Meta:** Reducir la cantidad de tasks explícitas necesarias en un 60-70% mediante inferencia inteligente.

---

## 2. Filosofía de Inferencia

### 2.1 Principios

1. **Convención sobre configuración** — Si el MDD define X, asumir el comportamiento estándar de X a menos que se especifique lo contrario
2. **Seguridad por defecto** — Si hay duda, elegir la opción más segura (ej: soft-delete > hard-delete)
3. **Trazabilidad total** — Cada inferencia debe registrarse en `inferred_tasks` para auditoría
4. **Override explícito** — El usuario puede desactivar cualquier inferencia con flags en operations.json

### 2.2 Jerarquía de Fuentes de Verdad

```
1. MDD §3 (Modelo de Datos) — Fuente máxima
   └── Define entidades, campos, relaciones
       
2. operations.json — Derivado de MDD
   └── Define qué operaciones CRUD tiene cada entidad
       
3. types.json — Derivado de MDD
   └── Define tipos, validaciones, constraints
       
4. tasks.md — Generado desde 1+2+3
   └── Lista explícita de tareas
       
5. Reglas de Inferencia (este documento)
   └── Completan lo que falta en tasks.md
```

**Regla de oro:** Si hay conflicto entre sources, el número más bajo gana.

---

## 3. Patrones de Inferencia por Categoría

### 3.1 INF-001: CRUD Completo por Entidad

#### Trigger
```yaml
operations.json:
  entity: "X"
  operations: ["create", "read", "update", "delete", "list"]
```

#### Inferencia
Si tasks.md NO incluye tareas para TODOS estos componentes, el agente debe inferirlos:

```
Backend:
├── [ENTITY]-001: Modelo Prisma (si no existe)
├── [ENTITY]-002: DTO Create (Zod schema)
├── [ENTITY]-003: DTO Update (Zod schema, partial de Create)
├── [ENTITY]-004: DTO Response (serialización)
├── [ENTITY]-005: Interface TypeScript
├── [ENTITY]-006: Service (create, findOne, findAll, update, remove)
├── [ENTITY]-007: Controller (POST, GET /:id, GET, PATCH, DELETE)
├── [ENTITY]-008: Module NestJS
├── [ENTITY]-009: Tests unitarios Service
└── [ENTITY]-010: Tests e2e Controller

Frontend:
├── [ENTITY]-011: Hook useX (TanStack Query)
├── [ENTITY]-012: Página Lista (DataTable + search + pagination)
├── [ENTITY]-013: Página Detalle (tabs: view, edit, history)
├── [ENTITY]-014: Componente Form (react-hook-form + zod)
└── [ENTITY]-015: Componente Delete Confirmation

Shared:
└── [ENTITY]-016: Tipos TypeScript en shared-types
```

#### Override
```yaml
operations.json:
  entity: "AuditLog"
  operations: ["read", "list"]  # Sin create/update/delete → NO inferir CRUD completo
```

#### Ejemplo: Usuario lee tasks.md

```markdown
---
id: T-001
title: "Crear modelo Prisma User"
entity: User
operations: [create]
---
```

**El agente infiere:**
- "T-001 solo crea el modelo. Pero operations.json dice que User tiene CRUD completo. Debo verificar si existen T-002 a T-016. Si no existen, debo preguntar o inferirlos según configuración."

**Comportamiento configurable:**
```yaml
# En operations.json
inference_mode: "strict"    # Solo ejecutar tareas explícitas, preguntar si faltan
inference_mode: "auto"      # Inferir y generar tareas faltantes automáticamente
inference_mode: "suggest"   # Generar tareas faltantes como "pending suggestion"
```

---

### 3.2 INF-002: Soft-Delete Automático

#### Trigger
```yaml
types.json:
  entity: "X"
  fields:
    - name: "deletedAt"
      type: "TIMESTAMP_NULLABLE"
      nullable: true
```

#### Inferencia

**En Service:**
```typescript
// El agente DEBE generar remove() así:
async remove(id: string) {
  return this.prisma.x.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Y findAll() así:
async findAll(...) {
  return this.prisma.x.findMany({
    where: { deletedAt: null },  // ← FILTRO AUTOMÁTICO
    ...
  });
}

// Y findOne() así:
async findOne(id: string) {
  return this.prisma.x.findFirst({
    where: { id, deletedAt: null },  // ← FILTRO AUTOMÁTICO
  });
}
```

**En Controller:**
- DELETE /api/x/:id → soft-delete
- POST /api/x/:id/restore → restaurar (set deletedAt = null)

**En Frontend:**
- Botón "Eliminar" → confirm modal + toast "Elemento movido a papelera"
- Filtro "Mostrar eliminados" disponible en DataTable si `restorable: true`

#### Override
```yaml
operations.json:
  entity: "X"
  softDelete: false  # A pesar de tener campo deletedAt
```

---

### 3.3 INF-003: Paginación Automática

#### Trigger
```yaml
operations.json:
  entity: "X"
  routes:
    - method: "GET"
      path: "/api/x"
      action: "list"
```

#### Inferencia por defecto

**Tipo de paginación:** Cursor (a menos que se especifique offset)

**Parámetros de query automáticos:**
```typescript
interface ListQueryParams {
  cursor?: string;      // ID del último elemento de la página anterior
  limit?: number;       // Default: 20, Max: 100
  sort?: string;        // Campo a ordenar (default: createdAt)
  order?: 'asc' | 'desc';  // Default: desc
}
```

**Response shape:**
```typescript
interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;  // null = no hay más páginas
  hasMore: boolean;
  total?: number;  // Solo si countQuery = true
}
```

**Implementación Service:**
```typescript
async findAll(cursor?: string, limit = 20) {
  const take = Math.min(limit, 100);
  const items = await this.prisma.x.findMany({
    where: { deletedAt: null },
    take: take + 1,  // +1 para detectar hasMore
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  
  const hasMore = items.length > take;
  const nextCursor = hasMore ? items[take - 1].id : null;
  
  return {
    items: hasMore ? items.slice(0, take) : items,
    nextCursor,
    hasMore,
  };
}
```

**Implementación Frontend (React Query):**
```typescript
export function useX(cursor?: string) {
  return useQuery({
    queryKey: ['x', cursor],
    queryFn: () => api.get('/x', { params: { cursor } }).then(r => r.data),
  });
}
```

#### Override
```yaml
operations.json:
  entity: "X"
  pagination: 
    type: "offset"      # Cambiar a offset pagination
    pageSize: 50        # Default diferente
```

---

### 3.4 INF-004: Búsqueda Automática

#### Trigger
```yaml
types.json:
  entity: "X"
  flags: ["searchable"]
  # O campos individuales:
  fields:
    - name: "email"
      searchable: true
    - name: "name"
      searchable: true
```

#### Inferencia

**Endpoint LIST modificado:**
```typescript
// Query params adicionales:
interface ListQueryParams {
  // ...pagination params
  q?: string;  // query de búsqueda
}

// Service:
async findAll(..., search?: string) {
  const where = { 
    deletedAt: null,
    ...(search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  // ...
}
```

**Frontend:**
```typescript
// SearchInput con debounce
function SearchInput({ value, onChange }: Props) {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => onChange(localValue), 300);
    return () => clearTimeout(timer);
  }, [localValue]);
  
  return <input value={localValue} onChange={e => setLocalValue(e.target.value)} />;
}
```

#### Campos buscables por defecto
Si `searchable: true` a nivel entidad, buscar por:
- `email` (si existe)
- `name` (si existe)
- `title` (si existe)
- `description` (si existe)

#### Override
```yaml
types.json:
  entity: "X"
  fields:
    - name: "email"
      searchable: true
    - name: "ssn"
      searchable: false  # No buscar por SSN
```

---

### 3.5 INF-005: RBAC Automático

#### Trigger
```yaml
operations.json:
  global_features:
    rbac:
      enabled: true
      roles: ["user", "admin", "moderator"]
```

#### Inferencia

**Decoradores en Controller:**
```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)  // Toda la ruta requiere auth
export class UsersController {
  
  @Post()
  @Roles('admin')  // Solo admin puede crear
  create(@Body() dto: CreateUserDto) { ... }
  
  @Get()
  @Roles('admin', 'moderator')  // Admin y moderator pueden listar
  findAll() { ... }
  
  @Get(':id')
  @Roles('admin', 'moderator')
  @SelfOrAdmin()  // O el propio usuario puede verse
  findOne(@Param('id') id: string, @CurrentUser() user: User) { ... }
  
  @Patch(':id')
  @Roles('admin')
  @SelfOrAdmin()
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { ... }
  
  @Delete(':id')
  @Roles('admin')  // Solo admin puede eliminar
  remove(@Param('id') id: string) { ... }
}
```

**Guard `SelfOrAdmin`:**
```typescript
@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetId = request.params.id;
    
    // Admin siempre puede
    if (user.role === 'admin') return true;
    
    // Moderator puede si es su recurso
    if (user.role === 'moderator' && user.id === targetId) return true;
    
    // User solo puede si es su recurso
    return user.id === targetId;
  }
}
```

#### Frontend
- Si usuario no tiene rol para una acción, ocultar el botón (no deshabilitar)
- Si usuario intenta acceder a ruta prohibida, redirigir a 403 o dashboard

#### Override
```yaml
operations.json:
  routes:
    - method: "POST"
      path: "/api/public/users"
      auth: []  # Público, sin auth
```

---

### 3.6 INF-006: Validación Zod Automática

#### Trigger
```yaml
types.json:
  entity: "X"
  fields:
    - name: "email"
      type: "EMAIL"
    - name: "age"
      type: "INT"
      min: 18
      max: 120
```

#### Inferencia

**Mapeo automático tipo → Zod:**

| Tipo DB | Zod Schema | Comentario |
|---------|-----------|------------|
| UUID | `z.string().uuid()` | |
| EMAIL | `z.string().email()` | |
| STRING | `z.string()` | Con min/max si existen |
| TEXT | `z.string().min(1)` | |
| INT | `z.number().int()` | Con min/max si existen |
| BIGINT | `z.bigint()` o `z.coerce.bigint()` | |
| FLOAT | `z.number()` | Con min/max si existen |
| DECIMAL | `z.number()` | o `z.string()` para precisión |
| BOOLEAN | `z.boolean()` | |
| TIMESTAMP | `z.date()` o `z.string().datetime()` | |
| JSON | `z.record(z.unknown())` | |
| ENUM | `z.enum([...])` | Valores del enum |
| URL | `z.string().url()` | |
| PASSWORD | `z.string().min(8)` | Mínimo 8 chars |
| SLUG | `z.string().regex(/^[a-z0-9-]+$/)` | |

**DTOs generados automáticamente:**
```typescript
// create-x.dto.ts
import { z } from 'zod';

export const CreateXSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  name: z.string().min(2).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

export type CreateXDto = z.infer<typeof CreateXSchema>;

// update-x.dto.ts (partial)
export const UpdateXSchema = CreateXSchema.partial();
export type UpdateXDto = z.infer<typeof UpdateXSchema>;
```

**Pipe de validación NestJS:**
```typescript
// main.ts o global pipe
app.useGlobalPipe(new ZodValidationPipe());

// zod-validation.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}
  
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.errors);
    }
    return result.data;
  }
}
```

#### Override
```yaml
types.json:
  entity: "X"
  fields:
    - name: "email"
      type: "STRING"  # En lugar de EMAIL
      validators: ["custom"]
      customValidator: "myEmailValidator"
```

---

### 3.7 INF-007: Tipos TypeScript Automáticos

#### Trigger
```yaml
types.json:
  entity: "X"
```

#### Inferencia

**En shared-types:**
```typescript
// packages/shared-types/src/models/x.model.ts

export interface X {
  id: string;
  email: string;
  name: string | null;
  role: XRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export enum XRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

// DTOs también van aquí para compartir entre frontend y backend
export type CreateXDto = z.infer<typeof CreateXSchema>;
export type UpdateXDto = z.infer<typeof UpdateXSchema>;
export type XResponse = Omit<X, 'password'>;
```

**Mapeo DB Type → TS Type:**

| DB Type | TS Type |
|---------|---------|
| UUID | `string` |
| VARCHAR | `string` |
| TEXT | `string` |
| INT | `number` |
| BIGINT | `bigint` |
| FLOAT | `number` |
| DECIMAL | `number` o `string` |
| BOOLEAN | `boolean` |
| TIMESTAMP | `Date` |
| JSON | `Record<string, unknown>` |
| JSONB | `Record<string, unknown>` |
| ARRAY | `T[]` |
| ENUM | `[union de literales]` |

#### Nullable
Si `nullable: true` en types.json → `| null` en TS.

---

### 3.8 INF-008: Frontend Automático por Entidad

#### Trigger
```yaml
operations.json:
  entity: "X"
  operations: ["create", "read", "update", "delete", "list"]
  frontend:
    admin: true  # Tiene panel admin
```

#### Inferencia

**Páginas generadas automáticamente:**

```typescript
// /admin/x → Lista
// /admin/x/:id → Detalle
// /admin/x/:id/edit → Edición
// /admin/x/new → Creación
```

**Estructura de cada página:**
- **Lista (DataTable):**
  ```
  - Header con título + botón "Nuevo"
  - SearchInput con debounce
  - DataTable con:
    ├── Sorting por columnas
    ├── Filtering por columnas clave
    ├── Pagination (cursor)
    ├── Actions por fila: Ver, Editar, Eliminar
    └── Estados: loading, empty, error
  ```

- **Detalle:**
  ```
  - Tabs: Información, Historial, Relaciones
  - Botón Editar
  - Botón Eliminar (con confirmación)
  ```

- **Formulario (Crear/Editar):**
  ```
  - react-hook-form con zodResolver
  - Un input por campo del DTO Create
  - Validación en tiempo real
  - Botón Guardar + Cancelar
  - Estados: submitting, success, error
  ```

**Hooks generados automáticamente:**
```typescript
// useX.ts (CRUD completo)
export function useX(cursor?: string, search?: string);
export function useCreateX();
export function useUpdateX();
export function useDeleteX();
export function useXById(id: string);
```

#### Override
```yaml
operations.json:
  entity: "X"
  frontend:
    pages: ["list", "detail"]  # Solo lista y detalle, sin create/edit
    customRoute: "/custom"     # Ruta diferente a /admin/x
```

---

### 3.9 INF-009: Audit Automático

#### Trigger
```yaml
types.json:
  entity: "X"
  flags: ["auditable"]
```

#### Inferencia

**Campos automáticos:**
```prisma
model X {
  // ...campos del negocio...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?  // UUID del usuario
  updatedBy String?  // UUID del usuario
}
```

**Middleware Prisma:**
```typescript
prisma.$use(async (params, next) => {
  if (params.model === 'X' && ['create', 'update'].includes(params.action)) {
    const userId = getCurrentUserId(); // del contexto
    if (params.action === 'create') {
      params.args.data.createdBy = userId;
    }
    params.args.data.updatedBy = userId;
  }
  return next(params);
});
```

**NO incluir en DTOs:**
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy` son automáticos
- El frontend no debe enviarlos ni editarlos

---

### 3.10 INF-010: Tests Automáticos

#### Trigger
```yaml
operations.json:
  entity: "X"
  operations: ["create", "read", "update", "delete", "list"]
```

#### Inferencia

**Tests e2e mínimos por endpoint:**

```typescript
describe('UsersController (e2e)', () => {
  describe('POST /users', () => {
    it('should create a user with valid data', () => {...});
    it('should reject invalid email', () => {...});
    it('should reject duplicate email', () => {...});
    it('should require authentication', () => {...});
    it('should require admin role', () => {...});
  });

  describe('GET /users', () => {
    it('should return paginated list', () => {...});
    it('should support cursor pagination', () => {...});
    it('should support search', () => {...});
    it('should filter deleted items', () => {...});
  });

  describe('GET /users/:id', () => {
    it('should return user by id', () => {...});
    it('should return 404 for deleted user', () => {...});
    it('should allow self-access', () => {...});
  });

  describe('PATCH /users/:id', () => {
    it('should update user', () => {...});
    it('should validate partial updates', () => {...});
    it('should allow self-update', () => {...});
  });

  describe('DELETE /users/:id', () => {
    it('should soft-delete user', () => {...});
    it('should require admin role', () => {...});
    it('should allow restore', () => {...});
  });
});
```

---

## 4. Matriz de Inferencia Cruzada

### 4.1 Combinaciones de flags

| Entity Flags | Operations | Frontend | Inferido |
|-------------|------------|----------|----------|
| `crud` | `create,read,update,delete,list` | `admin: true` | Backend + Frontend + Tests completos |
| `crud` | `create,read,update,delete,list` | `admin: false` | Solo backend + tests backend |
| `read-only` | `read,list` | `admin: true` | Solo GET endpoints + lista frontend |
| `auditable` | cualquiera | cualquiera | Middleware audit automático |
| `searchable` | `list` | `admin: true` | Search input + query params |
| `soft_delete` | `delete` | `admin: true` | Soft delete + restore + filtros |

### 4.2 Ejemplos de combinaciones

#### Ejemplo A: Entidad simple (solo lectura)
```yaml
# types.json
entity: "Category"
flags: ["read-only"]
fields: [id, name, slug]

# operations.json
operations: ["read", "list"]
frontend:
  admin: true
  pages: ["list"]  # Solo lista, no CRUD
```

**Inferido:**
- Backend: GET /categories, GET /categories/:id
- Frontend: Página de lista simple (sin botón "Nuevo" ni acciones)
- Tests: Solo tests de lectura

#### Ejemplo B: Entidad compleja (admin + público)
```yaml
# types.json
entity: "Product"
flags: ["crud", "auditable", "searchable", "soft_delete"]
fields: [id, name, price, stock, categoryId, ...]

# operations.json
operations: ["create", "read", "update", "delete", "list"]
frontend:
  admin: true
  public: true
  publicRoute: "/products"
```

**Inferido:**
- Backend: CRUD completo + soft-delete + audit + search
- Frontend: 
  - Admin: /admin/products (CRUD completo)
  - Público: /products (lista + detalle, sin admin)
- Tests: Backend + Frontend (ambos)

---

## 5. API de Inferencia

### 5.1 Interface

```typescript
// packages/shared-types/src/inference-engine.ts

interface InferenceContext {
  typesJson: TypesJson;
  operationsJson: OperationsJson;
  existingTasks: ParsedTask[];
  stage: string;
}

interface InferenceResult {
  inferredTasks: InferredTask[];
  warnings: InferenceWarning[];
  coverage: {
    entities: number;
    tasksExplicit: number;
    tasksInferred: number;
    coveragePercent: number;
  };
}

interface InferredTask {
  task: ParsedTask;
  reason: string;           // Por qué se infirió
  rule: string;             // Qué regla de inferencia aplica
  confidence: number;       // 0-1, basado en la certeza de la inferencia
}

export function inferTasks(context: InferenceContext): InferenceResult;
export function inferCode(task: ParsedTask, context: InferenceContext): InferredCode;
export function validateInference(result: InferenceResult): boolean;
```

### 5.2 Uso

```typescript
// En Task Generator Node (LangGraph)
const inferenceResult = inferTasks({
  typesJson: extractedTypes,
  operationsJson: extractedOperations,
  existingTasks: previouslyGeneratedTasks,
  stage: "etapa-1",
});

// Combinar tareas explícitas + inferidas
const allTasks = [...explicitTasks, ...inferenceResult.inferredTasks];

// Auditoría
if (inferenceResult.coverage.coveragePercent < 0.90) {
  logger.warn(`Cobertura de inferencia baja: ${inferenceResult.coverage.coveragePercent}`);
}
```

---

## 6. Configuración Global

### 6.1 operations.json — inference_settings

```json
{
  "inference_settings": {
    "mode": "auto",
    "confidence_threshold": 0.8,
    "max_inferred_tasks": 100,
    "defaults": {
      "pagination": "cursor",
      "page_size": 20,
      "auth": ["jwt"],
      "frontend_framework": "react",
      "state_management": "tanstack-query",
      "form_library": "react-hook-form",
      "validation": "zod",
      "ui_library": "shadcn",
      "table_component": "data-table",
      "test_framework": "jest",
      "e2e_framework": "playwright"
    }
  }
}
```

### 6.2 Overrides por entidad

```json
{
  "operations": [
    {
      "entity": "AuditLog",
      "inference_override": {
        "crud_auto": false,        // No generar frontend ni tests
        "soft_delete": false,      // Hard delete permitido
        "rbac": ["admin"],         // Solo admin accede
        "frontend": false          // Sin UI
      }
    }
  ]
}
```

---

## 7. Ejemplos de Casos Borde

### 7.1 Entidad sin operaciones explícitas

```yaml
# MDD §3 incluye entidad pero operations.json NO la menciona
entity: "AuditLog"
# Sin operations → Inferir read-only por defecto
```

**Resultado:** Solo GET endpoints (lista + detalle), sin mutaciones.

### 7.2 Campo con nombre ambiguo

```yaml
field:
  name: "status"
  type: "STRING"
  # Sin enum values → No inferir enum
```

**Resultado:** `z.string()` en lugar de `z.enum()`. Marcar warning.

### 7.3 Relación circular

```yaml
entityA:
  relations: [{ target: "B" }]
entityB:
  relations: [{ target: "A" }]
```

**Resultado:** Generar ambos modelos con relación bidireccional. No generar dependencia circular en tasks (paralelizar).

### 7.4 Entidad con 20+ campos

```yaml
entity: "ComplexForm"
fields: [20+ campos]
```

**Resultado:** Frontend dividir en secciones/tab groups. No generar un formulario de 20 inputs en una sola pantalla.

---

## 8. Métricas de Calidad de Inferencia

### 8.1 KPIs

| Métrica | Target | Descripción |
|---------|--------|-------------|
| Cobertura de inferencia | >= 90% | % de tareas inferidas / tareas totales |
| Precisión de código | >= 85% | % de código inferido que compila sin cambios |
| Falsos positivos | < 5% | % de inferencias que el usuario rechaza |
| Tiempo de inferencia | < 2s | Tiempo para generar todas las inferencias |

### 8.2 Validación

```bash
# Comando para validar inferencia de un spec-kit
npx theforge validate-inference \
  --spec-kit ./specs/001-feature/ \
  --types ./specs/001-feature/types.json \
  --operations ./specs/001-feature/operations.json

# Output:
# ✅ Entidades: 5
# ✅ Tareas explícitas: 12
# ✅ Tareas inferidas: 48
# ✅ Cobertura: 80% (target: 90%) ⚠️
# ⚠️  Faltan tests para Product.controller
# ✅ Precisión estimada: 87%
```

---

> **Fin del documento.** Para implementación técnica del inference engine, ver `docs/lean-sdd-implementation-plan.md` §3.2.
