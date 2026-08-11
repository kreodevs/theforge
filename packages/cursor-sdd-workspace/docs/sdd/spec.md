# Especificación funcional — Workspace Chat

**Versión:** 1.0  
**Fecha:** 11 de agosto de 2026  
**Estado:** aprobada para diseño MDD  
**Fuentes:** `paso0/domain-benchmark.md`, `paso0/decisions.catalog.json`, `WORKFLOW.yaml`

> Especificación **funcional** (qué y por qué). Sin stack tecnológico — ver MDD §2.

---

## 1. Propósito y visión

Workspace Chat es una **plataforma corporativa de comunicación contextual multiaplicación** (D-002).
Relaciona una aplicación consumidora con un contexto de negocio y sus temas mediante
`application + contextType + contextId` (D-004). Personas, sistemas, integraciones, bots y
agentes comparten una **cronología unificada** de actividad humana y automática (D-006),
mientras el sistema productor conserva el estado oficial del objeto de negocio (D-128).

El diferenciador no es la mensajería genérica: es que la actividad automática y la conversación
humana comparten una línea de tiempo **verdadera** adherida al objeto de negocio — ningún
productor emite antes de persistir (D-141).

**Primer caso de uso:** OBP (campañas). Las reglas específicas OBP no se incorporan al núcleo
universal (D-005).

---

## 2. Problema y objetivos

| # | Problema | Objetivo funcional | D-ID |
|---|----------|-------------------|------|
| 1 | Conversación de campaña separada del objeto de negocio | Cronología adherida al contexto | D-002, D-007 |
| 2 | Avisos antes de persistencia; reglas repartidas | Eventos post-persistencia e invariante de confiabilidad | D-141, D-080 |
| 3 | Dependencia de suites de mensajería externas | Núcleo reutilizable por contrato y configuración | D-002, D-133 |

---

## 3. Actores y roles funcionales

| Actor / rol | Facultades principales | D-ID |
|-------------|------------------------|------|
| Administrador global (gerencia) | Alta de aplicaciones, aprobación break-glass, exclusiones migración | D-133, D-151 |
| Seguridad/Compliance (gerencia) | Legal holds, exportaciones, auditoría | D-153 |
| Administrador de aplicación | Configuración y recuperación de contextos huérfanos | D-085 |
| Soporte/TI | Diagnóstico técnico, metadata operativa | D-082 |
| Administrador contextual | Participantes, roles, etiquetas, archivado de su contexto | D-018, D-158 |
| Miembro | Publica, reacciona, adjunta, menciona, busca en su alcance | D-155 |
| Miembro solo lectura | Consulta sin publicar ni modificar | D-084 |
| Aplicación productora | Emite eventos e intents con credencial propia | D-135, D-141 |
| Agente externo MCP | Consulta explícita de solo lectura con scopes propios | D-103 |

**Ningún rol administrativo concede lectura automática de mensajes** (D-082).

---

## 4. Requisitos funcionales

### RF-001 — Núcleo contextual multiaplicación

**D-IDs:** D-002, D-004

El sistema relaciona aplicación, tipo de contexto e identificador externo para agrupar temas y cronología.

### RF-002 — Alta y gobierno de aplicaciones consumidoras

**D-IDs:** D-133, D-134, D-135, D-145

Un administrador global registra aplicaciones con responsable funcional, políticas predeterminadas, retención, E2EE por defecto, orígenes autorizados y capacidades modulares.

### RF-003 — Identidad corporativa y scopes

**D-IDs:** D-003, D-082, D-151

Las personas se autentican exclusivamente vía SSO Integral; los scopes de plataforma se separan y no conceden lectura automática de contenido.

### RF-004 — Membresía contextual e histórica

**D-IDs:** D-016, D-022, D-084, D-155

La participación en contextos y temas se registra explícitamente; los roles member, read_only y context_admin determinan capacidades.

### RF-005 — Contextos, temas y privacidad

**D-IDs:** D-011, D-014, D-045, D-081, D-136, D-137

Todo contexto tiene tema General; los temas manuales fijan privacidad con el primer mensaje; los contextos se archivan, nunca se eliminan.

### RF-006 — Mensajería y subconversaciones

**D-IDs:** D-124, D-047, D-053, D-054, D-055, D-158

