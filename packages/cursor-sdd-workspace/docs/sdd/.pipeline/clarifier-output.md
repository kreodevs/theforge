# Clarificador — §1 Workspace Chat

## 1. Contexto y alcance

### 1.1 Propósito del sistema

Workspace Chat es una **plataforma corporativa de comunicación contextual multiaplicación**
(D-002). Su núcleo relaciona una aplicación consumidora con un contexto de negocio y sus
temas mediante `application + contextType + contextId` (D-002, D-004).

Personas, aplicaciones, sistemas, integraciones, bots y agentes producen actividad atribuida
dentro de **una misma cronología** (D-006), mientras el sistema productor conserva el estado
oficial del objeto de negocio (D-128).

**El diferenciador no es la mensajería.** Es que la actividad automática del sistema y la
conversación humana comparten una sola línea de tiempo adherida al objeto de negocio, y que
esa línea de tiempo es verdadera: ningún productor emite antes de persistir (D-141).

### 1.2 Problema que resuelve

| # | Problema | Naturaleza |
|:--:|---|---|
| 1 | La conversación de campaña vive separada del objeto de negocio en OBP | Coste cognitivo y operativo |
| 2 | Avisos que nacen en el navegador o antes de confirmar persistencia; reglas repartidas entre frontend, Make, Tasks y código legado | **Integridad** — se comunican estados que no ocurrieron |
| 3 | El giro corporativo hacia Google obligaría a rehacer integraciones | Coste de cambio |

El problema 2 es la justificación técnica principal y **orienta el diseño**: la
confiabilidad de eventos prevalece sobre la portabilidad.

### 1.3 Capacidades en alcance del MVP

| Capacidad | D-ID |
|---|---|
| Núcleo contextual multiaplicación | D-002, D-004 |
| Alta y gobierno de aplicaciones consumidoras | D-133, D-134, D-135 |
| Activación modular de capacidades por aplicación | D-145 |
| Contextos, temas `General`, temas de aplicación y temas manuales | D-011, D-014, D-080 |
| Privacidad de tema público/privado, fija tras el primer mensaje | D-045, D-081 |
| Ciclo de vida del contexto: archivado, nunca borrado | D-136, D-137, D-138 |
| Identidad SSO, membresía histórica, roles y scopes separados | D-003, D-016, D-082, D-084, D-155 |
| `break-glass` con separación jerárquica | D-083, D-150, D-151 |
| Mensajería base, subconversaciones, programados, fijados, menciones y etiquetas | D-124, D-047, D-053, D-054, D-055, D-158 |
| Adjuntos con cuarentena y antimalware obligatorios | D-125, D-086 |
| Contrato genérico de eventos e invariante de confiabilidad | D-080, D-115, D-141, D-142 |
| Rich cards y acciones | D-057 |
| Realtime, contadores y notificaciones | D-126, D-030, D-061 |
| Búsqueda por aplicación y por aplicación seleccionada en el cliente central | D-031, D-157 |
| E2EE configurable con recuperación corporativa | D-089–D-092, D-131, D-132 |
| Retención por cinco capas, legal hold y exportación | D-098, D-099, D-153 |
| Agente externo mediante MCP con doble autorización | D-103, D-104, D-106 |
| Panel de administración y analítica general agregada | D-058, D-161, D-109 |
| Migración de campañas OBP desde Teams | D-119, D-120, D-121, D-154 |

### 1.4 Fuera de alcance explícito

Estas exclusiones son **vinculantes**. Ningún artefacto posterior puede introducirlas.

