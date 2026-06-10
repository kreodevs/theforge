# integration-spec-prompt.md (v1 — alineado al repo)
# Generador del Integration Spec — The Forge

## Objetivo
Generar el **Integration Spec**: el contrato de integración entre este sistema y sus
sistemas colindantes (SSO, ERPs, webhooks, colas, terceros, consumidores).
Regla de frontera: **Integration Spec = qué hablan los sistemas entre sí;
Infra = dónde y cómo corren** (Dockerfile, compose, env, CI/CD siguen en Infra).
**No dupliques Flujos de lógica**: logic-flows cubre la lógica interna del producto;
aquí solo van secuencias que CRUZAN una frontera de sistema.

## Inputs
1. **MDD** (fuente primaria). Anclas de lectura — por TÍTULO de sección/subsección,
   nunca por numeración literal (la numeración de §7 varía entre MDDs reales):
   - §1 Contexto: sistemas colindantes / mapa de contextos / fuentes externas.
   - §4.B "Integraciones externas" (si existe): referencias de contrato, auth, límites.
   - §7: subsecciones cuyo título refiera a *flujo de integración*, *resiliencia*,
     *reintentos*, *circuit breaker*, *seguridad de transporte* (o el JSON
     `integracion.subsections` del pipeline si está disponible).
   - Sección inmutable SSOT: patrones marcados [X]. Si un patrón aplica a una frontera
     (Adapter, Circuit Breaker, Saga), declara DÓNDE se materializa; no fuerces los
     que no apliquen.
2. **Blueprint** (si existe).
3. **API Contracts** (OPCIONAL — puede no existir aún en la cascada). Si existe,
   referencia sus endpoints de frontera; si no, deriva solo de MDD §4.B. No redefinas
   endpoints internos en ningún caso.

# Si el proyecto es LEGACY (modo legacy-coordinator)
La evidencia de codebase es casi obligatoria: usa los bloques "Contexto del codebase
(TheForge)" y `get_contract_specs`. Toda afirmación sobre el sistema existente lleva
`archivo:línea` o referencia al documento de Ariadne. Lo no respaldado se marca
`NO VERIFICABLE` + qué insumo lo cierra.

# Si el proyecto es NEW
La evidencia es el propio MDD (`MDD §X` por título). Marca `NO VERIFICABLE` solo los
supuestos sobre sistemas externos reales (políticas de reintento de un ERP, claims de
un SSO corporativo) que el MDD afirma sin fuente.

# Si NO hay integraciones externas
Si §1 no nombra sistemas colindantes y no existe §4.B: genera el **ISD mínimo** —
solo Metadata con clasificación "Sin integraciones externas" y la sección Cumplimiento
con una fila "No aplica ☑". No inventes fronteras, no generes ruido, no bloquees nada.

## Reglas (obligatorias)
- No inventes comportamiento de sistemas externos. Evidencia o marca, nunca supuesto.
- Ambigüedad de diseño → `[NEEDS CLARIFICATION]` con pregunta concreta + responsable.
- Hueco o contradicción EN EL MDD (entidad sin mecanismo de alimentación, flujo sin
  endpoint, supuesto sin fuente): NO lo arregles aquí. Regístralo como DISCREPANCIA
  con destino "corrección al MDD" (mismo modelo que `propose_mdd_amendment`).
- Distingue tres tipos de frontera: (a) nos llaman (webhooks/consumidores),
  (b) llamamos (terceros), (c) identidad transversal (SSO). Política distinta cada una.
- Auth: SOLO autenticación ENTRE sistemas (M2M, mTLS, API keys, client credentials).
  Auth de usuarios, MFA y RBAC → "ver MDD §6", no se repite aquí.
- No dupliques el MDD: referencia y agrega solo lo que el MDD no operacionaliza
  (headers exactos, semántica de errores por frontera, orden de dependencias de datos).

## Secciones obligatorias del documento

El documento generado inicia con H1: `# Integration Spec — {nombre del proyecto}`.

### 0. Metadata
Proyecto, clasificación (greenfield / brownfield / híbrido / sin integraciones),
sistemas colindantes, fuentes de evidencia, versión del MDD del que deriva.
(Sin campo de estado propio: el estado del proyecto lo gobierna el semáforo del Stage;
si la sección 9 tiene bloqueantes, decláralo ahí, no como workflow paralelo.)

### 1. Mapa de sistemas
Inventario de TODO sistema colindante nombrado en §1/§4.B del MDD. Por sistema:
dirección (entrante/saliente/bidireccional), rol (fuente de verdad / consumidor /
identidad / tercero), protocolo, dueño organizacional. Diagrama de contexto
(mermaid graph) solo sistemas y direcciones.

### 2. Ownership de datos en la frontera
Tabla: dato compartido | sistema dueño | qué hace el otro lado.
Un solo dueño por dato; zona gris → `[NEEDS CLARIFICATION]`.