Publicación, edición y eliminación lógica auditada; subconversaciones, mensajes programados, fijados, menciones y etiquetas de mención.

### RF-007 — Ingesta de eventos de negocio

**D-IDs:** D-080, D-025, D-141, D-115

Recepción idempotente post-persistencia del productor; eventos inmutables en Chat; sin bloqueo del negocio ante caída de Chat.

### RF-008 — Adjuntos y cuarentena

**D-IDs:** D-125, D-086, D-092

Carga con validación MIME, cuarentena antimalware obligatoria; en E2EE sin procesador confiable no se admiten adjuntos.

### RF-009 — Realtime y notificaciones

**D-IDs:** D-126, D-030, D-061

Distribución de actividad, contadores de no leídos e intenciones de notificación hacia el Hub corporativo sin filtrar privacidad.

### RF-010 — Búsqueda gobernada

**D-IDs:** D-031, D-157, D-160

Búsqueda acotada por aplicación y membresía; en cliente central exige selección de aplicación; sin descubrimiento abierto.

### RF-011 — E2EE configurable

**D-IDs:** D-089, D-091, D-092, D-131, D-132

Política fijada antes del contenido; dispositivos registrados; procesadores confiables; recuperación corporativa con servicio de llaves.

### RF-012 — Retención, legal hold y exportación

**D-IDs:** D-098, D-099, D-153

Cinco capas de retención; purga verificable; legal holds; exportaciones gobernadas por Seguridad/Compliance.

### RF-013 — Break-glass

**D-IDs:** D-083, D-150, D-151

Elevación excepcional con aprobación jerárquica distinta, motivo, ventana temporal y auditoría; no descifra E2EE por sí mismo.

### RF-014 — Agente externo MCP

**D-IDs:** D-103, D-104, D-106, D-108

Invocación explícita de solo lectura con doble autorización; prohibido durante break-glass; membresía técnica en temas privados no E2EE.

### RF-015 — Administración y analítica

**D-IDs:** D-058, D-109, D-161

Consola separada de la app central; métricas agregadas sin contenido de temas privados o E2EE.

### RF-016 — Migración OBP/Teams

**D-IDs:** D-119, D-120, D-121, D-154

Migración por campaña sin convivencia permanente; historial disponible; exclusiones explícitas por gerencia.

### RF-017 — Experiencias de cliente

**D-IDs:** D-028, D-044, D-078, D-087, D-123

Cliente embebido aislado por aplicación; aplicación central multiaplicación sin bypass; móvil solo en línea.

### RF-018 — Rich cards y acciones

**D-IDs:** D-057

Representación estructurada de eventos de negocio con acciones acotadas al alcance.

### RF-019 — Auditoría inmutable

**D-IDs:** D-098, D-099

Registro append-only de acciones relevantes con retención de evidencia de 2 años.

### RF-020 — Invariante de confiabilidad del productor

**D-IDs:** D-141, D-143

Obligación contractual de persistir antes de emitir; Chat no ejecuta acciones automáticas ante incumplimiento detectado.

---

## 5. Requisitos no funcionales (sin stack)

| ID | Requisito | D-ID |
|----|-----------|------|
| RNF-001 | Aislamiento estricto por aplicación consumidora sin bypass | D-093, D-044 |
| RNF-002 | Cronología verdadera: productor persiste antes de emitir | D-141 |
| RNF-003 | Indisponibilidad de Chat no bloquea operación del productor | D-009, D-141 |
| RNF-004 | Privacidad de tema fijada con primer mensaje, irreversible | D-081 |
| RNF-005 | Contextos archivables, nunca eliminables físicamente | D-136 |
| RNF-006 | Adjuntos en cuarentena hasta análisis antimalware clean | D-086 |
| RNF-007 | E2EE opcional con recuperación corporativa administrada | D-131, D-091 |
| RNF-008 | Retención por cinco capas con legal hold | D-098 |
| RNF-009 | Auditoría append-only 2 años | D-098 |
| RNF-010 | Analítica agregada sin contenido de privados/E2EE | D-109, D-161 |
| RNF-011 | Cliente móvil solo en línea, sin cola offline | D-087, D-088 |
| RNF-012 | Sin descubrimiento abierto ni solicitud de acceso | D-160 |

---

## 6. Fuera de alcance

