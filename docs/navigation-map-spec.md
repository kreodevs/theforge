# Navigation Map — Especificación

> Documento de diseño para la generación y mantenimiento de un mapa de navegación
> que traduzca rutas de UI a componentes, campos, validaciones y endpoints.
>
> **Propósito:** Que TheForge pueda entender "en la pantalla X queremos agregar
> campos y validaciones" sin que el usuario tenga que conocer la estructura del codebase.
>
> **Visión mayor:** Integrar este mapa en el pipeline completo de SDD:
> AriadneSpecs indexa → TheForge modela el cambio conversacionalmente →
> MDD/Blueprint/API Contracts definen la especificación → SDD valida que no se
> rompan contratos existentes → Cursor AI (o cualquier IA) ejecuta los cambios
> guiado por los documentos y el MCP de Ariadne + TheForge — de forma quirúrgica,
> sin romper nada.

## 1. Visión general

### 1.1 Problema

El flujo legacy de TheForge requiere que el usuario especifique archivos a modificar.
Para alguien que no conoce el codebase, esto es una barrera. El grafo de AriadneSpecs
indexa archivos y dependencias, pero no sabe qué significa cada archivo en términos
de negocio (pantallas, formularios, campos).

Adicionalmente, el flujo legacy actual es **reactivo**: recibe una descripción y
archivos, y genera documentación. No hay una fase de **descubrimiento conversacional**
donde el sistema haga preguntas para entender el alcance real del cambio, del mismo
modo que un arquitecto entrevista al stakeholder antes de diseñar.

### 1.2 Solución

**Tres pilares:**

1. **Mapa de navegación:** AriadneSpecs genera y mantiene un documento estructurado
   que mapea cada ruta de la aplicación a componentes, campos, validaciones y endpoints.
   Serve como "capa de UI" del índice de código.

2. **Flujo conversacional de cambios:** El staged discovery agent evoluciona de ser
   un buscador de evidencia a ser un **entrevistador** que hace preguntas al usuario
   para refinar el alcance del cambio, exactamente como Hermes hace preguntas antes
   de ejecutar una tarea compleja.

3. **Transición NEW → LEGACY:** Un proyecto que arranca como NEW (greenfield) y
   acumula código debe poder migrar al flujo legacy sin fricción, indexando su
   codebase en AriadneSpecs para que los cambios subsecuentes sean precisos.

### 1.3 Pipeline completo (visión SDD)

```
                         ┌──────────────────────────────┐
                         │    USUARIO (lenguaje natural) │
                         └────────┬─────────────────────┘
                                  │ "Agregar campo descuento al alta de clientes"
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    THEFORGE — FLUJO LEGACY                       │
│                                                                  │
│  1. ENTREVISTA (nuevo)                                           │
│     ├── "¿Qué pantalla? ¿Alta de clientes?"                      │
│     ├── "¿El campo descuento es fijo o calculado?"               │
│     ├── "¿Afecta solo el form de alta o también edición?"        │
│     └── "¿Hay reglas de negocio asociadas (mínimo, máximo)?"     │
│                                                                  │
│  2. STAGED DISCOVERY                                             │
│     ├── Consulta navigation map → ubica /clients/new             │
│     ├── Consulta grafo Ariadne → dependencias, contratos         │
│     ├── Consulta SDD → validate_before_edit                      │
│     └── Síntesis: "esto toca, esto no rompe, esto es riesgo"     │
│                                                                  │
│  3. DOCUMENTACIÓN                                                │
│     ├── MDD de cambio (qué cambia y por qué)                     │
│     ├── Blueprint (cómo se implementa)                            │
│     ├── API Contracts (contratos nuevos/modificados)             │
│     └── Tasks (archivos exactos a modificar)                     │
│                                                                  │
│  4. VALIDACIÓN SDD                                               │
│     └── validate_before_edit + get_legacy_impact                 │
│         → "¿Este cambio rompe otras pantallas?"                  │
│                                                                  │
│  5. EJECUCIÓN                                                    │
│     └── Cursor AI / Agente lee docs + MCP y edita                │
│                                                                  │
│  6. POST-CAMBIO                                                  │
│     └── Re-indexar + actualizar navigation map                   │
│         → siguiente etapa parte del mapa actualizado             │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Arquitectura

### 2.1 Componentes involucrados

```
[Codebase] → [AriadneSpecs Scanner] → [Navigation Map]
                                             ↓