### 3. Contratos por frontera
Una subsección por sistema. Por interacción: tipo (REST / webhook / evento / archivo /
polling), payload como bloque ```json inline (sin OpenAPI/YAML raw, igual que
api-contracts), headers requeridos, códigos de respuesta con semántica EXACTA
(ej. "duplicado idempotente → 200 {duplicado:true}, no 409"), auth de esa frontera
(credencial/claims exactos), versionado y retrocompatibilidad.

### 4. Secuencias de integración
Un mermaid sequenceDiagram por flujo que cruza frontera. Disparador, camino feliz y
TODOS los caminos de error con lo que ve el sistema externo en cada fallo.
Si un flujo ya está en logic-flows, referéncialo y dibuja SOLO el tramo entre sistemas.

### 5. Mapeo interacción ↔ sistema
Tabla maestra: endpoint o evento | dirección | origen | destino | auth | clave de
idempotencia | contrato (§3.x). Debe cubrir todas las integraciones de §4.B y los
endpoints de frontera identificados.

### 6. Resiliencia por frontera
Tabla por sistema: timeout | retries (n, backoff) | circuit breaker | fallback |
DLQ o reconciliación | alertas. Derivada de las subsecciones de resiliencia del MDD,
completando lo faltante. Toda secuencia de §4 debe tener fila.

### 7. Orden de habilitación y reversa
Solo el ORDEN lógico y sus dependencias de datos (qué catálogos deben existir antes de
habilitar qué webhook; qué frontera se corta primero en rollback y qué no debe
romperse). La mecánica de despliegue es de Infra.

### 8. Cumplimiento con el MDD
Tabla: ítem del MDD (sistemas de §1, integraciones de §4.B, subsecciones de
flujo/resiliencia de §7) | cubierto en sección | ☑/☐. Insumo del conformance.
En proyectos sin integraciones: una fila "No aplica ☑".

### 9. Discrepancias y pendientes (lista viva)
- DISCREPANCIAS: huecos del MDD detectados → destino "corrección al MDD" + severidad
  (bloqueante de diseño / documental).
- PENDIENTES: tabla de `[NEEDS CLARIFICATION]` / `NO VERIFICABLE` con pregunta,
  responsable y qué desbloquea.
Esta sección alimenta el semáforo del Stage; no introduce compuerta propia en v1.

## Convenciones de salida
- Markdown puro en un solo documento (campo `integrationSpecContent`). Schemas inline
  en bloques ```json; nada de archivos externos ni carpetas `contracts/` en v1.
- Tono declarativo: el ISD es contrato; el análisis vive en la sección 9.
- Changelog: NO lo generes manualmente — lo inyecta `withDocumentChangelogInstructions`.
- Termina el documento con el marcador: ---FIN_INTEGRATION_SPEC---
- En chat con actualización del documento, termina igualmente con
  ---FIN_INTEGRATION_SPEC--- (mismo comportamiento que la generación one-shot).

---

# Anexo: checkIntegrationSpecVsMdd (heurístico, mismo patrón que check*VsMdd)

Validaciones estructurales (sin LLM, implementables con el motor actual):
1. **Cobertura de sistemas:** extraer nombres de sistemas de MDD §1 y §4.B (títulos +
   negritas + filas de tabla); cada uno debe aparecer textualmente en ISD §1.
2. **Cobertura de integraciones:** cada referencia de contrato listada en §4.B debe
   tener subsección en ISD §3. (Cobertura del §5 del ISD = presencia textual de la
   interacción de §4.B en la tabla; NO se valida el tipo de auth — el parser actual
   no distingue M2M vs JWT.)
3. **Cobertura de flujos:** por keywords/títulos en §7 del MDD (*flujo de integración*,
   *webhook*, *cron externo*, *circuit breaker*) — cada señal debe tener secuencia en
   ISD §4 o fila en ISD §6. No asumir numeración §7.1 literal.
4. **Resiliencia completa:** toda secuencia de ISD §4 tiene fila en ISD §6 (conteo).
5. **Sin huérfanos:** todo contrato de ISD §3 referencia un sistema de ISD §1.
6. **Caso N/A:** si el MDD no tiene §4.B ni colindantes en §1, el ISD mínimo con
   "No aplica ☑" pasa conformance; cualquier ISD largo sin fuentes en el MDD falla
   (sobre-generación).

Validación LLM opcional (`?useLlm=true`, mismo patrón existente):
- ¿Supuestos sobre sistemas externos sin evidencia ni marca?
- ¿Políticas de §6 del ISD contradicen edge cases del MDD §5?
- ¿El ISD redefine contenido que pertenece al MDD, a Infra o a logic-flows?

Nota de producto (fuera de v1): el gate "Tasks bloqueada por §9 bloqueante" es decisión
nueva — hoy Tasks se bloquea por complexityPending/blueprintDataModel. En v1, la
sección 9 solo informa al semáforo del Stage. Si se adopta el gate después: aplica
únicamente en cascada HIGH/NEW con §4.B presente; en LOW y en proyectos sin
integraciones, ISD es N/A y nunca bloquea.
