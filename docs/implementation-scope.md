# Alcance de implementación — Fase 1 y Fase 2

> Revisión detallada de cada entregable antes de empezar a codificar.
> Para cada uno: qué hace, qué no hace, inputs, outputs, dependencias.

---

## Fase 1: Navigation Map + Entrevista

---

### 1. Scanner de rutas

**Qué hace:** Dado un proyecto indexado en AriadneSpecs, detecta el framework de
routing (React Router, Next.js, etc.), parsea la configuración de rutas y extrae
el árbol completo: URL, parámetros, componente asociado.

**Input:**
- `projectId` (Ariadne / TheForge)
- Opcional: `scope = "full" | "diff"`, `baselineStageId`

**Output:**
```
Rutas encontradas: N
Framework detectado: react-router-dom@6 | next@14 | ...

/ruta/estática
  ├── Parámetros: ninguno
  └── Componente: ClientListPage (src/pages/ClientListPage.tsx)

/ruta/:id/edit
  ├── Parámetros: id (string)
  └── Componente: ClientEditPage (src/pages/ClientEditPage.tsx)
```

**Lo que NO hace en esta iteración:**
- ❌ No sigue imports recursivos todavía (solo componente directo de la ruta)
- ❌ No analiza formularios (eso es el entregable 2)
- ❌ No detecta componentes compartidos (eso es el entregable 3)
- ❌ Soporte solo React (React Router + Next.js). Angular/Vue/Svelte quedan para después.

**Dependencias:** Ninguna. Es el primer entregable.

**Estimado:** 1 tool MCP en AriadneSpecs.

---

### 2. Analizador de formularios

**Qué hace:** Para cada componente detectado en el scanner de rutas, analiza el
código en busca de formularios, campos, tipos, validaciones y endpoints asociados.

**Input:**
- Árbol de rutas → componentes (del entregable 1)
- `projectId`

**Output (se agrega a cada ruta del mapa):**
```
Formularios:
  - ClientForm
    - Campo: nombre (input text, required, maxLength=100)
    - Campo: email (input email, required)
    - Campo: tipo (select, opciones: [premium, basic])
    - Submit: POST /api/clients
  - SearchBar (componente compartido → referenciado)
    - Campo: query (input text, placeholder="Buscar...")
    - Submit: GET /api/clients?q=

Componentes con DynamicForm:
  - DynamicForm (schema: @schemas/clientCreate.json)
    - Campos desde schema: nombre, email, tipo, descuento
```

**Qué analiza:**
- ✅ Inputs estáticos: `<input>`, `<select>`, `<textarea>` con sus atributos
- ✅ Formularios dinámicos: `<DynamicForm schema={...}>` — resuelve el schema
  importado localmente (.json, .ts). Si el schema viene de API, solo documenta
  el endpoint.
- ✅ Eventos submit: asocia el handler al endpoint (POST, PUT, PATCH, DELETE)
- ✅ Llamadas fetch/axios en el componente: extrae endpoints

**Lo que NO hace:**
- ❌ No resuelve schemas que vienen de una API externa (solo documenta la fuente)
- ❌ No analiza validación en schemas remotos
- ❌ Soporte solo JSX/TSX (React)

**Dependencias:** Entregable 1 (necesita el árbol de rutas).

**Estimado:** Extensión del mismo tool MCP del entregable 1.

---

### 3. Detección de componentes compartidos

**Qué hace:** Identifica componentes que son importados desde múltiples rutas y
los clasifica como "compartidos". Los documenta en una sección aparte del mapa
con la lista de rutas que los usan.

**Input:**
- Árbol de rutas con componentes (entregable 1 + 2)
- Grafo de dependencias de AriadneSpecs