[TheForge — Flujo Legacy]
    ├── [Entrevistador] ← NUEVO: agente conversacional que hace preguntas
    ├── [Staged Discovery Agent] ← mejorado con navigation map
    ├── [Generador MDD / Blueprint / API / Tasks]
    └── [Validador SDD] ← extendido con impacto en navegación
            ↓
[MC P AriadneSpecs]
    ├── generate_navigation_map
    ├── validate_before_edit (SDD + impacto navegación)
    ├── get_legacy_impact
    └── get_contract_specs
        ↓
[Cursor AI / Agente]
    └── Lee documentos + contratos + mapa → edita con precisión
```

### 2.2 Transición NEW → LEGACY

Un proyecto nace como NEW (greenfield):

```
NEW: Sin código → TheForge usa DBGA + BRD + MDD + Benchmarks
      → Se genera Spec, Arquitectura, Blueprint, API Contracts
      → Se implementa (Cursor, código real)
      → ¡El proyecto ahora TIENE código!
```

Cuando se inicia un segundo cambio, TheForge detecta:

```
¿El proyecto tiene código en producción?
  ├── Sí → Ofrecer indexar en AriadneSpecs
  │       └── Crear etapa LEGACY con el código actual como baseline
  │       └── A partir de aquí, los cambios usan el flujo legacy
  └── No → Seguir como NEW (sin codebase que consultar)
```

El trigger puede ser:
- El usuario inicia un cambio y el proyecto ya no está en fase de diseño
- El proyecto tiene un repositorio remoto con código
- El propio usuario marca el proyecto como "en producción" y solicita indexación

**Mecanismo:** El proyecto conserva su tipo NEW pero el flujo legacy se activa
automáticamente cuando hay código indexado. No es un cambio de tipo, es un cambio
de modo de operación.

## 3. Flujo conversacional de cambios

### 3.1 Problema actual

El flujo legacy pide:
1. Descripción del cambio
2. Archivos a modificar (el usuario debe saber esto)
3. Respuestas a preguntas predefinidas

Esto asume que el usuario ya sabe qué archivos tocar. En la práctica, el usuario
sabe qué quiere lograr, no qué archivos cambiar.

### 3.2 Solución: entrevista en lugar de formulario

El staged discovery se convierte en un **entrevistador** que, dado el contexto del
navigation map y el grafo de Ariadne, hace preguntas para refinar el cambio:

```
Usuario: "Quiero agregar un campo de descuento al alta de clientes"

Entrevistador (TheForge):
  1. Consulta navigation map → encuentra /clients/new, ClientForm.tsx,
     POST /api/clients
  2. Consulta grafo Ariadne → modelo Client, campos actuales
  3. Pregunta:
     "Veo la pantalla 'Alta de Cliente' en /clients/new. El formulario
      actual tiene: nombre, email, teléfono. ¿El nuevo campo 'descuento'
      va en ese mismo formulario o en una pantalla aparte?"

Usuario: "Ahí mismo, abajo de teléfono"

Entrevistador:
  4. Consulta SDD → contrato de ClientForm.tsx, validaciones existentes
  5. Pregunta:
     "¿El descuento es un porcentaje (0-100) o un monto fijo?"
     "¿Aplica alguna validación especial (mínimo, máximo, sólo
      administradores)?"
     "¿Este cambio afecta también la pantalla de edición de clientes?"

Usuario: responde...

Entrevistador:
  6. Sintetiza: "OK. El cambio es:
     - Archivo: ClientForm.tsx (agregar campo descuento después de teléfono)
     - API: POST /api/clients (nuevo campo discount en el body)
     - Tipo: porcentaje (0-100), requerido, solo admins
     - Afecta: /clients/new y /clients/:id/edit
     - No rompe: el contrato SDD de ClientForm es compatible
     ¿Confirmas?"