| Exclusión | D-ID |
|-----------|------|
| Multi-tenancy como eje de aislamiento | D-095 |
| Chat corporativo general, DMs, grupos, canales | D-073 |
| Llamadas, videollamadas, pantalla compartida | D-074 |
| Tickets, SLA, workflow de resolución | D-015, D-097 |
| Autenticación propia (registro, contraseña, MFA) | D-003 |
| Presencia, escritura, confirmaciones de lectura | D-159 |
| Historial y acciones móviles offline | D-088 |
| Derechos del titular como capacidad del producto | D-140 |
| Fusión/división de contextos | D-138 |
| Teams/Slack como canal permanente | D-070, D-121 |

---

## 7. Familias de API obligatorias (referencia funcional)

| Familia | Descripción | Rutas | Métodos | D-ID |
|---------|-------------|-------|---------|------|
| ingest-events | Ingesta idempotente de eventos | /ingest/events | POST | D-080, D-141 |
| attachments | Adjuntos con cuarentena | /attachments | POST, GET | D-125, D-086 |
| break-glass | Acceso break-glass | /break-glass-requests, /break-glass | POST, GET | D-083, D-150, D-151 |
| realtime-ws | Conexión WebSocket realtime | /ws | GET | D-126 |
| migration | Migración OBP / Teams | /migration-jobs | POST, GET | D-119, D-121, D-154 |
| applications | Alta y gobierno de aplicaciones | /applications | POST, GET, PATCH | D-133, D-134, D-145 |
| contexts-topics | Contextos y temas | /contexts, /topics | GET, POST, PATCH | D-002, D-011, D-136 |
| messages | Mensajería y subconversaciones | /messages, /topics/ | POST, GET, PATCH | D-124, D-047 |
| search | Búsqueda gobernada | /search | GET, POST | D-031, D-157 |
| agents-mcp | Agente externo MCP | /agents, /mcp | POST, GET | D-103, D-106 |

Detalle de contratos en MDD §4.A.

---

## 8. Reglas de negocio (referencia)

| RN | Título | D-IDs | Artefacto |
|----|--------|-------|-----------|
| RN-01 | Alta de aplicación consumidora | D-133, D-134, D-135 | §5, §4 |
| RN-02 | Creación de contexto y tema General | D-011, D-080, D-136 | §5, §4 |
| RN-03 | Privacidad de tema manual | D-081 | §5, §4 |
| RN-04 | Publicación de mensaje | D-124, D-155, D-045 | §5, §4 |
| RN-05 | Un miembro nunca añade participantes | D-156, D-018 | §5, §4 |
| RN-06 | Adjunto en cuarentena | D-086, D-125 | §5, §4 |
| RN-07 | Adjunto en contexto E2EE sin analizador | D-092, D-086 | §5, §4 |
| RN-08 | Emisión de evento de negocio | D-141, D-080, D-025 | §5, §4 |
| RN-09 | Indisponibilidad de Workspace Chat | D-141, D-009 | §5, §4 |
| RN-10 | Archivado por eliminación en origen | D-136 | §5, §4 |
| RN-11 | Invocación del agente en tema privado | D-106, D-107 | §5, §4 |
| RN-12 | Agente durante break-glass | D-108 | §5, §4 |
| RN-13 | Solicitud y aprobación de break-glass | D-083, D-150, D-151 | §5, §4 |
| RN-14 | Break-glass sobre contenido E2EE | D-083, D-091, D-147 | §5, §4 |
| RN-15 | Purga por retención | D-098, D-152, D-153 | §5, §4 |
| RN-16 | Restauración desde backup | D-098 | §5, §4 |
| RN-17 | Rotación de llaves y mensajes programados | D-092, D-053 | §5, §4 |
| RN-18 | Revocación de dispositivo | D-091 | §5, §4 |
| RN-19 | Notificación en contexto E2EE | D-092, D-061 | §5, §4 |
| RN-20 | Búsqueda | D-031, D-157, D-092 | §5, §4 |
| RN-21 | Ausencia de descubrimiento | D-160 | §5, §4 |
| RN-22 | Exclusión de campaña en migración | D-119, D-154 | §5, §4 |
| RN-23 | Corte de campaña | D-121 | §5, §4 |
| RN-24 | Identidad histórica no resoluble | D-120 | §5, §4 |
| RN-25 | Analítica sobre temas privados o E2EE | D-109, D-161 | §5, §4 |