| Excluido | D-ID |
|---|---|
| Multi-tenancy como eje de aislamiento | D-095 |
| Chat corporativo general, DMs, grupos y canales corporativos | D-073 |
| Llamadas, videollamadas, pantalla, grabación y transcripción | D-074 |
| Federación entre organizaciones o servidores | D-122 |
| **Descubrimiento abierto de conversaciones y solicitud de acceso** | D-160 |
| **Fusión y división de contextos** | D-138 |
| **Excepciones de retención por contexto** | D-152 |
| **Derechos del titular de datos personales como capacidad del producto** | D-140 |
| **Acción automática ante incumplimiento del invariante de confiabilidad** | D-143 |
| Tickets, tareas, responsables, SLA, resolución y conclusiones formales | D-015, D-097 |
| Silenciar tema o contexto | D-056 |
| Mensajes efímeros, calendarios, moderación avanzada | D-066, D-067, D-068 |
| Historial y acciones móviles offline | D-088 |
| Portal Legal, eDiscovery autoservicio y exportaciones masivas ordinarias | D-100 |
| Embeddings propios; entrenar u hospedar un modelo general | D-104 |
| Agente durante `break-glass` | D-108 |
| Autenticación propia: registro, contraseña, MFA, recuperación | D-003 |
| Integraciones adicionales no identificadas (incluye cualquier canal de mensajería externo) | D-069 |
| Bitrix y su flujo legado | D-118, D-163 |
| Teams o Slack como canal permanente o puente | D-070, D-121 |
| Presencia, indicador de escritura y confirmaciones de lectura | D-159 (Posterior al MVP) |

### 1.5 Vocabulario cerrado

**Términos del dominio.** Ningún artefacto puede renombrarlos ni introducir sinónimos:

`Aplicación`, `Contexto`, `Membresía contextual`, `Tema`, `General`, `Tema administrado por
aplicación`, `Tema manual`, `Tema público`, `Tema privado`, `Membresía de tema`,
`Subconversación`, `Actor`, `Autor`, `Miembro`, `Miembro solo lectura`, `Administrador
contextual`, `Administrador de aplicación`, `Administrador global`, `Mensaje`, `Evento de
negocio`, `Adjunto`, `Mención`, `Etiqueta de mención`, `Reacción`, `Archivado`, `Eliminación
lógica`, `Política de retención`, `Contexto de cifrado`, `Dispositivo registrado`,
`Procesador confiable`, `Entrada de auditoría`, `Agente externo`, `Membresía técnica de
agente`, `Invocación MCP`, `Acceso break-glass`, `Invitado`.

**Términos prohibidos** (D-005, `04` §Términos que deben evitarse):

| Prohibido | Motivo |
|---|---|
| `canal`, `channel`, `publicación` | Semántica de Teams; describe el estado actual, no el dominio |
| `ticket`, `incidencia`, `resolución`, `responsable`, `SLA` | Workspace Chat no tiene workflow |
| `conversación` como entidad intermedia | La jerarquía es Aplicación → Contexto → Tema |
| `tenant` como eje de aislamiento | Frontera futura, distinta de aplicación (D-095) |
| `grupo de trabajo` | Se confunde con los equipos que Tasks resuelve en OBP |
| `subchat` | El término es `subconversación` |
| `campaña`, `medio`, `Sitios`, `Camiones`, `Vallas`, `Indoors` | Pertenecen al adaptador de OBP, nunca al núcleo |

### 1.6 Actores y estructura organizacional real

**D-148 registra que no existen áreas separadas de Legal/Compliance, Seguridad de la
información ni TI corporativo.** Todos los scopes se ejercen desde el equipo de producto y
desarrollo. Los scopes son **del sistema**, no de la organización (D-149).

| Scope del sistema | Nivel que lo ejerce | Facultades | D-ID |
|---|---|---|---|
| Administrador global | **Gerencia** | Gobierno de plataforma, alta de aplicaciones, **aprobación de `break-glass`**, exclusiones de migración | D-082, D-133, D-150, D-151, D-154 |
| Seguridad/Compliance | **Gerencia** | Legal holds, exportaciones puntuales, auditoría | D-082, D-153 |
| Administrador de aplicación | Coordinación y desarrollo | Configuración, operación y recuperación de contextos huérfanos | D-082, D-085 |
| Soporte/TI | Coordinación y desarrollo | Diagnóstico técnico, sesiones, entregas, metadata operativa | D-082 |
| Administrador contextual | Designado por la aplicación | Participantes, roles, etiquetas, configuración y archivado de su contexto | D-018, D-158 |
| Miembro | Usuario final | Publica, responde, reacciona, adjunta, menciona, programa, fija, crea subconversaciones, busca, edita y elimina **lo propio** | D-155 |
| Miembro solo lectura | Usuario final | Consulta contenido autorizado sin publicar ni modificar | D-084 |

