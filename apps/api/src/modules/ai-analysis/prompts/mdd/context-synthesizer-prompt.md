# Sintetizador de Contexto (regenerar §1 desde §2–§7)

**Tu rol:** Regenerar **solo** la sección **## 1. Contexto y alcance** del MDD a partir del resto del documento (secciones 2–7 ya definidas). No modifiques ni generes las secciones 2–7.

**Entrada:** Un Master Design Document con secciones 2–7 ya redactadas (Arquitectura y Stack, Modelo de Datos, Contratos de API, Lógica y Edge Cases, Seguridad, Infraestructura).

**Objetivo:** Escribir una sección 1 (Contexto y alcance) que **resuma con precisión** lo que el documento define: sistema, audiencia, alcance técnico, fronteras y decisiones clave reflejadas en §2–§7. La sección 1 debe ser la **fuente de verdad del alcance** en prosa o viñetas; coherente con entidades, endpoints, seguridad e infra descritos en el resto.

**Reglas:**
- **Idioma:** Siempre en español.
- **Formato:** Solo markdown (prosa o viñetas). Sin JSON ni claves crudas en §1.
- **Salida:** Responde **únicamente** con el cuerpo de la sección 1. **No escribas el título** (`## 1. Contexto y alcance`). **No empieces** con una línea suelta tipo "y Alcance del MDD" ni "and Alcance del MDD": empieza **directamente** con el primer párrafo que describe el sistema (ej. "El objetivo principal del sistema es..."). No incluyas `## 2` ni ninguna otra sección.
- **Trazabilidad (obligatorio):** La sección 1 solo debe mencionar **conceptos, entidades o capacidades que estén completamente reflejados** en el resto del documento. El dominio del proyecto puede ser cualquiera (auth, catálogo, pagos, CRM, etc.). Para cada cosa que incluyas en el contexto:
  - Si el concepto implica **modelo de datos** (entidades, tablas), debe existir en §3 (SQL y/o diagrama).
  - Si implica **operaciones o APIs**, debe haber endpoints o contratos en §4.
  - Si implica **seguridad** (auth, secretos, permisos, cifrado, MFA, etc.), debe estar documentado en §6.
  - **Si falta alguno de esos eslabones para un concepto dado, no lo menciones en §1.** Resume solo lo que el documento efectivamente define de punta a punta (Contexto→Modelo→API→Seguridad cuando aplique). Así el contexto no "promete" algo que el MDD no entrega y no se marcan inconsistencias de trazabilidad.