```

### 3.3 Tipos de preguntas

| Categoría | Ejemplos |
|---|---|
| **Ubicación** | "¿En qué pantalla? ¿El campo va en un formulario existente o uno nuevo?" |
| **Alcance** | "¿Afecta solo alta o también edición, listado, detalle?" |
| **Tipo de dato** | "¿El campo es texto, número, selector, booleano?" |
| **Validaciones** | "¿Es requerido? ¿Tiene valores mín/máx? ¿Patrón específico?" |
| **Reglas de negocio** | "¿Quién puede ver/editar este campo? ¿Depende de otro campo?" |
| **Impacto** | "¿Este componente se usa en otras pantallas? ¿Quieres que cambie en todas?" |
| **Backend** | "¿El endpoint actual soporta este campo o necesitas uno nuevo?" |

### 3.4 Integración con el MDD

La entrevista no es un paso aparte — es la **fase inicial del MDD**. El entrevistador
va construyendo el contexto que alimenta al generador del MDD de cambio.

El flujo sería:

```
1. Entrevista (preguntas → respuestas → alcance definido)
2. Staged discovery (evidencia del código + navigation map)
3. Síntesis: "Esto es lo que entendí. ¿Confirmas?"
4. Generación de documentos (MDD → Blueprint → API → Tasks)
```

## 4. Mapa de navegación

### 4.1 Formato

Documento Markdown estructurado. [Ver detalle completo en §Estructura]

### 4.2 Decisiones de diseño

#### 4.2.1 Formularios estáticos y dinámicos

El scanner debe soportar ambos patrones:

- **Estáticos:** `<input>`, `<select>`, `<textarea>`, `<form onSubmit>` — análisis por AST
- **Dinámicos:** `<DynamicForm schema={...}>` — resolver el schema importado y documentar
  los campos desde la definición del schema, no del render. Si el schema viene de una
  API externa (`GET /api/x/schema`), documentar el endpoint que lo provee.

**Regla:** El sistema debe ser universal — aplica a proyectos con formularios
tradicionales, con DynamicForm de Kreo, o con cualquier otra implementación.
No asumir un solo framework de formularios.

#### 4.2.2 Componentes compartidos

- **Primera ocurrencia:** Se documenta como entrada independiente en la sección
  "Componentes Compartidos", con su contrato SDD (props), campos y endpoints
- **Ocurrencias siguientes:** Se referencian con `↪ NombreComponente`
- **Justificación:** Si se modifica un componente compartido, el mapa permite ver
  todas las rutas afectadas. Esto evita romper pantallas que usan el mismo componente
  sin saberlo.

#### 4.2.3 Precisión del mapeo campo → endpoint

- **Máxima precisión.** Solo se mapea un campo de formulario a un campo del backend
  cuando hay evidencia directa:
  - Tipos TypeScript compartidos entre frontend y backend
  - Schemas OpenAPI que documentan el body del request
  - Schemas json-schema compartidos
  - DTOs/validadores importados en el frontend desde un paquete compartido
- **Sin evidencia directa:** Se documenta el endpoint y los campos del form por
  separado, sin inferir correspondencia. Se marca como "mapeo no verificado".
- **Razón:** En legacy, asumir correspondencias puede llevar a cambios incorrectos.
  Es preferible que el humano (o el agente con más contexto) haga la conexión.

## 5. Mantenimiento incremental

### 5.1 Ciclo de vida por etapa

Siguiendo el modelo de **"etapas como cambios"** de TheForge. Cada etapa tiene su
snapshot del mapa de navegación:

```
Etapa 1 (inicial — legacy onboarding)
  ├── AriadneSpecs escanea el codebase completo
  ├── Entrevistador: "Cuéntame sobre el proyecto. ¿Qué módulos tiene?"
  ├── Genera mapa de navegación completo
  └── Se almacena como navigationMap de la etapa