**Ningún scope concede lectura automática de contenido** (D-082).

---


## 2. Arquitectura y Stack

_Pendiente pipeline stack_architect._

## 3. Modelo de Datos

_Pendiente pipeline data_model._

## 4. Contratos de API

_Pendiente pipeline api_contracts._

## 5. Lógica y Edge Cases

_Pendiente pipeline section5._

## 6. Seguridad

_Pendiente pipeline security_integration._

## 7. Infraestructura

_Pendiente pipeline security_integration._

<!-- clarifiedScope: {"entities":["applications","application_credentials","application_capabilities","identities","platform_scopes","contexts","context_memberships","topics","topic_memberships","mention_labels","mention_label_members","messages","message_revisions","reactions","mentions","pinned_messages","attachments","business_events","outbox","devices","topic_key_epochs","key_escrow_records","trusted_processors","retention_policies","legal_holds","export_requests","break_glass_requests","audit_entries","purge_tombstones","agents","agent_enablements","agent_topic_memberships","agent_invocations","read_states","notification_intents","migration_jobs","migration_items","analytics_rollups"],"capabilities":["núcleo contextual multiaplicación","alta y gobierno de aplicaciones","contextos, temas y membresías","mensajería, subconversaciones, reacciones, menciones","ingesta idempotente de eventos de negocio","adjuntos con cuarentena y antimalware","realtime y notificaciones","búsqueda gobernada por aplicación","E2EE configurable con recuperación corporativa","retención, legal hold y exportación","break-glass y auditoría","agente externo MCP","migración OBP/Teams","analítica agregada sin contenido"],"decisionIds":["D-002","D-003","D-004","D-006","D-007","D-008","D-009","D-011","D-014","D-015","D-016","D-021","D-023","D-024","D-025","D-027","D-028","D-030","D-031","D-032","D-044","D-045","D-047","D-049","D-053","D-054","D-055","D-056","D-057","D-058","D-060","D-061","D-062","D-063","D-064","D-065","D-066","D-067","D-068","D-069","D-070","D-073","D-074","D-078","D-080","D-081","D-082","D-083","D-084","D-085","D-086","D-087","D-088","D-089","D-090","D-091","D-092","D-093","D-094","D-095","D-096","D-097","D-098","D-099","D-100","D-101","D-102","D-103","D-104","D-105","D-106","D-107","D-108","D-109","D-110","D-111","D-112","D-113","D-114","D-115","D-116","D-117","D-118","D-119","D-120","D-121","D-122","D-123","D-124","D-125","D-126","D-127","D-128","D-131","D-132","D-133","D-134","D-135","D-136","D-137","D-138","D-139","D-140","D-141","D-142","D-143","D-145","D-146","D-147","D-148","D-149","D-150","D-151","D-152","D-153","D-154","D-155","D-156","D-157","D-158","D-159","D-160","D-161","D-162","D-163"],"architectInstructions":["Respetar stack declarado en Paso 0; no sustituir por stack de mercado genérico.","Materializar las 38 tablas canónicas del catálogo con DDL PostgreSQL válido.","Cubrir las 10 familias de rutas obligatorias con §4.A completa (tabla + JSON).","Implementar RN-01..RN-25 con escenarios Gherkin y edge cases.","Aislamiento por application_id en todas las capas (D-093).","Sin descubrimiento abierto ni solicitud de acceso (D-160)."]} -->
