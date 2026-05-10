# Legacy Change Pipeline — Análisis de Cobertura

> Mapa completo del pipeline de cambios legacy en TheForge + AriadneSpecs.
> Qué existe, qué falta, qué proponemos y qué brechas quedan.

## 1. El ciclo de vida completo de un cambio legacy

```
┌─────────────────────────────────────────────────────────────────┐
│ 0. ONBOARDING                                                   │
│    Proyecto existente entra al flujo legacy                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. DEFINICIÓN DEL CAMBIO                                        │
│    Usuario describe → sistema entiende qué tocar                │
├─────────────────────────────────────────────────────────────────┤
│ 2. EVIDENCIA DEL CÓDIGO                                         │
│    AriadneSpecs → staged discovery → contexto del cambio        │
├─────────────────────────────────────────────────────────────────┤
│ 3. DOCUMENTACIÓN                                                │
│    MDD → Blueprint → API Contracts → Tasks                      │
├─────────────────────────────────────────────────────────────────┤
│ 4. VALIDACIÓN                                                   │
│    SDD → impacto → breaking changes                             │
├─────────────────────────────────────────────────────────────────┤
│ 5. EJECUCIÓN                                                    │
│    Cursor AI / Agente → código quirúrgico                       │
├─────────────────────────────────────────────────────────────────┤
│ 6. POST-CAMBIO                                                  │
│    Re-indexar → actualizar mapa → nueva etapa                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Análisis detallado por etapa

### Etapa 0: Onboarding (proyecto → legacy)

| Aspecto | Estado | Detalle |
|---|---|---|
| Indexar codebase en AriadneSpecs | ✅ Existe | `legacy_start` + `generate_codebase_doc` |
| Generar navigation map inicial | ❌ No existe | Propuesto en Fase 1 |
| Detectar framework de routing | ❌ No existe | Necesario para navigation map |
| Identificar multi-root (FE/BE separados) | ⚠️ Parcial | Ariadne soporta multi-root, pero el navigation map no |
| Transición NEW → LEGACY automática | ❌ No existe | Propuesto |
| **Cobertura: BAJA** — Falta el onboarding del navigation map y la transición NEW→LEGACY |

### Etapa 1: Definición del cambio

| Aspecto | Estado | Detalle |
|---|---|---|
| Descripción en lenguaje natural | ✅ Existe | `legacy_start` recibe descripción |
| Preguntas predefinidas | ✅ Existe | `legacy_answer` responde preguntas del índice |
| Entrevista conversacional | ❌ No existe | Propuesto: agente que pregunta iterativamente |
| Traducción UI → archivos | ❌ No existe | Depende del navigation map |
| Sugerencia de archivos basada en mapa | ❌ No existe | `resolve_change_to_files` propuesto |
| Confirmación de alcance antes de generar | ❌ No existe | "Esto es lo que entendí, ¿confirmas?" |
| **Cobertura: MEDIA** — La base está, pero la UX conversacional y el mapeo UI→archivos no |

### Etapa 2: Evidencia del código

| Aspecto | Estado | Detalle |
|---|---|---|
| Staged discovery agent | ✅ Existe | Consulta AriadneSpecs por evidencia |
| Búsqueda semántica en el índice | ✅ Existe | `semantic_search` |
| ask_codebase (preguntas al codebase) | ✅ Existe | 3 consultas: qué existe, arquitectura, reglas |
| Contexto de Ariadne (24K→64K chars) | ✅ Acabamos de subirlo | `LEGACY_MDD_THEFORGE_CONTEXT_MAX_CHARS` |
| Validación antes de editar (SDD) | ✅ Existe | `validate_before_edit` |
| Consultar contratos de componentes | ✅ Existe | `get_contract_specs` |
| Consultar impacto legacy | ✅ Existe | `get_legacy_impact` |
| Navigation map como contexto | ❌ No existe | Propuesto: evidencia de UI estructurada |
| Detección de componentes compartidos | ❌ No existe | Navigation map lo resuelve |
| Mapeo campo→endpoint con precisión | ❌ No existe | Propuesto en navigation map |
| **Cobertura: ALTA** — Lo sustancial existe. Navigation map agrega la capa de UI que falta |

### Etapa 3: Documentación

| Aspecto | Estado | Detalle |
|---|---|---|
| MDD de cambio (7 secciones) | ✅ Existe | `legacyGenerateMdd` |
| Blueprint | ✅ Existe | `generateBlueprint` |
| API Contracts | ✅ Existe | `generateApiContracts` |
| Tasks | ✅ Existe | `generateTasks` |
| Casos de uso / User Stories | ✅ Existe | Cascada completa |
| SPEC | ✅ Existe | `generateSpec` |
| Guía UX/UI | ✅ Existe | `generateUxUiGuide` |
| Infraestructura | ✅ Existe | `generateInfra` |
| Límites de contexto para docs grandes | ✅ Acabamos de subirlos | 64K para contexto Ariadne |
| Referencias a archivos exactos en Tasks | ⚠️ Parcial | Mejora con navigation map |
| **Cobertura: ALTA** — La cascada de documentos funciona. Navigation map refina las referencias |

### Etapa 4: Validación

| Aspecto | Estado | Detalle |
|---|---|---|
| validate_before_edit (SDD) | ✅ Existe | Valida contratos de componentes |
| get_legacy_impact | ✅ Existe | Qué se rompe si modificas X |
| check_breaking_changes | ✅ Existe | Breaking changes detection |
| get_contract_specs | ✅ Existe | Contratos actuales del componente |
| Impacto en navegación (otras pantallas) | ❌ No existe | Propuesto: `check_navigation_impact` |
| Validación de componentes compartidos | ❌ No existe | Navigation map lo resuelve |
| **Cobertura: ALTA** — SDD cubre la validación técnica. Falta la validación de impacto en UI |

### Etapa 5: Ejecución (Cursor AI)

| Aspecto | Estado | Detalle |
|---|---|---|
| Documentos generados (MDD, Tasks) | ✅ Existe | Input para Cursor |
| MC P AriadneSpecs disponible | ✅ Existe | Cursor puede consultar |
| SDD tools disponibles | ✅ Existe | Cursor puede validar antes de editar |
| Navigation map como referencia | ❌ No existe | Cursor no tiene mapa de UI |
| Tasks con referencias a líneas exactas | ❌ No existe | Tasks son genéricas, no señalan líneas |
| **Cobertura: MEDIA** — Cursor tiene los documentos y el MCP, pero sin navigation map ni referencias precisas, trabaja con menos información |

### Etapa 6: Post-cambio

| Aspecto | Estado | Detalle |
|---|---|---|
| Persistir nueva etapa con estado | ✅ Existe | `persistLegacyChangeState` |
| Re-indexar cambios en Ariadne | ✅ Existe | Indexación bajo demanda |
| Actualizar navigation map | ❌ No existe | Propuesto |
| Generar diff del mapa entre etapas | ❌ No existe | Propuesto |
| **Cobertura: MEDIA** — La persistencia existe. Falta el ciclo de actualización del mapa |

## 3. Resumen de cobertura actual

| Etapa | Cobertura | Lo que falta |
|---|---|---|
| 0. Onboarding | 🟡 **BAJA** | Navigation map inicial, transición NEW→LEGACY |
| 1. Definición | 🟡 **MEDIA** | Entrevista conversacional, UI→archivos |
| 2. Evidencia | 🟢 **ALTA** | + navigation map como contexto adicional |
| 3. Documentación | 🟢 **ALTA** | + referencias más precisas en Tasks |
| 4. Validación | 🟢 **ALTA** | + impacto en navegación (check_navigation_impact) |
| 5. Ejecución | 🟡 **MEDIA** | + navigation map + referencias precisas |
| 6. Post-cambio | 🟡 **MEDIA** | + actualización automática del mapa |

**Global: 🟡 ALTA/MEDIA** — El pipeline funciona y produce resultados. Las brechas están en la capa de UI y la precisión de las referencias a código.

## 4. ¿Qué falta para cobertura IDEAL?

Si el objetivo es "cambio legacy quirúrgico que no rompa nada", además del navigation map y la entrevista conversacional, identifico estas brechas:

### Brecha A: Precarga del contexto de etapa base

**Hoy:** Cuando empiezas un cambio en Etapa 2, el staged discovery busca en el código actual. **No sabe qué cambió en la Etapa 1.**
**Ideal:** El sistema debería cargar el "diff" entre la etapa base y el código actual para saber qué modificaciones previas existen y no pisarlas.

**Prioridad: MEDIA** — Relevante cuando hay múltiples cambios en paralelo o en serie.

### Brecha B: Tasks con coordenadas exactas

**Hoy:** Las Tasks dicen "Agregar campo X a ClientForm.tsx". No dicen en qué línea, después de qué campo, con qué validación.
**Ideal:** Las Tasks deberían incluir coordenadas: archivo, función, línea, y el cambio exacto (diff).

**Prioridad: ALTA** — Para que Cursor AI ejecute sin ambigüedad.

### Brecha C: Verificación post-ejecución

**Hoy:** No hay verificación de que el código generado realmente implemente lo que el MDD especifica.
**Ideal:** Tras la ejecución, un agente compararía el código modificado contra el MDD y el Blueprint para verificar conformidad.

**Prioridad: MEDIA** — Evitaría desviaciones entre docs y código.

### Brecha D: Pruebas y rollback

**Hoy:** No hay integración con tests ni plan de rollback.
**Ideal:** Cada cambio debería incluir: "estos tests existen y deben seguir pasando", "si algo falla, se revierte con git revert".

**Prioridad: BAJA** — Valioso pero no bloqueante.

### Brecha E: Auth y permisos en el cambio

**Hoy:** Si el cambio agrega un campo que solo admins pueden ver/edit, el sistema no lo sabe.
**Ideal:** El navigation map podría incluir metadata de acceso (roles, permisos) y el MDD documentar restricciones.

**Prioridad: BAJA** — Depende del proyecto.

## 5. Mapa de ruta propuesto

### Fase 1 (corto plazo) — Navigation map + entrevista

```
┌──────────────────────────────────────────────────┐
│ 1. Scanner de rutas (AriadneSpecs MCP)           │
│    React Router + Next.js → rutas → componentes  │
├──────────────────────────────────────────────────┤
│ 2. Analizador de formularios                     │
│    inputs estáticos + schemas dinámicos          │
├──────────────────────────────────────────────────┤
│ 3. Detección de componentes compartidos          │
│    "quién más usa este componente"                │
├──────────────────────────────────────────────────┤
│ 4. Entrevista conversacional (TheForge)          │
│    preguntas → alcance → confirmación            │
├──────────────────────────────────────────────────┤
│ 5. resolve_change_to_files tool                  │
│    descripción → archivos concretos              │
└──────────────────────────────────────────────────┘
```

### Fase 2 (mediano plazo) — Precisión + validación

```
┌──────────────────────────────────────────────────┐
│ 6. check_navigation_impact                       │
│    "modificar X afecta estas N rutas"            │
├──────────────────────────────────────────────────┤
│ 7. Tasks con coordenadas exactas                 │
│    archivo:función:línea + diff sugerido         │
├──────────────────────────────────────────────────┤
│ 8. Precarga de contexto de etapa base            │
│    diff entre etapas para cambios incrementales  │
├──────────────────────────────────────────────────┤
│ 9. Transición NEW → LEGACY                       │
│    detección automática + indexación             │
└──────────────────────────────────────────────────┘
```

### Fase 3 (largo plazo) — Verificación + ciclo completo

```
┌──────────────────────────────────────────────────┐
│ 10. Verificación post-ejecución                  │
│     código real vs especificación                │
├──────────────────────────────────────────────────┤
│ 11. Integración con tests                        │
│     "estos tests existen y deben pasar"          │
├──────────────────────────────────────────────────┤
│ 12. Rollback plan                                │
│     git revert + nueva etapa de rollback         │
└──────────────────────────────────────────────────┘
```

## 6. Conclusión

**¿Podemos trabajar cambios legacy HOY?** Sí, el pipeline funciona. La calidad depende de:

- Qué tan bien AriadneSpecs indexó el codebase (con los límites nuevos, mejor)
- Qué tanto conoce el usuario los archivos a modificar
- Qué tanto acierta el staged discovery con búsqueda semántica

**¿Podemos producir código que no rompa nada HOY?** Parcialmente. SDD detecta breaking changes a nivel de contratos de componentes, pero no hay validación a nivel de "esta pantalla usa este componente compartido y lo vas a romper".

**El navigation map es el habilitador faltante.** Sin él, la capa de UI es un punto ciego. Con él:

- La entrevista puede preguntar sobre pantallas concretas
- El staged discovery traduce "alta de clientes" a `/clients/new`
- La validación detecta impacto en componentes compartidos
- Las Tasks referencian archivos exactos
- Cursor AI ejecuta con precisión quirúrgica

**Mi recomendación:** Arrancar Fase 1 (navigation map) como prioritario, y dentro de esa fase, el scanner de rutas + detección de componentes compartidos como primer entregable. Eso solo ya sube la cobertura de UI de 0 a ALTA.