Detalle BDD/Gherkin en MDD §5.

---

## 9. Glosario (extracto)

- **Workspace Chat:** Plataforma de comunicación contextual multiaplicación; no es mensajero corporativo general ni sistema de tickets (D-002)
- **Aplicación:** Producto consumidor registrado; frontera de configuración, integración y aislamiento mediante `application_id` (D-002, D-093, D-133)
- **Cliente embebido:** Experiencia de Workspace Chat abierta dentro de una aplicación; muestra exclusivamente conversaciones de esa aplicación (D-028, D-123)
- **Aplicación central:** Cliente independiente que agrega conversaciones autorizadas de distintas aplicaciones sin eliminar su aislamiento (D-044)
- **Identidad:** Representación de una persona o actor autenticable; para usuarios internos, su fuente es SSO Integral (D-003)
- **Contexto:** Entidad o propósito de negocio alrededor del cual se colabora dentro de una aplicación (D-002, D-004)
- **Membresía contextual:** Registro explícito que autoriza a una identidad a participar en un contexto y conserva su relación histórica (D-016)
- **Tema:** Línea de tiempo de conversación perteneciente a un contexto; no es ticket, tarea ni workflow (D-015)
- **General:** Tema predeterminado de todo contexto, visible para su membresía contextual (D-011)
- **Tema administrado por aplicación:** Tema originado por una aplicación consumidora; su nombre, privacidad y ciclo de vida se rigen por la política de esa integración (D-080)
- **Tema manual:** Tema creado por un administrador contextual para conversar, sin resolución, responsable, SLA ni estado de workflow (D-014, D-015)
- **Tema público:** Tema visible para toda la membresía del contexto. `Público` nunca significa abierto a toda la empresa o a Internet (D-045)
- **Tema privado:** Tema manual visible únicamente para sus miembros explícitos (D-045)
- **Membresía de tema:** Autorización explícita sobre un tema privado; complementa, no sustituye, la membresía contextual (D-045)
- **Subconversación:** Conversación derivada de un mensaje raíz dentro del mismo tema; la persistencia o API puede usar `thread` (D-047)
- **Actor:** Persona, aplicación, sistema, integración, bot o agente de IA que origina actividad (D-006)
- **Autor:** Actor al que se atribuye un mensaje o evento representado en la cronología (D-006, D-022)
- **Miembro:** Rol base que participa en la conversación: publica, responde, reacciona, adjunta, menciona, programa, fija, crea subconversaciones, busca dentro de su alcance y edita o elimina lógicamente su propio contenido. No administra (D-155)
- **Miembro solo lectura:** Miembro que consulta contenido autorizado sin publicar, reaccionar, adjuntar ni modificar la conversación (D-084)
- **Administrador contextual:** Miembro que gobierna participantes, roles, configuración, etiquetas y archivado de un contexto sin obtener visibilidad implícita de temas privados (D-018, D-082, D-158)

Glosario completo: `paso0/decisions.catalog.json` → `entities` (40 términos).

---

## 10. Trazabilidad RF ↔ D-ID ↔ MDD

| RF | D-IDs principales | Secciones MDD |
|----|-------------------|---------------|
| RF-001..RF-005 | D-002, D-004, D-011, D-045, D-081 | §1, §3, §4, §5 |
| RF-006..RF-008 | D-124, D-080, D-086, D-125 | §3, §4, §5, §6 |
| RF-009..RF-012 | D-126, D-031, D-089, D-098 | §4, §5, §6, §7 |
| RF-013..RF-016 | D-083, D-103, D-119, D-058 | §4, §5, §6 |
| RF-017..RF-020 | D-028, D-044, D-141, D-098 | §1, §2, §5, §7 |

**Catálogo:** 125 D-IDs únicos, 38 entidades canónicas, 10 familias API, 25 reglas RN.

---

## 11. Criterios de aceptación del spec

- [x] Sin `[NEEDS CLARIFICATION]` abiertos
- [x] Todos los RF citan D-IDs del catálogo Paso 0
- [x] Sin stack tecnológico en el cuerpo
- [x] Coherencia con `domain-benchmark.md` enterprise (~1597 líneas)