Etapa 2 (cambio 1)
  ├── Entrevistador guía la definición del cambio
  ├── Staged discovery usa navigation map de Etapa 1
  ├── Se genera documentación del cambio
  ├── Se implementa
  ├── Ariadne re-escanea rutas modificadas
  └── Mapa de Etapa 2 = Mapa 1 + diff (muestra solo el cambio)
      └── Si alguien ve el mapa de Etapa 2 ve el estado completo post-cambio

Etapa 3 (cambio 2)
  └── Misma lógica, parte del mapa de Etapa 2
```

### 5.2 Detección de cambios

- **Rutas nuevas:** Aparecen en la configuración de routing y no estaban
- **Rutas eliminadas:** Desaparecen de la configuración
- **Componentes modificados:** Cambia el árbol de importaciones, formularios o contrato
- **Endpoints nuevos/eliminados:** Cambian llamadas fetch/axios
- **Campos agregados/eliminados:** Cambian inputs o schemas json-schema
- **Componentes compartidos:** Si aparece en nueva ruta, se agrega referencia

### 5.3 Integración con el flujo legacy

Cuando se inicia un cambio legacy:

1. **Entrevista:** El agente hace preguntas para refinar el cambio
2. **Discovery:** Carga navigation map + grafo Ariadne
3. **Búsqueda:** Usa búsqueda semántica para ubicar pantallas por nombre
4. **SDD:** Valida que el cambio no rompa contratos existentes
5. **Documentación:** Genera MDD con referencias precisas
6. **Ejecución:** Cursor AI lee docs + MCP y ejecuta
7. **Post-cambio:** Re-indexa y actualiza mapa

## 6. Frameworks a soportar (frontend agnóstico)

### 6.1 Fase 1 — React

| Framework | Archivo de rutas | Patrón |
|---|---|---|
| React Router v6 | `createBrowserRouter`, `<Routes>` | `{ path, element }` |
| Next.js Pages Router | `pages/` directorio | Archivo → ruta |
| Next.js App Router | `app/` directorio | Carpetas → rutas |
| Expo Router | `app/` directorio | Similar a Next.js App |
| TanStack Router | `routeTree.gen.ts` | `{ path, component }` |

### 6.2 Fase 2 — Otros

| Framework | Archivo de rutas | Patrón |
|---|---|---|
| Angular | `app-routing.module.ts` | `{ path, component }` |
| Vue Router | `router/index.ts` | `{ path, component }` |
| SvelteKit | `src/routes/` | Archivo → ruta |
| Remix | `app/routes/` | Archivo → ruta |
| Solid Start | `src/routes/` | Archivo → ruta |

## 7. Implementación técnica

### 7.1 En AriadneSpecs (nuevos tools MCP)

```typescript
// 1. Generar/actualizar mapa de navegación
tool "generate_navigation_map" {
  input: { projectId, scope?: "full"|"diff", baselineStageId?, framework? }
}

// 2. Consultar mapa
tool "get_navigation_map" {
  input: { projectId, stageId? }
}

// 3. Impacto en navegación (extensión de validate_before_edit)
tool "check_navigation_impact" {
  input: { projectId, componentPath }
  output: { routes: string[], sharedWith: string[] }
}

