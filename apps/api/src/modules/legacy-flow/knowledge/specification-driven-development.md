# Specification-Driven Development and the Evolution of AI Engineering

Base de conocimiento para el flujo legacy (derivado del cuaderno "Specification-Driven Development and the Evolution of AI Engineering").

## Principios

- **Spec como fuente de verdad:** La especificación (what/why) guía la arquitectura, casos de uso, historias y tareas. En legacy, el "MDD de cambio" actúa como spec del cambio.
- **Cascada controlada:** Constitution (MDD) → Spec → Plan (Blueprint) → Casos de uso → Historias (DoD) → Guía UX/UI → API → Flujos → Infra → Tasks. Cada etapa consume la anterior y produce entrada para la siguiente.
- **Reutilización de generadores:** Los mismos generadores (Spec, Architecture, etc.) pueden invocarse como librería con contexto distinto (nuevo vs cambio en legacy); el flujo y el orquestador son distintos.
- **Trazabilidad:** Mantener vínculos entre entregables (el MDD de cambio referencia archivos/componentes; la SPEC de cambio referencia el MDD).

## Estructura canónica del MDD (Constitución)

Según SDD, la **Constitución** del proyecto (MDD) debe cubrir: **qué/por qué** (Contexto), **cómo a nivel técnico** (Arquitectura, Modelo, Contratos, Lógica) y **requisitos no funcionales** (Seguridad, Infra). El MDD se genera con **exactamente siete secciones** en este orden:

| # | Sección | Contenido |
|---|---------|-----------|
| 1 | Contexto | Alcance, fronteras, audiencia, propósito (qué/por qué). |
| 2 | Arquitectura y Stack | Tecnologías, patrones, subsección Frontend si aplica. |
| 3 | Modelo de Datos | Entidades, SQL, diagrama ER, TechnicalMetadata. |
| 4 | Contratos de API | Endpoints, métodos, request/response, tabla resumen. |
| 5 | Lógica y Edge Cases | Reglas de negocio, validaciones, casos borde. |
| 6 | Seguridad | Políticas, MFA, RBAC, hashes, auditoría. |
| 7 | Infraestructura | Variables de entorno, CI/CD, Docker, manifest. |

Cualquier documento MDD (proyecto nuevo o MDD de cambio legacy) debe seguir esta estructura. Los agentes (Clarifier, Software Architect, Security, Integration, Auditor) rellenan cada sección según la matriz de delegación; el estimador y el semáforo validan las 7 secciones.

## Aplicación al flujo legacy

- Generar **MDD de cambio** primero; desde ahí disparar la cascada de entregables con contexto TheForge (archivos, contratos, impacto).
- El MDD de cambio aplica la misma estructura de 7 secciones, describiendo **el cambio** (qué se modifica en contexto, modelo, API, lógica, seguridad, infra) en lugar de un sistema desde cero.
- No mezclar el flujo de producto nuevo (Paso 0, Benchmark, Manager) con el de legacy.