**Output (sección aparte del mapa):**
```
Componentes Compartidos:
  AddressForm (src/shared/AddressForm.tsx)
    ├── Props: { initialValues: Address, onChange: fn, errors: Record<string, string> }
    ├── Campos: calle, ciudad, estado, cp
    ├── Endpoints: GET /api/catalog/states
    └── Usado en: /clients/new, /clients/:id/edit, /orders/:id/edit
        ⚠️ 3 rutas afectadas si se modifica

  Pagination (src/shared/Pagination.tsx)
    ├── Props: { page: number, totalPages: number, onChange: fn }
    ├── Endpoints: ninguno
    └── Usado en: /clients, /orders, /products, /reports
        ⚠️ 4 rutas afectadas si se modifica

  DynamicForm (src/shared/DynamicForm.tsx)
    ├── Props: { schema: JsonSchema, initialData: T, onSubmit: fn }
    ├── Schemas que renderiza: clientCreate, orderCreate, productCreate
    └── Usado en: /clients/new, /orders/new, /products/new
        ⚠️ 3 rutas afectadas si se modifica
```

**Regla de decisión:** Un componente es "compartido" si está importado desde ≥2
rutas distintas. Componentes importados por 1 sola ruta son "internos" de esa ruta.

**Lo que NO hace:**
- ❌ No detecta componentes compartidos entre proyectos multi-root (solo intra-repo)
- ❌ No detecta compartidos por patrón de nombre (ej. todos los `*Form.tsx`)
- ❌ No incluye el contrato SDD (props) — eso ya existe en `get_contract_specs`

**Dependencias:** Entregable 2. También consulta el grafo de dependencias existente
de AriadneSpecs (`get_component_graph`, `get_references`).

**Estimado:** Extensión del mismo tool MCP. Lógica de conteo de referencias.

---

### 4. Entrevista conversacional

**Qué hace:** Reemplaza el flujo actual de `legacy_start` → preguntas → `legacy_answer`
por un agente conversacional que, guiado por el navigation map, hace preguntas
iterativas para definir el alcance del cambio.

**Input:**
- Descripción inicial del usuario
- Navigation map de la etapa base
- (Opcional) Historial de etapas anteriores

**Output (ChangeScope):**
```typescript
interface ChangeScope {
  confirmed: boolean;
  description: string;        // descripción refinada
  affectedRoutes: {
    url: string;
    screen: string;
    components: string[];
    changeType: "add_field" | "modify_field" | "new_form" | "new_route" | "other";
  }[];
  affectedEndpoints: {
    method: string;
    path: string;
    changeType: "add" | "modify" | "remove";
  }[];
  newFields?: {
    component: string;
    form: string;
    field: string;
    type: string;
    validation?: string;
    afterField?: string;  // "después de X"
  }[];
  sharedComponentsImpacted: string[];
  userConfirmation: boolean;
}
```

**Flujo:**
```
1. Usuario: "Agregar campo descuento al alta de clientes"
2. Sistema: consulta navigation map → identifica /clients/new
3. Sistema: "Veo la pantalla 'Alta de Cliente' en /clients/new.
   El formulario actual tiene: nombre, email, teléfono.
   ¿El campo descuento va en ese mismo formulario?"
4. Usuario: "Sí, después de teléfono"
5. Sistema: "¿Es porcentaje o monto fijo? ¿Tiene validaciones?"
6. Usuario: "Porcentaje, 0-100, requerido"
7. Sistema: "¿Afecta también la pantalla de edición?"
8. Usuario: "Sí"
9. Sistema: muestra ChangeScope → "¿Confirmas?"
10. Usuario: "Sí"
11. → Se genera MDD con el alcance confirmado
```

**Preguntas que hace (por tipo de cambio):**

| Tipo de cambio | Preguntas |
|---|---|
| Agregar campo | ¿En qué pantalla? ¿En qué formulario? ¿Después de qué campo? ¿Tipo? ¿Validaciones? ¿Afecta solo alta o también edición? |
| Modificar campo | ¿Cambia tipo? ¿Cambian validaciones? ¿Afecta datos existentes? |
| Nueva pantalla | ¿Ruta? ¿Qué contiene? ¿Qué endpoints necesita? |
| Nuevo endpoint | ¿Qué método? ¿Qué hace? ¿Afecta frontend existente? |
| Componente compartido | Se usa en N rutas. ¿Aplicar cambio a todas? |