// 4. Traducir descripción a archivos (nuevo)
tool "resolve_change_to_files" {
  input: { projectId, description, stageId? }
  output: {
    suggestedFiles: string[],
    affectedRoutes: string[],
    sharedComponents: string[],
    sddImpact: { safe: boolean, warnings: string[] }
  }
}
```

### 7.2 En TheForge (nuevo flujo de entrevista)

El entrevistador es un agente conversacional que:

1. Recibe la descripción inicial del cambio
2. Consulta el navigation map de la etapa base
3. Hace preguntas iterativas (máximo N rondas, configurable)
4. Al final, produce un **alcance estructurado** que alimenta al MDD:

```typescript
interface ChangeScope {
  description: string;
  affectedRoutes: { url: string; screen: string; components: string[] }[];
  affectedEndpoints: { method: string; path: string; change: "add" | "modify" }[];
  newFields?: { component: string; field: string; type: string; validation: string }[];
  sharedComponentsImpacted: string[];
  sddValidation: { safe: boolean; warnings: string[] };
}
```

### 7.3 Transición NEW → LEGACY

```typescript
// En el flujo de inicio de cambio:
async function startChange(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const hasCodebase = await ariadneSpecs.hasIndex(projectId);

  if (project.projectType === "NEW" && hasCodebase) {
    // Ofrecer indexación para cambios legacy
    return {
      suggestion: "Este proyecto ya tiene código indexado. " +
        "¿Quieres activar el flujo legacy para cambios precisos?",
      actions: ["usar legacy desde ahora", "seguir como NEW"],
    };
  }

  if (project.projectType === "NEW" && !hasCodebase) {
    // NEW sin código → flujo greenfield normal
    return { mode: "greenfield" };
  }

  // LEGACY → flujo legacy normal
  return { mode: "legacy" };
}
```

### 7.4 Pipeline de cambio legacy completo

```
USUARIO: "Agregar campo descuento al alta de clientes"
                │
                ▼
┌─────────────────────────────────────┐
│ 1. ENTREVISTA                        │
│    ├── "¿En qué pantalla?"           │
│    ├── ... preguntas ...             │
│    └── ChangeScope estructurado      │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ 2. STAGED DISCOVERY                  │
│    ├── navigation map → componentes  │
│    ├── grafo Ariadne → dependencias  │
│    ├── SDD → contratos + impacto     │
│    └── Síntesis de evidencia         │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ 3. GENERAR DOCUMENTACIÓN             │
│    ├── MDD de cambio                 │
│    ├── Blueprint                     │
│    ├── API Contracts                 │
│    └── Tasks (archivos exactos)      │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ 4. VALIDAR (SDD + NAV MAP)          │
│    ├── validate_before_edit          │
│    ├── check_navigation_impact       │
│    └── "Seguro. No rompe nada."      │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ 5. EJECUTAR (Cursor AI / Agente)    │
│    ├── Lee Tasks + MDD + contratos   │
│    ├── Lee MCP Ariadne (impacto)     │
│    └── Edita archivos quirúrgicamente│
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│ 6. POST-CAMBIO                       │
│    ├── Re-indexar cambios            │
│    ├── Actualizar navigation map     │
│    └── Crear nueva etapa con mapa    │
└─────────────────────────────────────┘
```

## 8. Impacto en el modelo de datos

### 8.1 Prisma (TheForge)

```prisma
model Stage {
  // ... campos existentes ...
  navigationMap String? @db.Text
}
```

### 8.2 AriadneSpecs

Nuevo tool + endpoint para el scanner de navegación.
Extensión de `validate_before_edit` para incluir `navigationImpact`.

## 9. Próximos pasos propuestos

### Fase 1 — Fundamentos

1. Implementar scanner de rutas en AriadneSpecs (React Router + Next.js)
2. Implementar resolutor de componentes con detección de compartidos vs internos
3. Implementar analizador de formularios (estáticos por AST + dinámicos por schema)
4. Agregar campo `navigationMap` a Stage en Prisma
5. Implementar `generate_navigation_map` y `get_navigation_map` como tools MCP

### Fase 2 — Flujo conversacional

6. Implementar agente entrevistador en TheForge (flujo legacy)
7. Integrar navigation map en staged discovery
8. Implementar `resolve_change_to_files` tool

### Fase 3 — Validación y ejecución

9. Extender `validate_before_edit` con `check_navigation_impact`
10. Integrar con el pipeline de Tasks (archivos exactos referenciados)
11. Probar en proyecto legacy real con frontend React + backend NestJS

### Fase 4 — Transición NEW → LEGACY

12. Implementar detección de "proyecto NEW con código"
13. Flujo de indexación bajo demanda al iniciar cambio
14. Probar con proyecto que migra de NEW a LEGACY
