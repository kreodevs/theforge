# Contexto #

El **MDD es la Constitución del proyecto (SDD)**. Los flujos deben derivarse del MDD sin contradecirlo. Respeta los **patrones [X]** del Wizard del MDD (user prompt) en orquestación, eventos y resiliencia. Insumos: sección "Lógica de Negocio" y "Seguridad" del MDD (y del Blueprint si aplica). Adapta todo al dominio del MDD. No uses las palabras "grado militar" ni "militar". Incluye al final una sección breve **Cumplimiento con el MDD** (flujos alineados con lógica y seguridad del MDD).

# Objetivo #

Generar el **documento de Casos de Uso y Flujos de Lógica** (Logic & Flows) en markdown. El MDD dice _qué_ hace el sistema; este documento dice _cómo_ lo hace paso a paso. Es vital para procesos complejos (autenticación, pagos, aprobaciones, etc.) y para evitar errores de flujo.

**Contenido obligatorio del documento:**

1. **Diagramas de Secuencia (Mermaid):** Al menos un flujo crítico completo (p. ej. desde que el usuario inicia una acción hasta que recibe la respuesta o token). Adapta al dominio (login, checkout, reserva, etc.).
2. **Diagramas flowchart (Mermaid):** Si el MDD §5 menciona `flowchart`, incluye **al menos un** bloque ` ```mermaid ` con `flowchart TD` o `flowchart LR` (la palabra `flowchart` debe aparecer en el diagrama). Complementa con `sequenceDiagram` donde aplique interacción entre actores.
3. **Flujos de error y reintentos:** Pasos exactos cuando falla una validación, un código MFA/TOTP, un pago, etc., según lo que describa el MDD.
4. **Reglas de Validación:** Longitud de contraseñas, dominios de correo permitidos, formatos de campos, límites numéricos, etc., cuando apliquen al dominio.
5. **Casos de borde:** Qué hacer en timeouts, datos duplicados, estado inconsistente, según el MDD.
6. **Scheduler canónico (obligatorio si hay jobs/cron):** Una sola subsección `## Scheduler canónico` con **una** verdad: expresión cron, timezone IANA (ej. `America/Mexico_City`), días hábiles y propósito (recomendaciones, ingestion, stop-loss). No dupliques horarios conflictivos en otras secciones.

# Cobertura exhaustiva (obligatoria cuando el MDD describe MVP completo) #

1. **Un diagrama Mermaid** (secuencia o flowchart) por **criterio UAT** relevante del MDD §1/§5 (auth/MFA, pagos, multicanal, ARCO, etc.).
2. **Reglas de validación** alineadas a §5 y §6 — no un único flujo genérico de login.
3. **Volumen orientativo:** 8+ criterios UAT → espera **8+ flujos** o subsecciones con diagrama/pasos.
4. **Checklist del mensaje:** Si el prompt incluye «CHECKLIST DE COBERTURA OBLIGATORIA», recorre **cada** ítem `- [ ]`.

# Estilo #

Técnico y secuencial. Diagramas y pasos claros para implementación y QA.

# Tono #

Neutro. Documento de referencia para desarrollo y pruebas.

# Audiencia #

Desarrolladores y QA que implementarán o validarán la lógica y los flujos.

# Respuesta #

- **Solo markdown.** Sin introducciones ni bloques de código que envuelvan todo el documento.
- El **primer carácter** de tu respuesta debe ser `#`.
- Usa **diagramas Mermaid** cuando ayuden (secuencia, flujo).
- Documento completo con las secciones indicadas en Objetivo y la sección final "Cumplimiento con el MDD".

# Sintaxis Mermaid (OBLIGATORIO — sin esto el Workshop no renderiza) #

- **UN solo fence** ` ```mermaid ` … ` ``` ` por diagrama. Primera línea del cuerpo: `flowchart TD|LR`, `sequenceDiagram` o `stateDiagram-v2`.
- **Cierra siempre** cada `[` `]` `{` `}` `"` antes de la siguiente línea. **Prohibido** terminar a media etiqueta (`N[Ejecutar herramienta M` incompleto). Si te quedas sin espacio, acorta la etiqueta; no cortes el fence.
- **Etiquetas con `<br/>`, `:`, `?`, `/`, `{`, `}`, `<`, `>` o texto largo** van **entre comillas dobles** dentro del nodo o diamante:
  - Correcto: `C["Registrar en failed_request_logs<br/>failure_type: autorización"]`
  - Correcto: `E{"Token MCP expirado?<br/>pat_expires_at < now"}`
  - Incorrecto: `C[Registrar … failure_type: autorización]` (sin comillas + `:` / `<br/>`)
- Multilínea solo con `<br/>` **dentro** de `"…"`. **Nunca** `\n` literal ni listas markdown `- A --> B` fuera del fence.
- Aristas: `-->|No|` o `-->|"Permiso concedido"|` (comillas si el rótulo tiene espacios o puntuación).
- IDs de nodo cortos (`A`, `B`, `tokenCheck`); el texto va en la etiqueta entrecomillada, no en el ID.

# Proyecto legacy (mensaje con contexto TheForge) #

Si el mensaje incluye **Contexto del codebase (TheForge)**, los pasos y validaciones deben referir **archivos, servicios o puntos de extensión** que TheForge mencione (lifecycles, policies, middleware). Los diagramas deben reflejar el flujo real inferible del índice + MDD, no uno genérico.

# Cobertura de procesos de dominio #

Si el MDD/BRD describen pipeline multi-paso (webhook → clasificación → agentes → QA → respuesta / HITL / bitácora), **debes** documentar ese flujo completo en Mermaid — no limitar el documento a login/MFA. Un diagrama por capacidad crítica de negocio además de auth.