**Lo que NO hace:**
- ❌ No modifica el motor de generación de MDD (solo el input que recibe)
- ❌ No reemplaza el staged discovery (lo complementa)
- ❌ No ejecuta código

**Dependencias:** Entregable 3 (navigation map completo). Sin el mapa, la entrevista
no puede hacer preguntas específicas sobre pantallas.

**Estimado:** Nuevo flujo en TheForge (NestJS). Un servicio `ChangeInterviewService`
que orquesta las preguntas y produce el ChangeScope.

---

### 5. resolve_change_to_files tool

**Qué hace:** Dada una descripción de cambio y un navigation map, devuelve una
lista de archivos sugeridos a modificar, las rutas afectadas y los componentes
compartidos involucrados.

**Input:**
```typescript
{
  projectId: string;
  description: string;        // "agregar campo descuento al alta de clientes"
  stageId?: string;           // etapa base, para cargar su navigation map
}
```

**Output:**
```typescript
{
  suggestedFiles: string[];   // ["src/pages/ClientNewPage.tsx", "src/components/ClientForm.tsx", ...]
  affectedRoutes: string[];   // ["/clients/new", "/clients/:id/edit"]
  sharedComponents: string[]; // ["AddressForm"] — si ClientForm lo usa internamente
  sddImpact: {
    safe: boolean;
    warnings: string[];
  };
}
```

**Cómo funciona:**
1. Busca en el navigation map por coincidencia semántica (descripción vs nombres
   de pantalla, URLs, componentes)
2. Identifica la(s) ruta(s) candidatas
3. Para cada ruta, extrae los archivos del componente principal y subcomponentes
4. Detecta si hay componentes compartidos en el árbol
5. Consulta SDD para validar impacto preliminar
6. Devuelve resultado

**Este tool es el puente entre la entrevista y el staged discovery.** La entrevista
usa este tool para proponer archivos al usuario.

**Lo que NO hace:**
- ❌ No modifica archivos
- ❌ No genera documentación
- ❌ No ejecuta el staged discovery completo (solo produce candidatos)

**Dependencias:** Entregable 3 (navigation map completo). Consulta SDD (ya existe).

**Estimado:** 1 tool MCP en AriadneSpecs.

---

## Fase 2: Precisión

---

### 6. Tasks con coordenadas exactas

**Qué hace:** Las Tasks ya se generan hoy (`generateTasks`). La mejora es que cada
Task incluya coordenadas precisas del cambio: archivo, función, línea sugerida,
y el diff esperado.

**Input:**
- MDD de cambio (con referencias a componentes y endpoints)
- Navigation map de la etapa base
- (Opcional) `ChangeScope` de la entrevista

**Output (formato de Task mejorado):**
```markdown
## T-001: Agregar campo descuento a formulario de alta
**Archivo:** src/components/ClientForm.tsx
**Función:** handleSubmit
**Línea sugerida:** después de línea 142 (campo teléfono)
**Cambio:**
```diff
+ <FormField
+   name="discount"
+   label="Descuento (%)"
+   type="number"
+   required
+   min={0}
+   max={100}
+ />
```
**Endpoint:** POST /api/clients — agregar campo `discount` al body
**DTO:** src/dtos/create-client.dto.ts — agregar `discount: number`
**Validación:** src/validators/client.validator.ts — min 0, max 100
**Afecta también:** /clients/:id/edit (mismo campo en edición)
```

**Lo que NO hace:**
- ❌ No genera el diff automáticamente (lo sugiere)
- ❌ No aplica los cambios

**Dependencias:** Entregable 4 (ChangeScope de la entrevista) + navigation map.

**Estimado:** Modificación del generador de Tasks existente en TheForge.

---

### 7. check_navigation_impact

