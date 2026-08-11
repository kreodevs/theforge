# {Nombre del producto} — Domain Benchmark & Gap Analysis

**Estado:** borrador / definitivo del Paso 0.
**Propósito:** material fuente único para Spec, MDD y gates locales.
**No es:** PRD final, SDD, backlog, runbook ni compromiso contractual.

---

## 1. Reglas de lectura y gobierno

### 1.1 Qué es y qué no es este documento

Las decisiones vigentes son filas con tipo **Decisión confirmada** y vigencia **Vigente**.
Toda capacidad, riesgo y regla lleva su **identificador D-XXX**, **tipo de afirmación** y **regla** (Genérica / Específica / Genérica validada primero).

### 1.2 Tipos de afirmación

| Tipo | Significado |
|------|-------------|
| Decisión confirmada | Regla aprobada. Vinculante. |
| Inferencia aceptada | Conclusión derivada. No vinculante. |
| Propuesta | Opción para validación posterior. |
| Supuesto | Condición por validar. |
| Pregunta abierta | Bloqueante hasta resolver. |

### 1.3 Clasificaciones de capacidad

Solo: `MVP`, `Preparación arquitectónica`, `Posterior al MVP`, `Fuera de alcance`, `Pendiente de decisión`.

---

## 2. Síntesis ejecutiva

- **Problema:** …
- **Propuesta de valor:** …
- **MVP:** …
- **Fuera de alcance explícito:** …

---

## 3. Visión, problema y límites

### 3.1 El problema

…

### 3.2 Límites del producto

…

---

## 4. Decisiones (registro D-ID)

| ID | Tipo | Clasificación | Regla | Afirmación |
|----|------|---------------|-------|------------|
| D-001 | Decisión confirmada | MVP | Genérica | … |

---

## 5. Capacidades MVP

| Capacidad | D-IDs | Clasificación | Notas |
|-----------|-------|---------------|-------|
| … | D-001 | MVP | … |

---

## 6. Fuera de alcance

| Ítem | D-IDs | Motivo |
|------|-------|--------|
| … | D-00N | … |

---

## 7. Glosario (Ubiquitous Language)

| Término | Definición | D-IDs |
|---------|------------|-------|
| … | … | D-001 |

---

## 8. Riesgos y supuestos

| ID | Riesgo / supuesto | Mitigación |
|----|-------------------|------------|
| R-001 | … | … |

---

## 9. Sincronización con catálogo

Tras editar este documento, actualizar `paso0/decisions.catalog.json` para que `decisions`, `mvpCapabilities`, `entities` y `outOfScope` reflejen los D-IDs de las tablas anteriores.
