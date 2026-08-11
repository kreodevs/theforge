# Plantilla — secciones §0, §8, §9 y §10 del MDD

Referencia para agentes cuando existe `paso0/decisions.catalog.json`.
Completar tras §7; no sustituye las 7 secciones canónicas (§1–§7).

---

## [ARQUITECTURA — SECCIÓN INMUTABLE] CONFIGURACIÓN DE PATRONES DE DESARROLLO

> Insertar **antes de §1** en el merge final (`prepare_output`). SSOT de patrones activos y descartados.

### Patrones activos (SSOT)

#### 🏛️ 1. Arquitectura global y distribuida
- [X] **Arquitectura Hexagonal (Ports & Adapters)** — aísla el dominio de adaptadores de aplicación productora, persistencia y transporte (D-002).
- [X] **Monolito Modular** — una unidad de despliegue con módulos de negocio separados (D-111).
- [X] **Event-Driven Architecture (EDA)** — recepción asíncrona de eventos de negocio (D-080).

#### 🔌 2. Estructurales (GoF)
- [X] **Facade** — interfaz unificada por superficie de cliente.
- [X] **Adapter** — un adaptador por aplicación productora; traduce su semántica al contrato canónico (D-115, D-005).

#### 🧠 3. Comportamiento (GoF)
- [X] **Observer / Pub-Sub** — distribución de actividad en tiempo real (D-126).
- [X] **State** — máquinas de estado de adjunto (cuarentena), invocación de agente y trabajo de migración.

#### 💾 4. Persistencia y datos
- [X] **Repository** y **Data Mapper** — independencia del dominio respecto del motor (D-162).
- [X] **Soft Delete / Tombstone** — toda eliminación es lógica (D-023, D-136).

#### 🛡️ 5. Integración, APIs y resiliencia
- [X] **API Gateway** — punto único de entrada, autenticación y rate limiting.
- [X] **BFF (Backend For Frontend)** — superficies embebida, central y móvil (D-123, D-044, D-078).
- [X] **Circuit Breaker** — protege frente a degradación de dependencias externas.
- [X] **Outbox Pattern** — publicación confiable de eventos (D-010).
- [X] **Idempotent Receiver** — deduplicación por `source_application + event_id` (D-080).

#### ❌ Patrones explícitamente descartados

| Patrón | Motivo |
|---|---|
| **Strangler Fig** | Implica convivencia legado/nuevo. **D-121** descarta convivencia operativa: corte por campaña. |
| **Multi-tenancy** | **D-095** clasifica `tenant_id` como frontera futura; el eje MVP es `application_id` (D-093). |
| **CQRS / Event Sourcing** | Sin decisión que lo respalde; volumen inicial no lo justifica (A-006). |

---

## 8. UI/UX Design Intent

> Obligatorio cuando el catálogo Paso 0 define superficies o restricciones de experiencia.

### 8.1 Superficies

| Superficie | Alcance | Regla | D-IDs |
|------------|---------|-------|-------|
| Componente embebido | Una aplicación | Muestra solo conversaciones de esa aplicación | D-123, D-028 |
| Aplicación central | Multiaplicación | Agrega conversaciones autorizadas sin bypass de aislamiento | D-044 |
| Cliente móvil | En línea | Sin historial offline ni acciones diferidas | D-087 |

### 8.2 Composición y estados

- Estados `loading`, `empty` y `error` en vistas con datos remotos.
- Accesibilidad WCAG AA; objetivo táctil ≥ 44×44 px.
- Restricciones de presencia, descubrimiento, etc. según D-IDs del catálogo.

### 8.3 Fuera de alcance de la UI

Listar explícitamente pantallas o flujos que **no** se construyen (alineado a `outOfScope` del catálogo).

---

## 9. Trazabilidad

> Obligatorio cuando existe catálogo Paso 0. Generar con:
> `npm run generate:paso0-section9` o validar con `npm run validate:paso0-coverage`.

### 9.1 Cobertura de decisiones vigentes

| Grupo D-ID | Dónde se materializa en este MDD | Cobertura |
|------------|----------------------------------|-----------|
| D-002, D-004 | §1, §3 `contexts` | ✓ |
| … | … | … |

### 9.2 Exclusiones verificables

Este MDD **no contiene**: (términos, entidades o patrones explícitamente excluidos en Paso 0).

### 9.3 Resumen

- Decisiones obligatorias en MDD: **N/N** (derivar de `npm run validate:paso0-coverage` → `stats.mvp_decision_ids_in_mdd/total`)
- Si cobertura 100 %: «Cobertura completa: todas las decisiones MVP y confirmadas referenciadas en §0–§8»
- Si hay brecha: listar D-IDs ausentes (escaneo excluye §9 y §10 para evitar auto-referencia)

### 9.4 Exclusiones verificables

Revisar que el MDD no materializa capacidades marcadas como fuera de alcance en Paso 0.

---

## 10. Registro de cambios

> Append **después de §9** en `prepare_output` y tras remediación.

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | — | Versión inicial desde Paso 0 / pipeline SDD Cursor-native. |
| **2.0** | **YYYY-MM-DD** | Regeneración con §0 patrones inmutables, cobertura Paso 0 completa y §9 sincronizado con validador. |