**Qué hace:** Extiende `validate_before_edit` (SDD) para que también consulte el
navigation map y advierta si modificar un componente afecta otras rutas.

**Input:**
```typescript
{
  projectId: string;
  componentPath: string;   // "src/shared/AddressForm.tsx"
  stageId?: string;        // etapa base
}
```

**Output (adicional al SDD actual):**
```typescript
{
  // ... resultado existente de validate_before_edit ...
  navigationImpact: {
    isShared: boolean;
    routesAffected: string[];     // ["/clients/new", "/clients/:id/edit", "/orders/:id/edit"]
    screenNames: string[];        // ["Alta de Cliente", "Editar Cliente", "Editar Pedido"]
    warning: string;              // "Componente compartido en 3 rutas. Verificar que el cambio sea compatible con todas."
  };
}
```

**Integración con TheForge:**
- Cuando el staged discovery identifica un componente a modificar, llama a
  `check_navigation_impact` automáticamente
- Si el componente es compartido, lo muestra en la entrevista:
  "⚠️ ClientForm se usa en 3 pantallas. ¿El cambio aplica a todas?"
- En la generación de Tasks, incluye la advertencia

**Lo que NO hace:**
- ❌ No impide cambios (solo advierte)
- ❌ No requiere aprobación forzosa (la decisión es del usuario)

**Dependencias:** Entregable 3 (navigation map). Extiende `validate_before_edit`
que ya existe en AriadneSpecs.

**Estimado:** Extensión del tool `validate_before_edit` existente + lógica de
consulta al navigation map.

---

### 8. Transición NEW → LEGACY

**Qué hace:** Cuando un proyecto que empezó como NEW (greenfield) tiene código
indexado en AriadneSpecs, TheForge detecta la situación y ofrece migrar el
siguiente cambio al flujo legacy.

**Detección:**
- Al iniciar un cambio (botón "Nuevo cambio" en la UI), TheForge pregunta:
  1. ¿El proyecto tiene un repositorio con código?
  2. ¿Ese repositorio está indexado en AriadneSpecs?
  3. Si sí → ofrecer flujo legacy
  4. Si no → ofrecer indexar primero

**Flujo:**
```
Proyecto: "MiApp" (tipo NEW, 3 meses en producción)
  ↓
Usuario: inicia cambio
  ↓
TheForge: "Este proyecto tiene código en producción indexado en AriadneSpecs.
  ¿Quieres activar el modo de cambios legacy? Esto permitirá:
  - Consultar el código existente antes de generar documentación
  - Validar que los cambios no rompan funcionalidad actual
  - Generar Tasks con referencias exactas a archivos"
  ↓
Usuario: "Sí"
  ↓
TheForge: crea Etapa 1 como baseline del código actual
  → genera navigation map inicial
  → siguiente cambio usa flujo legacy completo
```

**Lo que NO hace:**
- ❌ No convierte el proyecto a tipo LEGACY (sigue siendo NEW conceptualmente)
- ❌ No borra la documentación greenfield existente
- ❌ No obliga a usarlo (el usuario puede rechazar)

**Dependencias:** Navigation map (entregable 1-3) + flujo legacy existente.

**Estimado:** Lógica en TheForge (NestJS) en el servicio de inicio de cambio.

---

## Matriz de dependencias

```
1. Scanner de rutas → (ninguna)
2. Analizador de formularios → 1
3. Detección de componentes compartidos → 2
4. Entrevista conversacional → 3 (necesita el mapa completo)
5. resolve_change_to_files → 3
6. Tasks con coordenadas → 4 + 3
7. check_navigation_impact → 3
8. Transición NEW→LEGACY → 1, 2, 3
```

**Orden óptimo de implementación:**

```
1 → 2 → 3 → [4, 5, 7] en paralelo → [6, 8]
```

Los entregables 4, 5 y 7 pueden hacerse en paralelo porque los 3 dependen del
mismo input (navigation map completo del entregable 3).
