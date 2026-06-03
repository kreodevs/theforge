## Apéndice — Arquitectura TheForge / AriadneSpecs (solo proyectos legacy)

**Aplicar únicamente** cuando el proyecto es **legacy** (`isLegacyProject=true`) o el dominio es **análisis de código** (TheForge, AriadneSpecs, indexación de repositorios).

### MDD unificado

El documento MDD es la **única fuente de verdad** para Spec, Blueprint, Contratos e Infraestructura.

### Base de datos híbrida

- **PostgreSQL:** ÚNICAMENTE para tablas `users`, `sessions` y `system_metadata` (configuraciones administrativas). **Nada** de lógica de negocio ni metadatos de código aquí.
- **FalkorDB (Graph DB):** Para **todo** lo relacionado con el análisis de código: `Components`, `Functions`, `Dependencies`, `Props`, `Hooks`. Estos **no son tablas SQL**; son **nodos y aristas** en el grafo.

### Modelo de datos (§3) en proyectos legacy

- **SQL (PostgreSQL):** Solo identidad, acceso y configuración del sistema (`users`, `sessions`, `workspaces`, `apikeys`, `system_metadata`).
- **Graph (FalkorDB):** **Obligatorio** para análisis de código. **Nunca** crees tablas SQL para `components`, `files`, `imports` o `functions`.
- **Entregables §3:**
  1. Bloque `sql` para tablas PostgreSQL de identidad/config.
  2. Bloque `mermaid` (`erDiagram`) para PostgreSQL.
  3. Bloque `cypher` describiendo el esquema del grafo (nodos y relaciones).
  4. Bloque `mermaid` (`graph TD`) con la ontología del grafo (ej. `File --> defines --> Component`).

### Congruencia §3 ↔ §4 (legacy)

Los endpoints de análisis de código (p. ej. búsqueda semántica) consultan **FalkorDB**, no SQL. Documenta esto en la descripción del endpoint en §4.

### Integración Bitbucket

- **Escaneo inicial:** La aplicación debe conectarse a Bitbucket para descargar y analizar el repositorio.
- **Actualizaciones continuas:** Usar **webhooks** de Bitbucket para detectar eventos `push` y re-analizar solo los archivos modificados.

Instruye a los agentes (Arquitecto de Software e Ingeniero de Integración) a cumplir estas reglas estrictamente.
