# Workspace Chat — Domain Benchmark & Gap Analysis

**Estado:** artefacto consolidado **definitivo** del Paso 0.
**Corte de reconciliación:** 4 de agosto de 2026.
**Propósito:** material fuente único para la herramienta SDD externa y para lectura humana.
**No es:** PRD, SDD, backlog, runbook, arquitectura técnica definitiva, cronograma ni
# compromiso contractual de entrega.
## 1. Reglas de lectura y gobierno

### 1.1 Qué es y qué no es este documento

Las decisiones vigentes son las filas cuyo tipo es **Decisión confirmada** y cuya vigencia es **Vigente**. Las decisiones sustituidas se conservan allí como antecedentes y **no** se presentan aquí como reglas actuales.

Conforme a D-130, toda capacidad, riesgo, dependencia y regla de este documento lleva
visible su **identificador de decisión**, su **tipo de afirmación** y su **regla**. Una
afirmación sin identificador es una síntesis narrativa, nunca una regla.

### 1.2 Tipos de afirmación

| Tipo                    | Significado                                                                             |
| :---------------------- | :-------------------------------------------------------------------------------------- |
| **Decisión confirmada** | Regla aprobada y vigente. Vinculante.                                                   |
| **Inferencia aceptada** | Conclusión derivada y reconciliada. Razonable, no elevada a decisión. No vinculante.    |
| **Propuesta**           | Opción para diseño, validación o gobierno posterior. No compromete nada.                |
| **Supuesto**            | Condición que debe validarse. Si falla, la decisión que depende de ella se ve afectada. |
| **Pregunta abierta**    | Cuestión P0 no resuelta. En este corte no existe ninguna.                               |

### 1.3 Clasificaciones de capacidad

### Exclusivamente `MVP`, `Preparación arquitectónica`, `Posterior al MVP`, `Fuera de
alcance` y `Pendiente de decisión`.

- **`MVP`** fija la frontera de la primera versión. No expresa simultaneidad, orden
  interno, fecha ni criterio de aceptación (D-144, D-146).
- **`Preparación arquitectónica`** preserva fronteras, contratos o puntos de extensión.
  **No obliga a implementar la capacidad funcional.**
- **`Posterior al MVP`** no fija fecha ni prioridad.
- **`Fuera de alcance`** no prepara implícitamente la capacidad salvo decisión expresa.
- **`Pendiente de decisión`** sólo puede usarse si existe una pregunta realmente abierta.
  **No existe ninguna capacidad vigente con esta clasificación.**

### 1.4 Vocabulario cerrado de la columna Regla

### Sólo se admiten tres valores:

| Valor                                | Significado                                                               |
| :----------------------------------- | :------------------------------------------------------------------------ |
| **Genérica**                         | Regla del núcleo de Workspace Chat. Aplica a toda aplicación consumidora. |
| **Específica OBP**                   | Regla del primer caso de uso. **No** se incorpora al núcleo universal.    |
| **Genérica validada primero en OBP** | Regla del núcleo cuya primera validación se realiza con OBP.              |
`Campaña`, `medio`, `Sitios`, `Camiones`, `Vallas`, `Indoors`, Teams, Make, SharePoint,
OneDrive y Tasks pertenecen al primer caso de uso. **Ninguno es un concepto universal del
núcleo.**

### 1.5 Roles y funciones: advertencia de lectura

Conforme a D-148, la organización **no dispone** de áreas separadas de Legal/Compliance,
Seguridad de la información ni TI/infraestructura corporativa. Todos los scopes se
ejercen desde el **equipo de producto y desarrollo**.

En consecuencia, cuando este documento menciona `Seguridad/Compliance`, `Soporte/TI`,
`administrador global` o `responsable funcional`, se refiere siempre a **funciones y
scopes del sistema**, nunca a departamentos existentes. La separación de scopes es
técnica y se mantiene aunque una misma persona ejerza varias (D-149).

El mapeo vigente sobre la estructura real es (D-151):

| Scope del sistema                                                               | Nivel que lo ejerce                        |
| :------------------------------------------------------------------------------ | :----------------------------------------- |
| Administrador global — incluye aprobar `break-glass` y dar de alta aplicaciones | Gerencia                                   |
| Seguridad/Compliance — legal holds y exportaciones                              | Gerencia                                   |
| Administrador de aplicación                                                     | Coordinación y desarrollo                  |
| Soporte/TI                                                                      | Coordinación y desarrollo                  |
| Administrador contextual                                                        | Designado por aplicación según su política |

### 1.6 Límite metodológico declarado

Conforme a D-164: la conversación de descubrimiento que originó este material **no está
versionada en el repositorio**. En consecuencia, **no ha podido verificarse** que no
existan decisiones anteriores contradictorias fuera del registro canónico. Toda
# afirmación de este documento se sostiene exclusivamente en `00`–`22` y `20.1`.
## 2. Síntesis ejecutiva

### 2.1 Reglas genéricas de Workspace Chat

### Workspace

### Chat es una plataforma corporativa de

**comunicación contextual
multiaplicación** (D-002). Su núcleo relaciona una aplicación con un contexto de negocio y
sus temas mediante `application + contextType + contextId` (D-002, D-004). Personas,
aplicaciones, sistemas, integraciones, bots y agentes producen actividad atribuida dentro
de una **misma cronología** (D-006), mientras el sistema productor conserva el estado
oficial del objeto de negocio (D-128).

El diferenciador no es la cantidad de funciones de mensajería: es que la actividad
automática del sistema y la conversación humana comparten una sola línea de tiempo
adherida al objeto de negocio.

### El `MVP` incluye experiencia embebida (D-123), aplicación central multiaplicación
(D-044), clientes web y móvil (D-078, D-162), conversación pública y privada (D-045,
D-081), subconversaciones configurables (D-047), mensajería y multimedia (D-124, D-125),
eventos y rich cards (D-057, D-080), realtime (D-126), búsqueda gobernada (D-031, D-157),
E2EE configurable (D-089–D-092, D-132), alta de aplicaciones consumidoras (D-133, D-134),
administración (D-058), analítica general agregada (D-161), auditoría y retención
(D-098–D-099) y un primer patrón de integración de agentes externos mediante MCP (D-103).

El producto **no** busca reemplazar la comunicación corporativa general ni las suites de
reuniones. Chat corporativo, DMs, grupos y canales generales (D-073), llamadas,
videollamadas, pantalla, grabación y transcripción síncrona (D-074) son `Fuera de
alcance`. Workspace Chat tampoco es un sistema de tickets (D-015, D-097) ni el expediente
oficial del objeto de negocio (D-128).

### 2.2 Especialización OBP

OBP es el primer caso de validación y la campaña se representa como contexto (D-004). La
plataforma sustituirá gradualmente Teams + Make para la comunicación operativa de
campañas (D-007) **sin codificar la jerarquía de Teams en el núcleo** (D-005). `General` y
los temas automáticos por tipo de medio son públicos dentro de la membresía de campaña
(D-079); los temas automáticos no se renombran ni eliminan y permanecen como historial si
el medio desaparece (D-012, D-013).

OBP funciona sin E2EE por defecto, aunque una política explícita puede crear una campaña
cifrada desde su origen (D-090). El primer caso de IA es el agente externo de campañas,
invocado explícitamente mediante herramientas MCP de solo lectura (D-103). La migración
cubre todas las campañas activas elegibles (D-119, D-154), todo el historial disponible
(D-120) y un corte por campaña sin convivencia operativa permanente (D-121).

### 2.3 Lo que un lector debe retener antes de diseñar

1. **La cronología debe ser verdadera.** Toda aplicación consumidora está obligada a
   persistir el cambio de negocio antes de emitir el evento, y a no depender de
   Workspace Chat para operar (D-141). Es la condición que sostiene la propuesta de valor
   entera.
2. **El aislamiento por aplicación no admite excepciones.** Ni la aplicación central ni la
   consola disponen de bypass (D-093, D-044).
3. **Ningún rol administrativo concede lectura de contenido** (D-082). El acceso
   excepcional es `break-glass`, con aprobación de nivel jerárquico distinto (D-083,
   D-150).
4. **La privacidad de un tema se fija con su primer mensaje y no se reclasifica** (D-081).
5. **Un contexto nunca se elimina; se archiva** (D-136).
6. **E2EE es una decisión de producto, no una obligación externa** (D-131), y su
# recuperación corporativa depende de un servicio que todavía no existe (D-147).
## 3. Visión, problema y límites del producto

### 3.1 El problema

### Tres problemas distintos, que conviene no mezclar porque tienen pesos diferentes:

| # | Problema                                                                                                                                                    | Naturaleza                                                                                | Evidencia                   |
| :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :-------------------------- |
| 1 | La conversación de campaña vive separada visualmente del objeto de negocio en OBP                                                                           | Coste cognitivo y operativo                                                               | `02` §Problemas confirmados |
| 2 | Parte de los avisos nace en el navegador o antes de confirmar persistencia; las reglas están repartidas entre frontend, Strapi, Make, Tasks y código legado | **Integridad**: se comunican estados que no ocurrieron, o cambios reales que nadie conoce | `02` §Problemas confirmados |
| 3 | El giro corporativo hacia Google obligaría a rehacer integraciones                                                                                          | Coste de cambio y dependencia de proveedor                                                | `00-master-context` §1      |
**Inferencia aceptada:** el problema 2 es la justificación técnica más sólida y el 1 la
justificación de valor más sólida. El 3 explica por qué se construye en lugar de
reconfigurar, pero no debe orientar el diseño hacia la portabilidad a costa de la
integridad de eventos.

### 3.2 Decisiones confirmadas

| Regla                                                                                                                                                                | Clasificación | Tipo                | Regla          | Base                |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------------------ | :------------- | :------------------ |
| Conservar conversación, archivos y actividad automática junto al contexto de negocio, con identidad corporativa única y superficies reutilizables entre aplicaciones | MVP           | Decisión confirmada | Genérica       | D-002, D-003        |
| Reducir el acoplamiento a proveedores de mensajería y permitir que nuevas aplicaciones adopten el núcleo mediante contratos y configuración                          | MVP           | Decisión confirmada | Genérica       | D-002, D-080, D-133 |
| La aplicación central agrega únicamente conversaciones contextuales autorizadas; no convierte Workspace Chat en mensajería generalista                               | MVP           | Decisión confirmada | Genérica       | D-044, D-073        |
| La plataforma se opera con observabilidad básica y atención dentro de la operación normal, sin acceso administrativo ordinario al contenido                          | MVP           | Decisión confirmada | Genérica       | D-111, D-082        |
| Toda capacidad puede activarse o desactivarse por aplicación mediante configuración, sin cambiar su clasificación de alcance                                         | MVP           | Decisión confirmada | Genérica       | D-145               |
| Reducir la dependencia de Teams + Make para campañas sin que una falla de Chat bloquee o revierta la operación de OBP                                                | MVP           | Decisión confirmada | Específica OBP | D-007, D-009        |

### 3.3 Límites confirmados

| Fuera de alcance                                                                                 | Tipo                | Regla          | Base             |
| :----------------------------------------------------------------------------------------------- | :------------------ | :------------- | :--------------- |
| Chat corporativo general, DMs, grupos y canales corporativos generales                           | Decisión confirmada | Genérica       | D-073            |
| Llamadas, videollamadas, pantalla, grabación, transcripción y capacidades síncronas relacionadas | Decisión confirmada | Genérica       | D-074            |
| Tickets, tareas, responsables, SLA, resolución, workflow y conclusiones formales                 | Decisión confirmada | Genérica       | D-015, D-097     |
| Calendarios                                                                                      | Decisión confirmada | Genérica       | D-066            |
| Mensajes efímeros                                                                                | Decisión confirmada | Genérica       | D-067            |
| Moderación avanzada                                                                              | Decisión confirmada | Genérica       | D-068            |
| Silenciar tema o contexto                                                                        | Decisión confirmada | Genérica       | D-056            |
| Integraciones adicionales no identificadas                                                       | Decisión confirmada | Genérica       | D-069            |
| Federación entre organizaciones o servidores                                                     | Decisión confirmada | Genérica       | D-122            |
| Workspace Chat como fuente oficial o expediente del objeto de negocio                            | Decisión confirmada | Genérica       | D-128            |
| Descubrimiento abierto de conversaciones y solicitud de acceso                                   | Decisión confirmada | Genérica       | **D-160**        |
| Fusión y división de contextos                                                                   | Decisión confirmada | Genérica       | **D-138**        |
| Excepciones de retención por contexto                                                            | Decisión confirmada | Genérica       | **D-152**        |
| SLA contractual y centro de soporte permanente                                                   | Decisión confirmada | Genérica       | D-114            |
| Historial y acciones móviles offline                                                             | Decisión confirmada | Genérica       | D-088            |
| Derechos del titular de datos personales como capacidad del producto                             | Decisión confirmada | Genérica       | **D-140**        |
| Bitrix y su flujo legado                                                                         | Decisión confirmada | Específica OBP | D-118, **D-163** |

### 3.4 Inferencias aceptadas

- El diferenciador es la colaboración contextual, no una mayor cantidad de funciones de
  chat.
- `MVP` fija la frontera de la primera versión, pero no simultaneidad, secuencia, fecha ni
  criterios de aceptación (D-144, D-146).
- La construcción por verticales end-to-end utilizables es una forma razonable de entregar
  el alcance, pero **no es una regla vinculante del Paso 0** (D-146; `15` §Brechas
# operativas).
## 4. Estado actual de OBP

### 4.1 Hechos descubiertos — específicos de OBP

Todos con regla **Específica OBP** y tipo **Hecho descubierto**; ninguno constituye una
regla del núcleo.

- Teams mantiene un canal por campaña y publicaciones por tipo de medio.
- Planning, Comercial y SAC coordinan disponibilidad, confirmaciones y seguimiento, y
  comparten texto, archivos, audio, GIF y emojis.
- Make crea publicaciones, agrega equipos de Planning y administradores predeterminados, y
  funciona como destino y orquestador habitual hacia Teams.
- OBP conoce roles amplios; Tasks conserva la clasificación de equipos específicos.
- Las notificaciones de negocio están distribuidas entre frontend, backend, Make, Tasks y
  código legado; algunas nacen en navegador o antes de confirmar persistencia.
- Existen rutas actuales y legadas con exposición a pérdida, duplicidad y orden
  inconsistente.
- El backend de OBP puede modificarse.

### 4.2 Inferencias aceptadas

- Teams resuelve transporte y experiencia, pero su canal y sus publicaciones son una
  **equivalencia de migración**, no el dominio objetivo (D-005).
- Los mensajes de Chat no son la fuente oficial del estado de campaña o medio (D-128).
- La transición debe realizarse evento por evento y por campaña, retirando las rutas
# antiguas conforme se complete el corte (D-121).
## 5. Dominio y lenguaje ubicuo

### 5.1 Lenguaje genérico — decisiones confirmadas

Catálogo completo. Ningún término se omite: su ausencia obligaría al consumidor a inferir
conceptos que sostienen reglas de autorización y de cifrado.

| Término                          | Definición                                                                                                                                                                                                                                                                 | Clasificación              | Base                |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :------------------ |
| Workspace Chat                   | Plataforma de comunicación contextual multiaplicación; no es mensajero corporativo general ni sistema de tickets                                                                                                                                                           | MVP                        | D-002               |
| Aplicación                       | Producto consumidor registrado; frontera de configuración, integración y aislamiento mediante `application_id`                                                                                                                                                             | MVP                        | D-002, D-093, D-133 |
| Cliente embebido                 | Experiencia de Workspace Chat abierta dentro de una aplicación; muestra exclusivamente conversaciones de esa aplicación                                                                                                                                                    | MVP                        | D-123, D-028        |
| Aplicación central               | Cliente independiente que agrega conversaciones autorizadas de distintas aplicaciones sin eliminar su aislamiento                                                                                                                                                          | MVP                        | D-044               |
| Identidad                        | Representación de una persona o actor autenticable; para usuarios internos, su fuente es SSO Integral                                                                                                                                                                      | MVP                        | D-003               |
| Contexto                         | Entidad o propósito de negocio alrededor del cual se colabora dentro de una aplicación                                                                                                                                                                                     | MVP                        | D-002, D-004        |
| Membresía contextual             | Registro explícito que autoriza a una identidad a participar en un contexto y conserva su relación histórica                                                                                                                                                               | MVP                        | D-016               |
| Tema                             | Línea de tiempo de conversación perteneciente a un contexto; no es ticket, tarea ni workflow                                                                                                                                                                               | MVP                        | D-015               |
| `General`                        | Tema predeterminado de todo contexto, visible para su membresía contextual                                                                                                                                                                                                 | MVP                        | D-011               |
| Tema administrado por aplicación | Tema originado por una aplicación consumidora; su nombre, privacidad y ciclo de vida se rigen por la política de esa integración                                                                                                                                           | MVP                        | **D-080**           |
| Tema manual                      | Tema creado por un administrador contextual para conversar, sin resolución, responsable, SLA ni estado de workflow                                                                                                                                                         | MVP                        | D-014, D-015        |
| Tema público                     | Tema visible para toda la membresía del contexto. `Público` **nunca** significa abierto a toda la empresa o a Internet                                                                                                                                                     | MVP                        | D-045               |
| Tema privado                     | Tema manual visible únicamente para sus miembros explícitos                                                                                                                                                                                                                | MVP                        | D-045               |
| Membresía de tema                | Autorización explícita sobre un tema privado; complementa, no sustituye, la membresía contextual                                                                                                                                                                           | MVP                        | D-045               |
| Subconversación                  | Conversación derivada de un mensaje raíz dentro del mismo tema; la persistencia o API puede usar `thread`                                                                                                                                                                  | MVP                        | D-047               |
| Actor                            | Persona, aplicación, sistema, integración, bot o agente de IA que origina actividad                                                                                                                                                                                        | MVP                        | D-006               |
| Autor                            | Actor al que se atribuye un mensaje o evento representado en la cronología                                                                                                                                                                                                 | MVP                        | D-006, D-022        |
| **Miembro**                      | Rol base que participa en la conversación: publica, responde, reacciona, adjunta, menciona, programa, fija, crea subconversaciones, busca dentro de su alcance y edita o elimina lógicamente **su propio** contenido. No administra                                        | MVP                        | **D-155**           |
| Miembro solo lectura             | Miembro que consulta contenido autorizado sin publicar, reaccionar, adjuntar ni modificar la conversación                                                                                                                                                                  | MVP                        | D-084               |
| Administrador contextual         | Miembro que gobierna participantes, roles, configuración, etiquetas y archivado de un contexto **sin** obtener visibilidad implícita de temas privados                                                                                                                     | MVP                        | D-018, D-082, D-158 |
| Administrador de aplicación      | Scope que gobierna configuración, operación y recuperación de contextos de una aplicación sin lectura automática de mensajes                                                                                                                                               | MVP                        | D-082, D-085        |
| Administrador global             | Scope que gobierna la plataforma, da de alta aplicaciones y aprueba `break-glass`; sin lectura automática de mensajes                                                                                                                                                      | MVP                        | D-082, D-133, D-151 |
| Acceso `break-glass`             | Elevación excepcional, limitada y temporal, con motivo, aprobación de nivel jerárquico distinto y auditoría; no descifra E2EE por sí misma                                                                                                                                 | MVP                        | D-083, D-150        |
| Mensaje                          | Unidad de contenido publicada en un tema o subconversación y atribuida a un autor                                                                                                                                                                                          | MVP                        | D-124               |
| Evento de negocio                | Hecho estructurado e **inmutable** emitido por una aplicación; representable como mensaje o rich card sin convertirse en la fuente oficial del estado                                                                                                                      | MVP                        | D-025, D-128        |
| Adjunto                          | Referencia a un archivo o medio asociado a un mensaje; el binario pertenece a la capacidad de medios                                                                                                                                                                       | MVP                        | D-125               |
| **Mención**                      | Referencia dirigida a una identidad, conjunto autorizado o etiqueta dentro de un mensaje                                                                                                                                                                                   | MVP                        | D-055, D-124        |
| **Etiqueta de mención**          | Agrupación de miembros definida **dentro de Workspace Chat** por un administrador contextual sobre la membresía de su contexto                                                                                                                                             | MVP                        | **D-158**           |
| **Reacción**                     | Expresión asociada a un mensaje, separada del contenido original                                                                                                                                                                                                           | MVP                        | D-124               |
| Archivado                        | Estado de solo lectura que conserva historial; no equivale a eliminación ni al cierre de la entidad de negocio                                                                                                                                                             | MVP                        | D-027, D-136        |
| Eliminación lógica               | Ocultamiento operativo de contenido con preservación de autoría, evidencia e historial auditado                                                                                                                                                                            | MVP                        | D-023               |
| **Política de retención**        | Conjunto de periodos para visibilidad, operación, auditoría, archivos y legal. El default confirmado usa 3 meses, 6 meses, 2 años, 6 meses y hold hasta liberación más 30 días. En campañas OBP activas los relojes visible y operativo comienzan al dejar de estar activa | MVP                        | D-098, D-120        |
| Contexto de cifrado              | Política E2EE fijada por aplicación o contexto **antes** de publicar contenido; cada tema cifrado mantiene una frontera criptográfica independiente                                                                                                                        | MVP                        | D-089               |
| **Dispositivo registrado**       | Extremo asociado a una identidad, autorizado para recibir llaves y revocable sin conservar acceso a llaves futuras                                                                                                                                                         | MVP                        | D-091               |
| **Procesador confiable**         | Productor o servicio imprescindible registrado como participante criptográfico explícito, con identidad propia, alcance mínimo, credenciales rotables, auditoría y revocación                                                                                              | MVP                        | D-092               |
| **Entrada de auditoría**         | Evidencia inmutable de una acción relevante, su actor, instante, alcance y motivo cuando corresponda                                                                                                                                                                       | MVP                        | D-098, D-099        |
| Agente externo                   | Actor automatizado administrado fuera de Workspace Chat, accesible mediante herramientas MCP gobernadas y representado con identidad y scopes propios                                                                                                                      | MVP                        | D-103               |
| **Membresía técnica de agente**  | Autorización explícita que permite a un agente habilitado para la aplicación o contexto participar en un tema manual privado no E2EE sin ampliar la audiencia del tema                                                                                                     | MVP                        | D-106               |
| **Invocación MCP**               | Consulta explícita de un usuario a una herramienta autorizada, con identidad, contexto, resultado y auditoría                                                                                                                                                              | MVP                        | D-103, D-104        |
| Invitado                         | Tipo futuro de identidad externa; no es sinónimo de un rol fijo                                                                                                                                                                                                            | Preparación arquitectónica | D-064               |

### 5.2 Términos que deben evitarse como lenguaje principal

**Decisión confirmada — Genérica.** Esta sección es un guardarraíl deliberado: impide que
un consumidor de este documento reintroduzca semántica del estado actual o de sistemas de
tickets. Su omisión fue uno de los defectos corregidos respecto de `99` (G-5).

| Término a evitar                                              | Motivo                                                                                  |
| :------------------------------------------------------------ | :-------------------------------------------------------------------------------------- |
| `Canal de Teams`, `publicación`                               | Describen el estado actual, no el dominio objetivo (D-005)                              |
| `Ticket`, `incidencia`, `resolución`, `responsable`, `SLA`    | Agregan semántica de workflow que Workspace Chat **no posee** (D-015, D-097)            |
| `Grupo de trabajo`                                            | Se confunde con los equipos que Tasks utiliza para resolver la membresía inicial de OBP |
| `Público` sin matiz                                           | Debe aclararse siempre que el límite es la membresía del contexto (D-045)               |
| `Subchat`                                                     | El término de dominio es `subconversación` (D-047)                                      |
| `Campaña`, `medio`, `Sitios`, `Camiones`, `Vallas`, `Indoors` | Pertenecen al adaptador de OBP, no al núcleo (D-004, D-005)                             |

### 5.3 Jerarquía conceptual

**Inferencia aceptada.**

```text
Aplicación
└── Contexto
    ├── Membresía contextual
    ├── Etiquetas de mención
    └── Tema
        ├── Membresía de tema, sólo si es privado
        ├── Mensaje
        │   ├── Adjunto
        │   ├── Mención
        │   └── Reacción
        └── Subconversación
            └── Mensajes derivados

```

La aplicación central es un cliente de agregación autorizada, no un nuevo dominio ni un
bypass del aislamiento. La membresía es una **autorización persistida**, no una consulta
dinámica equivalente al rol general que una persona tenga en la aplicación consumidora.

### 5.4 Especialización OBP

| Concepto genérico                | Especialización OBP                                                              | Clasificación | Base         |
| :------------------------------- | :------------------------------------------------------------------------------- | :------------ | :----------- |
| Aplicación                       | OBP                                                                              | MVP           | D-004        |
| Contexto                         | Campaña                                                                          | MVP           | D-004        |
| Tema administrado por aplicación | Tema automático por tipo de medio: Sitios, Camiones, Vallas, Indoors             | MVP           | D-012, D-013 |
| Membresía contextual             | Fotografía inicial enviada por OBP con equipos específicos resueltos desde Tasks | MVP           | D-032        |
| Administrador contextual         | Administrador explícito enviado para la campaña                                  | MVP           | D-032, D-085 |
| Agente externo                   | Agente de campañas consultado mediante MCP de solo lectura                       | MVP           | D-103        |

### 5.5 Propuestas

- Agregados candidatos: `Application`, `Context`, `Topic`, `Membership`, `Message`,
  `BusinessEvent`, `RetentionPolicy`, `EncryptionContext`, `AuditEntry`. Los nombres de
  agregados, API y persistencia se concretan durante diseño (DF-001).
- Tipos de actor candidatos: `user`, `application`, `system`, `integration`, `bot`,
  `ai-agent`.
- Orígenes de tema candidatos: `default`, `application`, `manual`.
- Estados de tema candidatos: `active`, `archived`; la privacidad se expresa
# separadamente como `public` o `private`.
## 6. Contextos, temas y subconversaciones

### 6.1 Reglas genéricas — decisiones confirmadas

| Regla                                                                                                                                                                                                                                  | Clasificación    | Base         |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :----------- |
| Todo contexto contiene `General`                                                                                                                                                                                                       | MVP              | D-011        |
| Sólo administradores contextuales crean temas manuales                                                                                                                                                                                 | MVP              | D-014        |
| Los temas manuales pueden ser públicos o privados. Su privacidad sólo cambia mientras están vacíos; el primer mensaje la fija. Un cambio posterior de audiencia exige un tema nuevo y **no** reclasifica, copia ni revela el historial | MVP              | D-045, D-081 |
| Acceder a un tema público requiere membresía contextual; acceder a uno privado requiere **además** membresía explícita de tema                                                                                                         | MVP              | D-045        |
| Un administrador contextual **no** ve automáticamente un tema privado al que no pertenece                                                                                                                                              | MVP              | D-082        |
| Un tema no tiene resolución, responsable, SLA, workflow ni conclusión formal                                                                                                                                                           | Fuera de alcance | D-015, D-097 |
| Las subconversaciones son configurables por aplicación o contexto                                                                                                                                                                      | MVP              | D-047        |
| Existen mensajes fijados                                                                                                                                                                                                               | MVP              | D-054        |
| El archivado manual conserva historial y deja el contexto en solo lectura                                                                                                                                                              | MVP              | D-027        |
| El archivado automático por inactividad es política configurable, **separada** de la retención                                                                                                                                         | MVP              | D-060        |
| Silenciar tema o contexto                                                                                                                                                                                                              | Fuera de alcance | D-056        |

### 6.2 Ciclo de vida del contexto — decisiones confirmadas

Esta sección cierra la vertiente destructiva que el material anterior dejaba indefinida.

| Regla                                                                                                                                                                                                                    | Clasificación    | Base      |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :-------- |
| **Un contexto nunca se elimina.** Cuando el objeto de negocio se elimina en la aplicación productora, el contexto pasa a **archivado**: solo lectura, conservando historial, autoría, auditoría y plazos de retención    | MVP              | **D-136** |
| La aplicación productora comunica la eliminación mediante una **intención explícita y autorizada** del contrato de eventos                                                                                               | MVP              | **D-136** |
| El `displayName` de un contexto es **actualizable** por la aplicación productora mediante evento                                                                                                                         | MVP              | **D-137** |
| El `externalId` es **inmutable**: constituye, junto con `sourceApplication` y `context.type`, la identidad del contexto. Un cambio de identificador en origen produce un contexto nuevo y no migra el anterior           | MVP              | **D-137** |
| **Fusión y división de contextos** quedan fuera de alcance. Si el negocio fusiona o divide el objeto, se crea un contexto nuevo y los anteriores se archivan; el historial no se reclasifica, no se copia y no se hereda | Fuera de alcance | **D-138** |
**Inferencia aceptada:** D-136 y D-137 exigen que el contrato genérico de entrada
contemple al menos dos intenciones explícitas adicionales a `ensure` y `publish`:
**archivar un contexto** y **actualizar su `displayName`**. La forma concreta de esas
intenciones se difiere al diseño; su existencia no.

### 6.3 Reglas específicas de OBP — decisiones confirmadas

| Regla                                                                                                                               | Clasificación | Base         |
| :---------------------------------------------------------------------------------------------------------------------------------- | :------------ | :----------- |
| `General` y todos los temas automáticos por tipo de medio son públicos dentro de la campaña                                         | MVP           | D-079        |
| Los temas automáticos no se renombran ni eliminan; un nuevo tipo de medio crea un tema y su desaparición no elimina el historial    | MVP           | D-012, D-013 |
| Una campaña activa conserva todo el historial visible y operativo; los relojes de 3 y 6 meses comienzan cuando deja de estar activa | MVP           | D-120        |
| El cierre de una campaña **no** archiva automáticamente su conversación                                                             | MVP           | D-026        |
**Inferencia aceptada:** una campaña eliminada en origen deja de estar activa, por lo que
D-120 hace arrancar en ese momento los relojes de retención sobre todo su historial. La
regla es coherente y no requiere excepción adicional.

### 6.4 Inferencias aceptadas

- Un tema privado **no aparece** en búsquedas ni contadores para quien no es miembro.
- Privacidad y E2EE son controles diferentes: la primera gobierna autorización; el segundo
  determina quién puede descifrar.
- La configuración de subconversaciones puede usar un valor predeterminado por aplicación
  y una sobrescritura por contexto; la semántica concreta se difiere al diseño (DF-002).
- Los temas automáticos de otras aplicaciones heredarán la política explícita de su
# integración; la regla fija de publicidad aplica sólo a OBP.
## 7. Identidad, membresía y permisos

### 7.1 Reglas genéricas — decisiones confirmadas

| Regla                                                                                                                                                                                                                             | Clasificación              | Base             |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :--------------- |
| SSO Integral es la fuente de identidad de personas; Workspace Chat no construye registro, contraseñas, MFA ni recuperación propios                                                                                                | MVP                        | D-003            |
| El alta de aplicación emite credenciales **propias de aplicación**, distintas de la identidad de las personas. D-003 se refiere exclusivamente a identidad de usuarios                                                            | MVP                        | **D-135**        |
| La membresía inicial proviene de la aplicación y se conserva como **fotografía histórica**. Cambios posteriores de equipo no alteran automáticamente contextos ya creados                                                         | MVP                        | D-016, D-017     |
| Sólo administradores explícitos agregan o retiran usuarios, cambian roles, configuran y archivan. Pueden agregar a cualquier usuario activo del SSO                                                                               | MVP                        | D-018, D-019     |
| Perder acceso a la aplicación consumidora **no** revoca Chat automáticamente; el retiro manual sí, y la desactivación SSO revoca globalmente                                                                                      | MVP                        | D-020, D-021     |
| Retirar a una persona conserva su autoría y contenido. Si vuelve, recupera el historial que continúe autorizado                                                                                                                   | MVP                        | D-022            |
| Los roles base son **administrador contextual**, **miembro** y **solo lectura**                                                                                                                                                   | MVP                        | D-084            |
| **Definición de miembro:** publica, responde, reacciona, adjunta, menciona, programa mensajes, fija mensajes, crea subconversaciones, busca dentro de su alcance autorizado y edita o elimina lógicamente **su propio** contenido | MVP                        | **D-155**        |
| **Un miembro no puede** gestionar participantes, roles ni configuración, archivar, crear temas manuales ni eliminar contenido ajeno                                                                                               | MVP                        | **D-155**        |
| **Un miembro nunca añade participantes**, ni al contexto ni a un tema, ni siquiera a temas públicos del contexto al que pertenece. Tampoco existe flujo de solicitud de incorporación                                             | MVP                        | **D-156**        |
| Solo lectura consulta contenido autorizado sin publicar, reaccionar, adjuntar ni modificar                                                                                                                                        | MVP                        | D-084            |
| Administrador contextual, administrador de aplicación, administrador global, soporte/TI y Seguridad/Compliance tienen **scopes separados**; ninguno obtiene lectura automática ni membresía implícita en temas privados           | MVP                        | D-082            |
| **La separación de scopes es del sistema, no de la organización**: se mantiene aunque una misma persona ejerza varios                                                                                                             | MVP                        | **D-149**        |
| El responsable funcional de cada aplicación gobierna su política de administradores predeterminados y se designa en el alta de la aplicación                                                                                      | MVP                        | D-085, **D-134** |
| Un contexto activo no puede quedar voluntariamente sin administrador; si una desactivación SSO lo deja huérfano, un administrador de aplicación puede reasignarlo **sin leer mensajes**                                           | MVP                        | D-085            |
| `break-glass` exige motivo, alcance limitado, ventana temporal, expiración y auditoría completa. **No descifra E2EE por sí mismo**                                                                                                | MVP                        | D-083            |
| **La solicitud de `break-glass` corresponde al nivel de coordinación y desarrollo; la aprobación, exclusivamente al nivel de gerencia.** Ningún perfil puede solicitar y aprobar el mismo acceso                                  | MVP                        | **D-150**        |
| **No existe descubrimiento abierto ni solicitud de acceso.** Un usuario percibe únicamente los contextos y temas donde tiene membresía; nada en la interfaz, la búsqueda o los contadores revela la existencia de los demás       | Fuera de alcance           | **D-160**        |
| Fronteras preservadas para identidades externas y guest                                                                                                                                                                           | Preparación arquitectónica | D-064            |
| Invitaciones B2B/B2C                                                                                                                                                                                                              | Posterior al MVP           | D-065            |

### 7.2 Matriz administrativa confirmada

| Scope                       | Alcance ordinario                                                                            | Acceso al contenido                                                        | Nivel que lo ejerce (D-151) |
| :-------------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------- |
| Administrador contextual    | Participantes, roles, etiquetas, configuración y archivado de su contexto                    | Sólo temas públicos autorizados y privados donde tenga membresía explícita | Designado por aplicación    |
| Administrador de aplicación | Configuración, operación y recuperación de contextos de una aplicación                       | Sin lectura automática                                                     | Coordinación y desarrollo   |
| Administrador global        | Configuración y gobierno de la plataforma; alta de aplicaciones; aprobación de `break-glass` | Sin lectura automática                                                     | Gerencia                    |
| Soporte/TI                  | Diagnóstico técnico, sesiones, entregas y metadata operativa                                 | Sin lectura automática                                                     | Coordinación y desarrollo   |
| Seguridad/Compliance        | Auditoría, evidencia de seguridad, legal holds y exportaciones                               | Sin lectura automática                                                     | Gerencia                    |

### 7.3 Reglas específicas de OBP — decisiones confirmadas

| Regla                                                                                                                                                  | Clasificación | Base         |
| :----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :----------- |
| OBP entrega participantes y administradores iniciales; los equipos específicos se resuelven desde Tasks y los roles amplios de OBP no bastan           | MVP           | D-032        |
| Cambiar de equipo o perder acceso a OBP no retira automáticamente la membresía de campaña                                                              | MVP           | D-017, D-020 |
| Una identidad histórica de Teams no resoluble contra SSO conserva nombre, fecha y origen disponibles, pero **no** recibe sesión, membresía ni permisos | MVP           | D-120        |

### 7.4 Inferencias aceptadas

- Tener acceso a una aplicación no concede acceso a todas sus conversaciones.
- La aplicación central exige acceso a la aplicación **y** membresía en la conversación.
- Toda consulta autoriza `application_id + membresía + visibilidad del tema`.
- Privacidad y E2EE son controles independientes: pertenecer a un tema cifrado no concede
  acceso sin el dispositivo y las llaves vigentes.
- `Guest` es un tipo de identidad; sus permisos se expresarán mediante roles y membresía.
## 8. Mensajería, media y eventos

### 8.1 Mensajería y contenido — decisiones confirmadas

| Regla                                                                                                                                                                                                                    | Clasificación    | Regla    | Base                       |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------- | :------------------------- |
| Texto, emojis, reacciones, menciones individuales, respuestas citadas, edición, eliminación lógica, historial y eventos automáticos                                                                                      | MVP              | Genérica | D-124                      |
| Subconversaciones, mensajes programados, fijados y menciones masivas o por etiqueta                                                                                                                                      | MVP              | Genérica | D-047, D-053, D-054, D-055 |
| **Las etiquetas de mención se definen dentro de Workspace Chat** por un administrador contextual sobre la membresía de su contexto. Workspace Chat **no** consume un catálogo externo de equipos para resolver menciones | MVP              | Genérica | **D-158**                  |
| Archivos, documentos, imágenes, audio subido o grabado y GIF con previsualización básica. Un archivo de video es un adjunto sujeto a la política de formatos; **no** introduce comunicación síncrona                     | MVP              | Genérica | D-125, D-074               |
| El autor edita y elimina lógicamente su contenido; un administrador puede eliminar lógicamente contenido ajeno. Toda edición y eliminación es auditable                                                                  | MVP              | Genérica | D-023, D-024               |
| Los eventos de negocio son **inmutables** desde Workspace Chat                                                                                                                                                           | MVP              | Genérica | D-025                      |
| Los mensajes programados permiten edición, reprogramación y cancelación, y **revalidan autorización al publicarse**                                                                                                      | MVP              | Genérica | D-053                      |
| Catálogo GIF mediante abstracción de proveedor desacoplada y desactivable                                                                                                                                                | MVP              | Genérica | D-049                      |
| Mensajes efímeros, conclusiones formales y catálogo GIF acoplado a un proveedor                                                                                                                                          | Fuera de alcance | Genérica | D-067, D-097, D-049        |

### 8.2 Seguridad de adjuntos — decisiones confirmadas

Todas con regla **Genérica** y base **D-086**, salvo indicación.

| Regla                                                                                                                                                                 | Clasificación |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ |
| Cada adjunto valida MIME real, extensión y tamaño, y permanece en **cuarentena** hasta superar el análisis antimalware. Mientras tanto no se visualiza ni se descarga | MVP           |
| Los archivos infectados, sospechosos o no analizables de forma segura se **bloquean**                                                                                 | MVP           |
| La política corporativa fija el mínimo; una aplicación puede **restringirla, nunca debilitarla**                                                                      | MVP           |
| La entrega usa URLs firmadas y temporales; se auditan carga, análisis, descarga, bloqueo y eliminación                                                                | MVP           |
| En E2EE el analizador participa como **procesador confiable**; si no está disponible, el contexto **no admite adjuntos** (D-092)                                      | MVP           |

### 8.3 Eventos y confiabilidad — decisiones confirmadas

| Regla                                                                                                                                                                                                                                                                                       | Clasificación    | Regla                                | Base                |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------- | :----------------------------------- | :------------------ |
| **Invariante genérico de confiabilidad del productor.** Toda aplicación consumidora debe (a) confirmar el cambio de negocio en su propia persistencia **antes** de registrar el evento, y (b) garantizar que una indisponibilidad de Workspace Chat **no revierte ni bloquea** su operación | MVP              | **Genérica**                         | **D-141**           |
| El invariante se exige **exclusivamente por contrato**. No hay prueba de integración obligatoria, ni declaración en el alta, ni verificación en tiempo de ejecución. El cumplimiento es responsabilidad de cada equipo productor                                                            | MVP              | Genérica                             | **D-142**           |
| Ante un incumplimiento detectado, Workspace Chat **no ejecuta ninguna acción automática**: no altera contenido publicado, no suspende la recepción de eventos y no dispara flujo propio. La discrepancia queda visible en métricas y se gestiona entre equipos                              | Fuera de alcance | Genérica                             | **D-143**           |
| El contrato versionado e independiente del transporte puede asegurar un contexto, asegurar un tema o publicar actividad                                                                                                                                                                     | MVP              | Genérica                             | D-080               |
| La recepción es autorizada, idempotente y trazable; un cambio incompatible exige nueva versión, convivencia temporal y pruebas básicas de compatibilidad                                                                                                                                    | MVP              | Genérica                             | D-080, D-115        |
| Cada productor gobierna la semántica, formato y versión de lo que publica; Workspace Chat gobierna sus adaptadores, modelo canónico y contratos expuestos                                                                                                                                   | MVP              | Genérica                             | D-115               |
| Rich cards y acciones representan actividad gobernada sin convertir Chat en la fuente oficial del negocio                                                                                                                                                                                   | MVP              | Genérica                             | D-057, D-128        |
| Los eventos nacen en backend después de persistir cambios de campaña o medio; Make se retira gradualmente                                                                                                                                                                                   | MVP              | **Genérica validada primero en OBP** | D-008, D-009, D-007 |
| El adaptador de OBP evita incorporar `campaña` y `medio` al núcleo genérico                                                                                                                                                                                                                 | MVP              | Específica OBP                       | D-005, D-080        |

### 8.4 Reglas e invariantes del contrato de entrada

**Decisiones confirmadas — Genéricas.** Base: D-080, D-136, D-137.

- Los reintentos conservan el mismo `eventId`; `sourceApplication + eventId` es la clave
  conceptual de deduplicación.
- `sourceApplication + context.type + context.externalId` identifica el contexto, y
  `externalId` es inmutable (D-137).
- `topic.key` es estable dentro del contexto; `ensureExists` permite creación idempotente.
- **`ensure` es no destructivo**: no cambia privacidad, origen, reglas ni ciclo de vida de
  un tema existente. Toda modificación exige una intención explícita y autorizada.
- Crear un contexto asegura también su tema `General`.
- Publicar actividad exige que el productor tenga autorización vigente para la aplicación,
  emitida en su alta (D-134, D-135).
- Si el contexto destino usa E2EE, la aplicación productora debe estar registrada como
  **participante criptográfico explícito** y cifrar el payload; no puede usar las llaves
  corporativas de recuperación como mecanismo ordinario (D-092).
- Payloads sensibles, acciones ejecutables y rich cards pasan validación y autorización.
- Errores recuperables se reintentan; errores definitivos quedan trazables para operación.
- El orden sólo se exige dentro de la partición que realmente lo necesite, no globalmente.

### 8.5 Inferencias aceptadas

- Outbox o mecanismo durable equivalente, cola, reintentos, DLQ, idempotencia y
  trazabilidad end-to-end son la base arquitectónica aceptada, **sin fijar
  implementación** (D-010, que permanece como inferencia y **no** se eleva a decisión).
- La capacidad de medios almacena binarios; Chat conserva referencias y metadata.
- Un mensaje programado valida permisos al enviarse y no se publica si el autor perdió
  acceso.
- Edición conserva revisiones auditables.
- Mensaje citado y subconversación son capacidades distintas.
- La misma política obligatoria de validación, cuarentena y antimalware aplica a adjuntos
  migrados antes de ponerlos a disposición.
- La representación visual deriva de `eventType + schemaVersion`; el productor entrega
  contenido semántico, no texto acoplado a un proveedor.
## 9. Clientes: embebido, central, web y móvil

### 9.1 Decisiones confirmadas — reglas genéricas

| Regla                                                                                                                                                      | Clasificación              | Base             |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :--------------- |
| Componente embebible, contextual y no invasivo. Dentro de una aplicación muestra **exclusivamente** conversaciones autorizadas de esa aplicación           | MVP                        | D-123, D-028     |
| Aplicación central multiaplicación que agrega conversaciones contextuales autorizadas **sin bypass de aislamiento** ni chat corporativo general            | MVP                        | D-044, D-073     |
| Identidad SSO compartida; sin inicio de sesión independiente por integración                                                                               | MVP                        | D-029            |
| Web y móvil son aplicaciones separadas que **comparten dominio, contratos, autenticación, realtime, validaciones y tokens de diseño**, no toda la interfaz | MVP                        | D-078, **D-162** |
| El cliente móvil funciona **únicamente en línea**. Muestra estado desconectado y al reconectar obtiene del servidor el estado autorizado vigente           | MVP                        | D-087            |
| Historial local y preparación o encolado offline de mensajes, reacciones, adjuntos u otras acciones                                                        | Fuera de alcance           | D-088            |
| La aplicación central consulta mediante `application_id`, autorización server-side y segunda barrera a nivel de datos; **no dispone de bypass general**    | MVP                        | D-093, **D-162** |
| Registro de dispositivos para push móvil y preferencias avanzadas de notificación                                                                          | Preparación arquitectónica | D-062            |
**Nota de lectura (D-162):** las tecnologías concretas de cliente —React/Next.js, React
Native + Expo y la estructura de monorepo— **no son decisiones de dominio**. Figuran como
propuestas en el anexo A.

### 9.2 Inferencias aceptadas

- La aplicación móvil es un **único cliente central multiaplicación**, no una aplicación
  móvil distinta por cada producto consumidor.
- La experiencia embebida inicial puede ser drawer o panel lateral; la variante exacta se
  resuelve durante diseño (DF-004).
- La administración vive en una experiencia separada de la aplicación central de usuario;
  su separación técnica o de despliegue no queda fijada en el Paso 0.
- Un paquete React reutilizable y un SDK agnóstico evitan acoplar Chat a OBP.
- Cliente y realtime deben revalidar autorización al reconectar; no existe cola offline de
  acciones en el MVP.
## 10. Realtime, búsqueda y notificaciones

### 10.1 Decisiones confirmadas

| Regla                                                                                                                                                                                     | Clasificación              | Regla          | Base                     |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :------------- | :----------------------- |
| Mensajes y actividad en tiempo real                                                                                                                                                       | MVP                        | Genérica       | D-126                    |
| Contadores globales en la aplicación, por contexto y por tema, con indicador de mención                                                                                                   | MVP                        | Genérica       | D-030                    |
| Chat mantiene el estado de no leídos y produce la intención de notificación; el Hub de Notificaciones centraliza los avisos corporativos                                                  | MVP                        | Genérica       | D-030                    |
| Correo con patrones de Slack/Teams. En E2EE muestra aplicación, contexto, tema y autor, **nunca el cuerpo**                                                                               | MVP                        | Genérica       | D-061, D-092             |
| La búsqueda se limita a la aplicación y a la audiencia autorizada                                                                                                                         | MVP                        | Genérica       | D-031                    |
| **En la aplicación central el usuario selecciona una aplicación y busca dentro de ella.** Nunca se agregan resultados de varias aplicaciones en una misma respuesta ni en un mismo índice | MVP                        | Genérica       | **D-157**                |
| En E2EE la búsqueda se limita, en el cliente, al contenido autorizado ya cargado y descifrado, sin índice local offline permanente                                                        | MVP                        | Genérica       | D-092                    |
| Búsqueda central completa e indexación confiable sobre E2EE                                                                                                                               | Posterior al MVP           | Genérica       | D-096                    |
| Filtros avanzados de búsqueda                                                                                                                                                             | Posterior al MVP           | Genérica       | `17`:113 — **Propuesta** |
| Push móvil, preferencias avanzadas y webhooks salientes                                                                                                                                   | Preparación arquitectónica | Genérica       | D-062, D-063             |
| **Presencia, indicador de escritura y confirmaciones de lectura**                                                                                                                         | Posterior al MVP           | Genérica       | **D-159**                |
| El cliente móvil requiere conexión activa; al desconectarse no conserva historial local ni encola acciones                                                                                | MVP                        | Genérica       | D-087, D-088             |
| La actividad de una campaña OBP activa permanece visible y operativa sin que la antigüedad del mensaje la retire                                                                          | MVP                        | Específica OBP | D-120                    |

### 10.2 Inferencias aceptadas

- La persistencia es la fuente de mensajes; el canal realtime transporta eventos y **no
  sustituye** la persistencia. Un evento se persiste antes de emitirse.
- Reconexión, resincronización, acknowledgement y deduplicación recuperan el estado
  autorizado del servidor; **nunca publican acciones creadas sin conexión**.
- Las notificaciones no revelan contenido de temas privados a personas no autorizadas.
- El orden relevante se garantiza por contexto o entidad cuando sea necesario, no
  globalmente.
- Los eventos automáticos publican en el tema indicado y no crean subconversaciones por sí
  mismos.

### 10.3 Propuestas

- Eventos candidatos: `message.created/updated/deleted`, `topic.created`,
  `participant.added`, `mention.created`, `business-event.received`, `agent.action.*`.
- DLQ, replay controlado, backoff y panel operativo.
- Preferencias por usuario, aplicación y tipo, evitando configuración por tema salvo
  necesidad demostrada.
- Email digest o por inactividad antes que correo por cada mensaje.
- Deep links desde el Hub a aplicación, contexto, tema, mensaje o subconversación.
## 11. Seguridad, E2EE y aislamiento

### 11.1 Base de seguridad e aislamiento — decisiones confirmadas

| Regla                                                                                                                                                                                                                                                                           | Clasificación              | Regla    | Base             |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------- | :------- | :--------------- |
| SSO corporativo, autorización server-side por aplicación, membresía y visibilidad de tema, TLS en tránsito, cifrado en reposo, secretos administrados, URLs firmadas, auditoría y eliminación lógica                                                                            | MVP                        | Genérica | D-093, D-086     |
| **Invariante de aislamiento:** todo contexto, tema, mensaje, membresía, archivo, evento y contador incluye `application_id` obligatorio, con autorización server-side y una **segunda barrera de autorización a nivel de datos** independiente de la autorización de aplicación | MVP                        | Genérica | D-093, **D-162** |
| El `application_id` autorizado proviene del token o la sesión, **nunca de un valor libre enviado por el cliente**                                                                                                                                                               | MVP                        | Genérica | D-093            |
| Restricciones, archivos, cachés, búsqueda, colas, realtime y pruebas automáticas impiden relaciones o accesos cruzados; ni la aplicación central ni la consola disponen de bypass general                                                                                       | MVP                        | Genérica | D-093, D-044     |
| Un eventual `tenant_id` es una frontera **distinta** de `application_id` y no debe reutilizarse como el mismo concepto                                                                                                                                                          | Preparación arquitectónica | Genérica | D-095            |
| Almacenamiento dedicado por aplicación, sólo ante necesidad regulatoria, contractual, de residencia, escala o aislamiento demostrada                                                                                                                                            | Posterior al MVP           | Genérica | D-094            |
| Residencia en la región aprobada por la infraestructura disponible, sin selección ordinaria por aplicación                                                                                                                                                                      | MVP                        | Genérica | D-099            |
| Puntos de integración con una futura capacidad DLP                                                                                                                                                                                                                              | Preparación arquitectónica | Genérica | D-101            |
| Inspección DLP avanzada del cuerpo y clasificación automática                                                                                                                                                                                                                   | Posterior al MVP           | Genérica | D-102            |
| Federación                                                                                                                                                                                                                                                                      | Fuera de alcance           | Genérica | D-122            |
**Nota de lectura (D-162):** PostgreSQL y RLS como mecanismo concreto **no son decisiones
de dominio**. El invariante exigible es "segunda barrera de autorización a nivel de datos";
la tecnología figura como propuesta en el anexo A.

### 11.2 E2EE: alcance, fundamento y llaves

| Regla                                                                                                                                                                                                                                                         | Clasificación    | Regla          | Base                |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------- | :------------- | :------------------ |
| **Fundamento registrado:** E2EE protege información comercial sensible —tarifas, negociaciones, disponibilidad y condiciones— frente a accesos internos indebidos. **No existe obligación regulatoria ni contractual externa**; es una decisión de producto   | MVP              | Genérica       | **D-131**           |
| E2EE conserva la clasificación `MVP` completa: configurable por aplicación y contexto, fijado antes de publicar contenido, frontera criptográfica por tema, recuperación corporativa administrada y procesadores imprescindibles con alcance mínimo           | MVP              | Genérica       | **D-132**, D-089    |
| La política E2EE se fija **antes** del primer contenido y **no cambia después**                                                                                                                                                                               | MVP              | Genérica       | D-089               |
| Cada tema cifrado conserva una **frontera criptográfica independiente**                                                                                                                                                                                       | MVP              | Genérica       | D-089               |
| La política E2EE por defecto de una aplicación se selecciona **en su alta**, único momento garantizado anterior a la existencia de contenido                                                                                                                  | MVP              | Genérica       | **D-134**           |
| OBP funciona sin E2EE por defecto; una política explícita puede crear contextos de campaña cifrados desde su origen                                                                                                                                           | MVP              | Específica OBP | D-090               |
| El backend ordinario permanece **ciego**. Las llaves se respaldan cifradas mediante un servicio corporativo protegido por KMS/HSM                                                                                                                             | MVP              | Genérica       | D-091, D-092        |
| **El servicio corporativo de recuperación de llaves con KMS/HSM no existe y debe construirse o contratarse.** D-091 es, por tanto, una **decisión condicionada**: su contenido es firme, su ejecución depende de una capacidad de infraestructura inexistente | MVP              | Genérica       | **D-147**           |
| Un dispositivo nuevo usa SSO, reautenticación reforzada y registro; recupera sólo historial aún autorizado. La revocación corta sesiones, impide entregar llaves nuevas y rota las llaves para mensajes futuros                                               | MVP              | Genérica       | D-091               |
| Recuperar contenido requiere el servicio de llaves **más** `break-glass` aprobado, con control separado y evidencia auditable                                                                                                                                 | MVP              | Genérica       | D-091, D-083, D-150 |
| Sólo productores y procesadores imprescindibles participan criptográficamente, con identidad propia, alcance mínimo, credenciales rotables, auditoría y revocación. Las llaves de recuperación **nunca** sirven al procesamiento ordinario                    | MVP              | Genérica       | D-092               |
| Notificaciones sin cuerpo; programados cifrados con cancelación o reprogramación ante rotación; productor y antimalware participan explícitamente al procesar eventos, cards o adjuntos                                                                       | MVP              | Genérica       | D-092               |
| El análisis antimalware sigue siendo **obligatorio** en E2EE; si el analizador no está disponible, el contexto no admite adjuntos                                                                                                                             | MVP              | Genérica       | D-092, D-086        |
| Búsqueda central completa sobre E2EE, y participación del agente MCP como procesador o participante criptográfico                                                                                                                                             | Posterior al MVP | Genérica       | D-096, D-107        |

### 11.3 Inferencias aceptadas

- Revocar un dispositivo o rotar llaves evita acceso futuro, pero **no puede retirar
  copias ya descifradas o exportadas** desde un extremo autorizado.
- Un tema privado y un tema E2EE expresan controles distintos: privacidad es autorización;
  E2EE determina quién puede descifrar.
- Si una campaña OBP activa usa E2EE, aplicar D-120 exige conservar el ciphertext y el
  material de llaves imprescindible durante toda su actividad.
- El funcionamiento móvil sólo en línea reduce persistencia local, pero no sustituye el
  registro, recuperación y revocación criptográfica de dispositivos.

### 11.4 Propuestas y supuestos

- **Propuesta — MVP:** threat model por cliente, API, canal realtime, capacidad de medios,
  Hub, procesador confiable, agente y consola administrativa.
- **Propuesta — MVP:** adoptar primitivas y componentes criptográficos maduros y
  auditables tras spike y revisión de seguridad; **no diseñar criptografía propia**.
- **Propuesta — MVP:** rechazo explícito y auditable de cualquier intento de cambiar
  privacidad o E2EE una vez que el tema o contexto contiene mensajes.
- **Supuesto — MVP:** SSO admite reautenticación reforzada sin que Chat implemente MFA
  propio.
- **Ya no es supuesto:** la disponibilidad de KMS/HSM. Es una **dependencia crítica
  confirmada como inexistente** (D-147).
## 12. Retención, auditoría y legal hold

### 12.1 Política de retención vigente

| Capa                                      | Política                                                                           | Clasificación | Base         |
| :---------------------------------------- | :--------------------------------------------------------------------------------- | :------------ | :----------- |
| Visible                                   | 3 meses desde la creación                                                          | MVP           | D-098        |
| Operativa                                 | 6 meses; editar **no** reinicia el plazo                                           | MVP           | D-098        |
| Evidencia de auditoría                    | 2 años desde el evento auditado                                                    | MVP           | D-098        |
| Cuerpos editados o eliminados, y archivos | 6 meses desde la creación                                                          | MVP           | D-098        |
| Backups                                   | Rotación de 35 días; la restauración **reaplica** tombstones, expiraciones y holds | MVP           | D-098        |
| Legal hold                                | Hasta liberación formal y 30 días adicionales                                      | MVP           | D-098, D-099 |

### 12.2 Reglas genéricas — decisiones confirmadas

| Regla                                                                                                                                                                                                 | Clasificación    | Base             |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :--------------- |
| La política corporativa define mínimos y máximos; **cada aplicación selecciona dentro de ellos en su alta**                                                                                           | MVP              | D-059, **D-134** |
| **Las excepciones de retención por contexto quedan fuera de alcance.** Toda aplicación aplica la política corporativa sin desviaciones caso a caso; desaparece la figura del aprobador de excepciones | Fuera de alcance | **D-152**        |
| Un legal hold **prevalece** sobre cualquier purga aplicable                                                                                                                                           | MVP              | D-098            |
| Al vencer la visibilidad el contenido deja de mostrarse; al vencer la retención operativa se purgan mensajes, versiones y archivos, salvo hold vigente                                                | MVP              | D-098            |
| Un backup **no puede resucitar contenido vencido**: una restauración reaplica tombstones, expiraciones y holds antes de volver a servir información                                                   | MVP              | D-098            |
| Toda eliminación desde interfaz es lógica, incluida la administrativa                                                                                                                                 | MVP              | D-023, D-024     |
| Los eventos automáticos son inmutables desde Chat                                                                                                                                                     | MVP              | D-025            |
| Se auditan actor, instante, motivo cuando corresponde, participantes, roles, archivado, privacidad, ediciones, eliminaciones, adjuntos, exportaciones, recuperaciones y acciones de agentes           | MVP              | D-098, D-099     |
| Workspace Chat conserva conversación operativa transitoria y **no es el expediente oficial** del objeto de negocio                                                                                    | Fuera de alcance | D-128            |
| Retención temporal y archivado por inactividad son políticas **diferentes**                                                                                                                           | MVP              | D-060            |
| Historial o retención offline en el cliente móvil                                                                                                                                                     | Fuera de alcance | D-088            |

### 12.3 Legal hold, exportación y datos personales

| Regla                                                                                                                                                                                                                                   | Clasificación    | Base                 |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------------------- |
| **Legal hold y exportación puntual se mantienen completos en el MVP**, por aplicación, contexto, tema y rango temporal, con solicitud, aprobación de persona distinta del solicitante, auditoría, manifiesto y checksums                | MVP              | **D-153**, D-099     |
| La facultad corresponde al scope Seguridad/Compliance, **ejercido desde gerencia**                                                                                                                                                      | MVP              | **D-151**, **D-153** |
| La exportación incluye el contenido aún existente; después de la purga **no se promete recuperar contenido inexistente**                                                                                                                | MVP              | D-099                |
| **Ningún scope, incluido Seguridad/Compliance, obtiene por sí mismo lectura ordinaria** de mensajes o contenido eliminado                                                                                                               | MVP              | D-082, D-099         |
| En E2EE un hold preserva ciphertext y el material de llaves imprescindible; consultar o exportar sigue requiriendo recuperación corporativa y `break-glass` aprobado, **sin descifrado permanente**                                     | MVP              | D-092, D-091         |
| Portal o rol propio de Legal, eDiscovery autoservicio, exportaciones masivas ordinarias y acceso permanente de Legal                                                                                                                    | Fuera de alcance | D-100                |
| **Workspace Chat hereda el marco corporativo vigente de protección de datos personales** y no define un marco propio                                                                                                                    | MVP              | **D-139**            |
| **La atención de derechos del titular** (acceso, rectificación, supresión) queda **fuera del alcance del producto**; se atiende por el canal corporativo existente y Chat aporta información mediante la exportación gobernada de D-099 | Fuera de alcance | **D-140**            |
**Advertencia registrada.** Dos particularidades del producto deben comunicarse al
responsable del marco corporativo, aunque no se abra un análisis propio:

1. En contextos E2EE, Workspace Chat **no puede localizar ni suprimir** contenido de una
   persona sin recuperación corporativa de llaves y `break-glass` aprobado. Una solicitud
   de supresión no es ejecutable por la vía ordinaria.
2. La migración desde Teams conserva **atribuciones históricas con nombre y fecha** de
   identidades no resolubles, que pueden corresponder a personas ya desvinculadas (D-120).

### 12.4 Excepción específica de OBP

| Regla                                                                                                                                                                                            | Clasificación | Base  |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :---- |
| Una campaña activa conserva todo su historial visible y operativo mientras permanezca activa, aunque el contenido supere los plazos generales desde su creación                                  | MVP           | D-120 |
| Cuando deja de estar activa comienzan, para todo su historial, los relojes de 3 meses visibles y 6 meses operativos                                                                              | MVP           | D-120 |
| La excepción cubre mensajes humanos, eventos, archivos, replies, reacciones, ediciones, eliminaciones lógicas y mensajes del agente. **No** cambia auditoría, payload MCP, backups ni legal hold | MVP           | D-120 |
| Cerrar una campaña **no** archiva automáticamente su conversación                                                                                                                                | MVP           | D-026 |
**Inferencia aceptada:** D-152 no afecta a D-120. La excepción OBP es una **regla general
del caso de uso**, no una aprobación caso a caso; lo eliminado es el mecanismo
discrecional de excepción por contexto.

### 12.5 Retención del agente

| Regla                                                       | Clasificación | Base  |
| :---------------------------------------------------------- | :------------ | :---- |
| Pregunta y respuesta siguen la retención de la conversación | MVP           | D-104 |
| Metadata de invocación: 2 años                              | MVP           | D-104 |
| Payload técnico MCP: máximo 30 días                         | MVP           | D-104 |

# | Embeddings propios de Workspace Chat derivados de conversaciones | Fuera de alcance | D-104 |

---

## 13. IA, agente de campañas y MCP

### 13.1 Reglas genéricas — decisiones confirmadas

| Regla                                                                                                                                                                | Clasificación              | Base         |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :----------- |
| El modelo de mensajes y autores soporta identidades de bot y agente                                                                                                  | MVP                        | D-103        |
| Workspace Chat invoca agentes externos mediante MCP y **no construye ni hospeda un modelo general propio**                                                           | MVP                        | D-103        |
| La invocación inicial es **explícita** y de **solo lectura**. Publicar la pregunta constituye la confirmación del usuario                                            | MVP                        | D-103        |
| La respuesta se publica en el mismo tema, atribuida al agente, con fuentes cuando estén disponibles                                                                  | MVP                        | D-103        |
| Pregunta y respuesta **heredan** autorización, privacidad y retención del tema; no crean un historial paralelo de IA                                                 | MVP                        | D-103, D-104 |
| Chat transmite sólo identidad autorizada, aplicación, contexto, tema, pregunta y referencias indispensables; **no entrega automáticamente todo el historial**        | MVP                        | D-103        |
| Usuario y agente se autorizan de forma **independiente**; ninguna identidad amplía los permisos de la otra                                                           | MVP                        | D-106        |
| En un tema manual privado no E2EE el agente requiere **habilitación para la aplicación o contexto** y **membresía técnica explícita** con identidad y scopes propios | MVP                        | D-106        |
| Gateway o adaptador MCP genérico con identidad, scopes, credenciales rotables, auditoría, rate limit, revocación y `kill switch`                                     | Preparación arquitectónica | D-127        |
| Herramientas de escritura, cambios sobre objetos de negocio, proactividad y automatizaciones iniciadas por el agente                                                 | Posterior al MVP           | D-105        |
| Participación del agente en contextos o temas E2EE                                                                                                                   | Posterior al MVP           | D-107        |
| Invocar, habilitar o delegar acceso al agente durante `break-glass`, **incluso supervisado**                                                                         | Fuera de alcance           | D-108        |
| Entrenar u hospedar un modelo general, memoria personal prolongada, embeddings propios e integraciones de IA adicionales no identificadas                            | Fuera de alcance           | D-104, D-069 |

### 13.2 Especialización OBP — decisiones confirmadas

| Regla                                                                                                                                                               | Clasificación    | Base         |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------- | :----------- |
| El agente externo de campañas ya en desarrollo es el primer agente integrado                                                                                        | MVP              | D-103        |
| Consulta información de campaña con la identidad del usuario y `applicationId + contextType + contextId`; OBP conserva el estado oficial                            | MVP              | D-103, D-128 |
| Pregunta y respuesta se publican en el tema de campaña desde el cual se invocó                                                                                      | MVP              | D-103        |
| `General` y los temas automáticos públicos pueden utilizarlo cuando esté habilitado; un tema manual privado no E2EE requiere **además** membresía técnica explícita | MVP              | D-106        |
| Uso del agente en una campaña creada con E2EE                                                                                                                       | Posterior al MVP | D-107        |

### 13.3 Inferencias aceptadas

- MCP y el contrato asíncrono de eventos son **complementarios**: MCP responde bajo
  demanda; los eventos alimentan automáticamente la cronología después de un cambio
  persistido.
- En un tema manual privado no E2EE autorizado, publicar pregunta y respuesta **no amplía
  su audiencia**: sólo sus miembros explícitos las ven.
- La retención interna del agente pertenece a su producto; el contrato de integración debe
  minimizar duplicación y cachés innecesarias en Workspace Chat.

### 13.4 Propuestas

- Herramienta conceptual inicial de consulta de información de contexto; su separación en
  resumen, medios, disponibilidad o bloqueos se difiere al diseño (DF-003).
- Política contractual de minimización, redacción y prohibición de entrenamiento general
  con datos de Workspace Chat salvo acuerdo expreso.
- Rich card para respuestas estructuradas del agente con enlaces a las fuentes del sistema
  productor.
## 14. Administración, operación y analítica

### 14.1 Alta y gobierno de aplicaciones consumidoras

### Esta sección cierra la laguna que impedía que la promesa multiaplicación fuera
ejercitable.

| Regla                                                                                                                                                                                                                                                                                                                                                                                                              | Clasificación | Base             |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :--------------- |
| **El alta de una aplicación consumidora se realiza desde la consola por un administrador global**, que registra la aplicación y designa a su responsable funcional. Es capacidad `MVP`                                                                                                                                                                                                                             | MVP           | **D-133**        |
| El **registro de una aplicación** comprende cuatro elementos obligatorios: (a) responsable funcional designado; (b) política de administradores predeterminados; (c) política de retención seleccionada dentro de los límites corporativos y política E2EE por defecto; (d) identidad y credenciales rotables de la aplicación productora con sus orígenes autorizados, emitidas por la consola en el acto de alta | MVP           | **D-134**        |
| Las credenciales emitidas son **propias de aplicación**, distintas de la identidad de las personas                                                                                                                                                                                                                                                                                                                 | MVP           | **D-135**        |
| El responsable funcional designado en el alta es el sujeto que gobierna la política de administradores predeterminados                                                                                                                                                                                                                                                                                             | MVP           | **D-134**, D-085 |
| **Toda capacidad puede activarse o desactivarse por aplicación** mediante configuración, sin cambiar su clasificación de alcance ni obligar a todas las aplicaciones a utilizarla                                                                                                                                                                                                                                  | MVP           | **D-145**        |
**Diferidos al diseño, no preguntas abiertas:** los tipos de `contextType` que cada
aplicación puede crear y el detalle de la habilitación modular de capacidades (**DF-013**).
La **baja, suspensión o revocación** de una aplicación consumidora no está resuelta y se
registra como **DF-014**; conviene cerrarla antes de integrar la segunda aplicación, no
antes de cerrar el Paso 0.

### 14.2 Administración y acceso — decisiones confirmadas

| Regla                                                                                                                                                      | Clasificación    | Base         |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :----------- |
| Panel para aplicaciones, políticas, acceso, conversaciones, agentes, auditoría, adjuntos, migración y operación, siempre dentro de scopes separados        | MVP              | D-058, D-082 |
| La consola permite cambiar la privacidad de un tema manual **sólo mientras esté vacío** y, después, crear un tema sucesor sin copiar historial ni miembros | MVP              | D-081        |
| La consola aplica una política corporativa base de formatos; una aplicación puede restringirla, **nunca debilitarla**                                      | MVP              | D-086        |
| La consola habilita o revoca al agente por aplicación o contexto y administra su membresía técnica explícita en temas manuales privados no E2EE            | MVP              | D-106, D-127 |
| La consola **debe bloquear** la habilitación o invocación del agente durante `break-glass`, incluso en sesión supervisada                                  | Fuera de alcance | D-108        |
| La consola coordina `break-glass` y la recuperación corporativa **sin exponer llaves**                                                                     | MVP              | D-083, D-091 |
| **Un administrador contextual gestiona las etiquetas de mención** de su contexto sobre la membresía existente                                              | MVP              | **D-158**    |
| Administración del agente como participante o procesador E2EE                                                                                              | Posterior al MVP | D-107        |
| Consola de inspección DLP avanzada                                                                                                                         | Posterior al MVP | D-102        |

### 14.3 Analítica y observabilidad — decisiones confirmadas

| Regla                                                                                                                                                                                                                                                                                                           | Clasificación    | Base             |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :--------------- |
| **Definición de la analítica del MVP:** uso y operación **agregados** — adopción, actividad por aplicación y contexto, uso de capacidades, salud de entrega y consumo de almacenamiento. **No incluye análisis de comportamiento individual.** El término canónico es "analítica general"; se retira "avanzada" | MVP              | **D-161**, D-058 |
| En temas privados y E2EE sólo se utilizan agregados y metadata operativa **sin** nombres de temas, integrantes, cuerpos, archivos, búsquedas, prompts o respuestas, ni comportamiento individual                                                                                                                | MVP              | D-109            |
| **No existe excepción de esta regla para OBP**                                                                                                                                                                                                                                                                  | MVP              | D-109            |
| La observabilidad técnica puede usar identificadores internos y `correlation_id` para salud, latencia, entrega y errores **sin conceder lectura de contenido**. La evidencia individual permanece en la vía de auditoría autorizada                                                                             | MVP              | D-109            |
| Analítica identificable por tema privado o E2EE, únicamente con necesidad validada y autorización equivalente a la conversación                                                                                                                                                                                 | Posterior al MVP | D-110            |

### 14.4 Modelo operativo y contratos — decisiones confirmadas

| Regla                                                                                                                                          | Clasificación              | Base  |
| :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :---- |
| Logs centralizados, métricas básicas, salud, correlación y alertas sobre indisponibilidad, eventos fallidos, backups, antimalware y cuarentena | MVP                        | D-111 |
| Un equipo responsable atiende incidentes **dentro de su operación normal**; sin guardia 24/7 ni centro de soporte dedicado                     | MVP                        | D-111 |
| Instrumentación para fijar después SLO internos, RPO/RTO, capacidad, umbrales y presupuesto con evidencia real                                 | Preparación arquitectónica | D-112 |
| Guardia humana 24/7, programa formal de SLO y consola operativa avanzada, si la adopción o criticidad lo justifican                            | Posterior al MVP           | D-113 |
| SLA contractual y centro de soporte permanente                                                                                                 | Fuera de alcance           | D-114 |
| Gobierno distribuido de contratos: cada productor responde por lo que publica y Chat por sus adaptadores, modelo canónico y contratos propios  | MVP                        | D-115 |
| Contratos, versiones y responsables documentados en los repositorios correspondientes, sin registro especializado inicial                      | Preparación arquitectónica | D-116 |
| Catálogo o comité central de contratos, si la escala lo justifica                                                                              | Posterior al MVP           | D-117 |

### 14.5 Inferencias aceptadas

- La consola y el motor de retención deben exponer el estado activo o inactivo que aplica
  D-120 e iniciar los relojes con evidencia auditable de la transición.
- Administración de aplicación, administración contextual, operación, soporte, seguridad y
  analítica son ámbitos separados, aunque las personas coincidan (D-149).
- Realtime y colas requieren métricas, trazas y correlación end-to-end.
- El soporte debe distinguir una desconexión del cliente móvil de una falla del servicio;
  no existe cola offline de acciones que administrar.

### 14.6 Propuestas

- Consola operativa con salud, conexiones, latencia, colas, reintentos y DLQ.
- `correlation_id` de extremo a extremo desde el productor hasta Chat, Hub y cliente.
- Guías breves para indisponibilidad, eventos fallidos, backups, antimalware, cuarentena,
  contextos huérfanos y recuperación.
- Purga verificable, rotación de backups y reaplicación de tombstones, expiraciones y
  holds tras una restauración.
- Telemetría de desconexión, reconexión y resincronización sin capturar contenido.
## 15. Benchmark de dominio

**Fecha de verificación de fuentes primarias:** 2026-08-01. Todas las conclusiones de esta
sección son **Inferencias aceptadas**. Ninguna capacidad se incorpora al alcance por
aparecer en el benchmark; el alcance canónico se gobierna en la sección 18.

| Referente                                                                                                            | Patrón útil                                                                       | Límite o riesgo que **no** se adopta                                                     |
| :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/teams-channels-overview)                          | Canales públicos y privados, posts y replies, apps, administración y retención    | Acoplamiento a M365/SharePoint y permanencia como destino operativo (D-070)              |
| [Slack](https://api.slack.com/events/api)                                                                            | Mensajería madura, threads, no leídos, Events API, apps con scopes y audit logs   | Convertirse en mensajería generalista o depender de planes y límites externos (D-073)    |
| [Google Chat](https://developers.google.com/workspace/chat/api/reference/rest)                                       | Spaces, membresías, mensajes, cards, read states y eventos                        | Reacoplar el proceso contextual al nuevo proveedor corporativo                           |
| [Mattermost](https://docs.mattermost.com/deployment-guide/application-architecture.html)                             | Autohospedaje, RBAC, extensibilidad y compliance                                  | Traslado de upgrades, seguridad, continuidad, soporte y licencias al operador            |
| [Rocket.Chat](https://docs.rocket.chat/docs/end-to-end-encryption-user-guide)                                        | Permisos, auditoría, retención y evidencia práctica de degradaciones E2EE         | Políticas criptográficas distintas de D-089–D-092 y amplitud omnicanal innecesaria       |
| [Matrix/Element](https://matrix.org/docs/matrix-concepts/rooms_and_events/)                                          | Secuencias de eventos extensibles y referencia madura de cifrado multidispositivo | Complejidad de sync, estado, distribución de llaves y **federación**, excluida por D-122 |
| [Jira](https://support.atlassian.com/jira-software-cloud/docs/what-are-the-different-types-of-activity-on-an-issue/) | Conversación y actividad junto a un objeto de trabajo                             | Importar ticket, resolución, responsable o SLA (D-015)                                   |
| [Linear](https://linear.app/docs/comment-on-issues)                                                                  | Conversación contextual compacta y agente invocable con resultado visible         | Confundir contexto conversacional con issue, o ampliar permisos del agente (D-106)       |
| [Notion](https://www.notion.com/help/comments-mentions-and-reminders)                                                | Conversación anclada a un objeto y navegación directa al punto contextual         | Reducir Chat a comentario documental o introducir resolución obligatoria (D-097)         |
**Inferencias aceptadas del comparativo:**

- El patrón más cercano combina la **colaboración contextual** de Jira, Linear y Notion
  con capacidades maduras de mensajería de Teams, Slack y Google Chat.
- Rocket.Chat y Matrix/Element hacen explícito que E2EE **degrada** búsqueda, agentes,
  auditoría, dispositivos y recuperación. No existe paridad gratuita con procesamiento
  server-side.
- Mattermost y Rocket.Chat muestran que el autohospedaje **traslada**, no elimina, la
  carga operativa: seguridad, upgrades, alta disponibilidad y soporte pasan al operador.
- La extensibilidad útil es contrato, evento y SDK. **La federación es una decisión
  separada y no debe entrar por analogía con Matrix** (D-122).
- Las capacidades de compliance observadas suelen depender de plan, licencia y servicios
  auxiliares. Workspace Chat debe modelar sus propias obligaciones, no copiar etiquetas
  comerciales.

### 15.1 Evaluación de componentes, sin selección de proveedor

Todas son **Propuestas**. La capacidad está confirmada; el proveedor no.

| Superficie                     | Tratamiento propuesto                                                                                                                                                   | Clasificación de la capacidad | Base de la capacidad |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :------------------- |
| Catálogo GIF                   | Abstracción y flag; revalidar términos, atribución, límites y coste antes de seleccionar proveedor                                                                      | MVP                           | D-049                |
| Antimalware                    | Adoptar motor o servicio detrás de la capacidad de medios; validar eficacia, falsos positivos, actualización y soporte                                                  | MVP                           | D-086                |
| Búsqueda no E2EE               | Evaluar búsqueda integrada en la persistencia frente a motor dedicado, sólo con evidencia de volumen y relevancia; todo índice conserva `application_id` y autorización | MVP                           | D-031, D-093         |
| Componentes E2EE               | Adoptar primitivas maduras y auditables tras spike, threat model y revisión de seguridad; no diseñar criptografía propia                                                | MVP                           | D-089                |
| Búsqueda sobre E2EE            | Mantener búsqueda local sobre contenido cargado y descifrado; **no** crear índice central de plaintext en el MVP                                                        | MVP                           | D-092                |
| **Servicio de llaves KMS/HSM** | **Construir o contratar.** No existe hoy; es dependencia crítica de D-091                                                                                               | MVP                           | **D-147**            |
---

## 16. Gap analysis consolidado

Una brecha describe la distancia entre el estado actual y una capacidad vigente. **No
convierte por sí misma una propuesta, una práctica de mercado o una paridad con un
proveedor en requisito.** Cada fila lleva una sola clasificación y un solo tipo de
afirmación (corrección G-8).

### 16.1 Brechas funcionales y de experiencia

| Brecha                             | Estado actual                                                 | Estado objetivo vigente                                                                                                  | Clasificación | Tipo                | Base                           |
| :--------------------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- | :------------ | :------------------ | :----------------------------- |
| Conversación contextual            | Vive fuera de OBP, en un canal de Teams                       | Núcleo `application + contextType + contextId`, embebible y reutilizable                                                 | MVP           | Decisión confirmada | D-002, D-123                   |
| Aplicación central                 | No existe cliente propio multiaplicación                      | Agregación autorizada que preserva aislamiento                                                                           | MVP           | Decisión confirmada | D-044                          |
| Contextos, temas y privacidad      | Los aporta el proveedor                                       | `General`, temas de aplicación y manuales públicos o privados con privacidad fija                                        | MVP           | Decisión confirmada | D-011, D-045, D-081            |
| **Ciclo de vida del contexto**     | Teams no distingue archivado de eliminación                   | Archivado en lugar de borrado, `externalId` inmutable, sin fusión ni división                                            | MVP           | Decisión confirmada | **D-136, D-137, D-138**        |
| **Alta de aplicación consumidora** | No existe mecanismo; el modelo es de facto monoaplicación     | Alta por consola con responsable funcional, políticas y credenciales                                                     | MVP           | Decisión confirmada | **D-133, D-134**               |
| Identidad y membresía              | Repartidas entre Teams, OBP, Tasks y Make                     | SSO, fotografía histórica, administradores explícitos, solo lectura y scopes separados                                   | MVP           | Decisión confirmada | D-003, D-016, D-082, D-084     |
| **Definición del rol miembro**     | Inexistente en el material previo                             | Facultades del rol base explícitamente definidas                                                                         | MVP           | Decisión confirmada | **D-155, D-156**               |
| Mensajería y contenido             | Dependen de Teams y SharePoint/OneDrive                       | Capacidades propias de mensajería, subconversaciones, programados, fijados y media segura                                | MVP           | Decisión confirmada | D-124, D-125, D-047            |
| **Etiquetas de mención**           | Make resuelve equipos desde Tasks                             | Etiquetas propias gestionadas por el administrador contextual                                                            | MVP           | Decisión confirmada | **D-158**                      |
| Seguridad de adjuntos              | El proveedor resuelve almacenamiento y parte de los controles | Validación de MIME, extensión y tamaño, cuarentena, antimalware obligatorio, bloqueo seguro, URL firmada y auditoría     | MVP           | Decisión confirmada | D-086                          |
| Actividad de negocio               | Make transforma eventos dispersos en mensajes del proveedor   | Actividad humana y automática unificada; el productor conserva el estado oficial                                         | MVP           | Decisión confirmada | D-006, D-128                   |
| Realtime, no leídos y avisos       | Los entrega Teams y Make dispara avisos                       | Persistencia propia, realtime, contadores, Hub y correo                                                                  | MVP           | Decisión confirmada | D-126, D-030, D-061            |
| Búsqueda                           | Depende de Teams                                              | Búsqueda autorizada por aplicación, por aplicación seleccionada en el cliente central, con degradación explícita en E2EE | MVP           | Decisión confirmada | D-031, **D-157**, D-092        |
| E2EE                               | No existe capacidad propia                                    | Política configurable, frontera por tema, recuperación corporativa y procesadores mínimos                                | MVP           | Decisión confirmada | D-089–D-092, **D-131, D-132**  |
| Retención y compliance             | No existen políticas ni ejecución propias                     | Retención por capas, purga verificable, hold y exportación gobernados, residencia                                        | MVP           | Decisión confirmada | D-098, D-099, **D-152, D-153** |
| Agente de campañas                 | Existe un agente externo separado de la conversación          | MCP explícito, solo lectura y autorización independiente de usuario y agente                                             | MVP           | Decisión confirmada | D-103, D-106                   |
| Administración y analítica         | Dispersas entre Teams, Make y herramientas sueltas            | Panel propio, `break-glass`, analítica general agregada y auditoría por vía separada                                     | MVP           | Decisión confirmada | D-058, D-083, **D-161**, D-109 |
| Cliente móvil                      | No existe cliente propio                                      | Cliente móvil únicamente en línea, con estado desconectado                                                               | MVP           | Decisión confirmada | D-087, D-088                   |

### 16.2 Brechas técnicas y arquitectónicas

| Brecha                               | Tratamiento objetivo                                                                                                                                     | Clasificación              | Tipo                    | Base                    |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :---------------------- | :---------------------- |
| Origen de eventos                    | El productor confirma el cambio y registra después el evento durable; una caída de Chat no revierte el negocio                                           | MVP                        | Decisión confirmada     | **D-141**, D-008, D-009 |
| Entrega confiable                    | Outbox o mecanismo durable equivalente, cola, reintentos, DLQ, idempotencia y trazabilidad end-to-end                                                    | MVP                        | **Inferencia aceptada** | D-010                   |
| Exigibilidad del invariante          | Requisito de contrato **sin** prueba obligatoria, declaración en el alta ni verificación en ejecución                                                    | MVP                        | Decisión confirmada     | **D-142**               |
| Contratos                            | Ownership distribuido, versionado, convivencia temporal y pruebas de compatibilidad                                                                      | MVP                        | Decisión confirmada     | D-115                   |
| Documentación de contratos           | Versiones y responsables en los repositorios correspondientes                                                                                            | Preparación arquitectónica | Decisión confirmada     | D-116                   |
| Realtime                             | Persistir antes de emitir; soportar reconexión, resincronización y deduplicación                                                                         | MVP                        | **Inferencia aceptada** | D-126                   |
| Aislamiento — invariante             | `application_id`, autorización server-side y segunda barrera a nivel de datos, con controles equivalentes en archivos, caché, búsqueda, colas y realtime | MVP                        | Decisión confirmada     | D-093, **D-162**        |
| Aislamiento — tecnología             | Motor de persistencia y mecanismo concreto de la segunda barrera                                                                                         | MVP                        | **Propuesta**           | **D-162**, anexo A      |
| Frontera futura de tenant            | Mantener `tenant_id` separado de `application_id`                                                                                                        | Preparación arquitectónica | Decisión confirmada     | D-095                   |
| Almacenamiento dedicado              | Sólo ante disparador demostrado                                                                                                                          | Posterior al MVP           | Decisión confirmada     | D-094                   |
| Media y antimalware — controles      | Cuarentena, validación y análisis obligatorio antes de disponibilidad                                                                                    | MVP                        | Decisión confirmada     | D-086, D-092            |
| Media y antimalware — implementación | Capacidad de medios desacoplada que almacene binarios; selección de motor diferida                                                                       | MVP                        | **Inferencia aceptada** | `07`, D-086             |
| Protocolo E2EE                       | Adoptar componentes maduros y auditables mediante spike y revisión de seguridad                                                                          | MVP                        | **Propuesta**           | D-089                   |
| **Servicio de llaves KMS/HSM**       | **Construir o contratar; no existe**                                                                                                                     | MVP                        | Decisión confirmada     | **D-147**               |
| Componentes y licencias              | Validar términos, límites, soporte, actualización y coste antes de seleccionar                                                                           | MVP                        | **Propuesta**           | `14`, `15`              |
| Operación propia                     | Asumir seguridad, backups, resiliencia, actualización y soporte básico de los componentes adoptados                                                      | MVP                        | **Inferencia aceptada** | D-111                   |
| Observabilidad                       | Logs, métricas básicas, salud, correlación y alertas                                                                                                     | MVP                        | Decisión confirmada     | D-111                   |
| Objetivos operativos                 | Instrumentar primero y fijar valores con evidencia                                                                                                       | Preparación arquitectónica | Decisión confirmada     | D-112                   |
| DLP                                  | Preservar puntos de integración                                                                                                                          | Preparación arquitectónica | Decisión confirmada     | D-101                   |

### 16.3 Brechas operativas y de gobierno

| Brecha                                   | Tratamiento requerido                                                                                              | Clasificación    | Tipo                | Base                    |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :--------------- | :------------------ | :---------------------- |
| Estructura organizacional                | Todos los scopes se ejercen desde el equipo de producto; la separación es del sistema, no de la organización       | MVP              | Decisión confirmada | **D-148, D-149, D-151** |
| Separación de funciones en `break-glass` | Solicitud desde coordinación y desarrollo; aprobación exclusivamente desde gerencia                                | MVP              | Decisión confirmada | **D-150**               |
| Ownership nominal                        | Asignar responsables de producto, operación, seguridad y contratos antes de la entrega                             | MVP              | **Propuesta**       | DF-010                  |
| Administradores predeterminados          | El responsable funcional designado en el alta gobierna la política; Chat evita contextos activos sin administrador | MVP              | Decisión confirmada | D-085, **D-134**        |
| Incidentes y contenido inseguro          | Guías operativas breves, escalamiento y evidencia sobre la observabilidad confirmada                               | MVP              | **Propuesta**       | D-111                   |
| Gobierno de datos                        | Materializar retención, restauración con tombstones, exportación puntual y control de acceso sin lectura ordinaria | MVP              | Decisión confirmada | D-098, D-099, **D-153** |
| Datos personales                         | Heredar el marco corporativo; derechos del titular fuera del alcance del producto                                  | MVP              | Decisión confirmada | **D-139, D-140**        |
| Gobierno del agente                      | Validar por separado usuario y agente; bloquear E2EE y `break-glass`; auditar y permitir revocación                | MVP              | Decisión confirmada | D-106, D-107, D-108     |
| Privacidad analítica                     | Agregar métricas privadas y E2EE sin contenido ni dimensiones identificables; separar observabilidad de auditoría  | MVP              | Decisión confirmada | D-109                   |
| Operación proporcional                   | Atención dentro de la operación normal, sin guardia 24/7 ni centro de soporte dedicado                             | MVP              | Decisión confirmada | D-111                   |
| Gestión del alcance ampliado             | Entregar controlando exposición mediante activación por aplicación                                                 | MVP              | Decisión confirmada | **D-145**               |
| Secuencia de entrega                     | Fuera del Paso 0; la construcción por verticales permanece como inferencia no vinculante                           | Fuera de alcance | Decisión confirmada | **D-146**               |
| Coste y supply chain                     | Medir coste total y revalidar condiciones antes de procurement                                                     | MVP              | **Propuesta**       | `14`, `18`              |

### 16.4 Brechas de migración específicas de OBP

| Brecha                           | Tratamiento                                                                                                                                                                             | Clasificación | Tipo                    | Base         |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :---------------------- | :----------- |
| Campañas elegibles               | Migrar toda campaña que al corte no esté cerrada ni cancelada y todavía requiera colaboración operativa, salvo exclusión expresa                                                        | MVP           | Decisión confirmada     | D-119        |
| Autoridad de exclusión           | La exclusión expresa corresponde a la **gerencia del equipo de producto**                                                                                                               | MVP           | Decisión confirmada     | **D-154**    |
| Estructura, membresía y archivos | Preservar roles y autoría disponibles; analizar archivos antes de liberarlos                                                                                                            | MVP           | Decisión confirmada     | D-120, D-086 |
| Mensajes y relaciones históricas | Migrar mensajes, replies, reacciones, ediciones y eliminaciones lógicas preservando estructura, fechas y autoría; identidades no resolubles quedan como atribución histórica sin acceso | MVP           | Decisión confirmada     | D-120        |
| Retención de campaña activa      | Mantener historial visible y operativo mientras la campaña siga activa; relojes desde la inactividad                                                                                    | MVP           | Decisión confirmada     | D-120        |
| Corte y convivencia              | Congelar escritura, migrar delta final, validar, dejar Teams temporalmente en solo lectura y archivarlo, sin convivencia operativa permanente                                           | MVP           | Decisión confirmada     | D-121        |
| Reconciliación                   | Comparar conteos, checksums, permisos y excepciones antes de abrir el contexto migrado                                                                                                  | MVP           | **Propuesta**           | `16`         |
| Contextos E2EE destino           | Si el destino es E2EE, el migrador participa explícitamente y cifra, sin usar recuperación corporativa como vía ordinaria                                                               | MVP           | **Inferencia aceptada** | D-092        |

### 16.5 Capacidades que

**no** deben interpretarse como brechas del MVP

| Capacidad                                                                                                                                                                                                                                                                                                                                                                                                                              | Clasificación              | Base                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Push móvil, webhooks salientes, identidad externa, gateway MCP, DLP, documentación de contratos, frontera de tenant e instrumentación operativa                                                                                                                                                                                                                                                                                        | Preparación arquitectónica | D-062, D-063, D-064, D-127, D-101, D-116, D-095, D-112                                                                                          |
| Agente en E2EE, escritura y proactividad MCP, búsqueda central completa E2EE, DLP avanzado, analítica identificable, invitaciones B2B/B2C, guardia 24/7, comité de contratos, almacenamiento dedicado, **presencia y confirmaciones de lectura**, filtros avanzados de búsqueda                                                                                                                                                        | Posterior al MVP           | D-107, D-105, D-096, D-102, D-110, D-065, D-113, D-117, D-094, **D-159**                                                                        |
| Chat corporativo, DMs, canales generales, llamadas y video, operación móvil offline, agente durante `break-glass`, portal Legal, SLA contractual, centro de soporte, tareas y resolución, calendarios, mensajes efímeros, moderación avanzada, silenciar temas, federación, **descubrimiento abierto**, **fusión y división de contextos**, **excepciones de retención por contexto**, **derechos del titular como capacidad**, Bitrix | Fuera de alcance           | D-073, D-074, D-088, D-108, D-100, D-114, D-015, D-066, D-067, D-068, D-056, D-122, **D-160**, **D-138**, **D-152**, **D-140**, D-118/**D-163** |

### 16.6 Propuestas para reducir incertidumbre

- Spikes de entrega durable, E2EE y recuperación, media y antimalware, búsqueda,
  integración MCP y exportación de Teams.
- Threat model y revisión de aislamiento, llaves, procesadores, adjuntos, agente y acceso
  excepcional.
- Prueba de degradación de SSO, productores, Tasks, Hub, media, colas, servicio de llaves
  y agente.
- Prueba representativa de migración con reconciliación y reporte de excepciones.
- **Evaluación de construcción o contratación del servicio de llaves KMS/HSM** (D-147).
## 17. Migración específica de OBP desde Teams

### 17.1 Frontera de la estrategia

| Regla                                                                                                                                                                            | Clasificación    | Regla          | Base         |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :------------- | :----------- |
| Todo contenido importado queda sujeto a las mismas fronteras de aplicación, autorización, privacidad, retención, auditoría, adjuntos y E2EE que el contenido creado directamente | MVP              | Genérica       | `16`, D-086  |
| La migración desde Teams es una transición controlada del primer caso de uso. **No** convierte canal, publicaciones, Teams, SharePoint, OneDrive ni Make en conceptos del núcleo | MVP              | Específica OBP | D-005        |
| Teams o Slack como canal operativo permanente o puente duradero                                                                                                                  | Fuera de alcance | Genérica       | D-070, D-121 |
| Make se sustituye gradualmente; después del corte de una campaña no debe seguir creando actividad operativa en Teams para esa campaña                                            | MVP              | Específica OBP | D-007, D-121 |

### 17.2 Alcance de la migración — decisiones confirmadas

| Capacidad o regla                 | Tratamiento vigente                                                                                                                        | Clasificación    | Base      |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :-------- |
| Elegibilidad                      | Campaña activa si al corte no está cerrada ni cancelada y todavía requiere colaboración operativa; se migran todas salvo exclusión expresa | MVP              | D-119     |
| Autoridad de exclusión            | **Gerencia del equipo de producto**                                                                                                        | MVP              | **D-154** |
| Campañas no elegibles o excluidas | No forman parte de esta migración; no se promete backfill posterior                                                                        | Fuera de alcance | D-119     |
| Contexto y estructura             | La campaña se convierte en contexto; se migran estructura de temas, participantes, administradores y archivos                              | MVP              | D-120     |
| Historial disponible              | Mensajes, replies, reacciones, ediciones y eliminaciones lógicas disponibles, preservando relaciones, fechas y autoría                     | MVP              | D-120     |
| Atribución histórica              | Una identidad no resoluble contra SSO se conserva como autor histórico **sin** sesión, membresía ni permisos                               | MVP              | D-120     |
| Seguridad de adjuntos             | Ningún archivo queda disponible antes de validar MIME, extensión y tamaño, y de superar el antimalware                                     | MVP              | D-086     |
| Retención de campaña activa       | Todo el historial permanece visible y operativo mientras la campaña siga activa                                                            | MVP              | D-120     |
| Corte por campaña                 | Congelamiento, delta final, validación, solo lectura temporal y archivado, sin convivencia operativa permanente                            | MVP              | D-121     |

### 17.3 Invariantes de transformación — decisiones confirmadas

- El canal de Teams **no** se conserva como entidad canónica; la campaña ocupa el contexto
  genérico y `General` y los temas automáticos conservan sus reglas públicas de OBP
  (D-005, D-079).
- Un tema manual con historial importado debe tener definida su privacidad **antes** de
  recibir el primer mensaje; la migración no puede reclasificar después el historial ni
  conceder lectura implícita a administradores (D-081).
- Antes de abrir el contexto debe existir al menos un **administrador contextual activo**.
  Si la resolución de identidades lo deja huérfano, un administrador de aplicación puede
  recuperarlo **sin leer mensajes** (D-085).
- Una identidad resoluble sólo obtiene acceso si además corresponde a una membresía
  migrada y conserva cuenta SSO activa; la atribución histórica **nunca** activa una
  cuenta (D-120, D-021).
- Ediciones y eliminaciones lógicas importadas conservan la evidencia disponible y **no
  reaparecen** como contenido vigente (D-023).
- Después del corte, Make no sigue generando actividad operativa en Teams para la campaña
  migrada (D-121).

### 17.4 Inferencias aceptadas

- Los roles destino son únicamente administrador contextual, miembro o solo lectura; no se
  derivan privilegios de roles amplios de OBP o Teams.
- `Historial disponible` significa recuperable con las interfaces y permisos autorizados
  al momento del corte; **no** promete reconstruir contenido ya purgado o ausente.
- Los binarios se copian a la capacidad de medios y **no** dejan enlaces permanentes a
  Teams, SharePoint u OneDrive.
- Cada reply conserva su relación con el mensaje raíz. Si no puede representarse
  fielmente, se registra una **excepción** en lugar de aplanar o inventar la estructura.
- Si el destino usa E2EE, el migrador y el analizador participan explícitamente y el
  contenido se cifra antes de publicarse.
- La migración **no libera ni sustituye** un legal hold de origen.
- Los identificadores de origen son metadata de trazabilidad; no sustituyen los
  identificadores canónicos ni las fronteras de autorización.
- Una exclusión expresa afecta la elegibilidad de la campaña, **no** concede excepción a
  las políticas de seguridad o gobierno de datos.

### 17.5 Secuencia confirmada

1. Congelar la escritura operativa de la campaña en Teams.
2. Exportar y migrar el delta final manteniendo Workspace Chat cerrado.
3. Aplicar el delta de forma idempotente y validar el resultado.
4. Abrir Workspace Chat como **única** superficie operativa y dejar Teams temporalmente en
   solo lectura.
## 5. Archivar Teams conforme al gobierno aplicable, sin puente permanente.

### 17.6 Propuestas y supuestos

- **Propuesta:** prueba con una campaña representativa; inventario de volumen, relaciones,
  identidades, permisos, archivos y política E2EE destino.
- **Propuesta:** reconciliación de conteos, checksums, autorías, membresías, resultados
  antimalware y excepciones antes de abrir el contexto.
- **Propuesta:** etiquetar procedencia e impedir que el historial importado dispare
  notificaciones, acciones o efectos de negocio como si fuera contenido nuevo.
- **Propuesta:** si la validación falla, no abrir Chat ni habilitar dos superficies de
  escritura; corregir o repetir desde un punto de control.
- **Supuesto:** estarán disponibles los permisos de exportación de Teams, Graph y
  repositorios de archivos; las señales de campaña activa o inactiva; los identificadores
  SSO; la capacidad de medios; y la posibilidad de redirigir la actividad posterior al
  corte (A-010, A-011).
## 18. Matriz consolidada de alcance

Cada fila lleva una sola clasificación, un solo tipo de afirmación y su identificador de
decisión (D-130, corrección G-4). Las filas en **negrita** proceden del registro de cierre
`20.1` y no existían en el consolidado anterior.

### 18.1 MVP

| Capacidad                                                                                                                  | Regla                            | Tipo                | Base                |
| :------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | :------------------ | :------------------ |
| Núcleo contextual multiaplicación `application + contextType + contextId`                                                  | Genérica                         | Decisión confirmada | D-002, D-004        |
| Identidad corporativa mediante SSO Integral, sin credenciales de usuario propias                                           | Genérica                         | Decisión confirmada | D-003               |
| **Alta de aplicación consumidora desde consola por administrador global**                                                  | Genérica                         | Decisión confirmada | **D-133**           |
| **Registro de aplicación con responsable funcional, política de administradores, retención, política E2EE y credenciales** | Genérica                         | Decisión confirmada | **D-134**           |
| **Credenciales propias de aplicación, distintas de la identidad de personas**                                              | Genérica                         | Decisión confirmada | **D-135**           |
| **Activación modular de capacidades por aplicación**                                                                       | Genérica                         | Decisión confirmada | **D-145**           |
| Componente embebido contextual y no invasivo                                                                               | Genérica                         | Decisión confirmada | D-123               |
| Aislamiento de la experiencia embebida a la aplicación actual                                                              | Genérica                         | Decisión confirmada | D-028               |
| Aplicación central multiaplicación sin bypass de aislamiento                                                               | Genérica                         | Decisión confirmada | D-044               |
| Clientes web y móvil separados con dominio y contratos compartidos                                                         | Genérica                         | Decisión confirmada | D-078, **D-162**    |
| Operación móvil únicamente en línea con estado desconectado                                                                | Genérica                         | Decisión confirmada | D-087               |
| Invariante de aislamiento: `application_id`, autorización server-side y segunda barrera a nivel de datos                   | Genérica                         | Decisión confirmada | D-093, **D-162**    |
| Contextos genéricos y tema `General` predeterminado                                                                        | Genérica                         | Decisión confirmada | D-002, D-011        |
| Temas administrados por aplicación                                                                                         | Genérica                         | Decisión confirmada | **D-080**           |
| Temas manuales creados sólo por administradores contextuales                                                               | Genérica                         | Decisión confirmada | D-014               |
| Privacidad de tema manual, fija tras el primer mensaje                                                                     | Genérica                         | Decisión confirmada | D-045, D-081        |
| Membresía contextual y membresía de tema privado                                                                           | Genérica                         | Decisión confirmada | D-016, D-045        |
| **Archivado del contexto ante eliminación del objeto de negocio; nunca borrado**                                           | Genérica                         | Decisión confirmada | **D-136**           |
| **`displayName` actualizable, `externalId` inmutable**                                                                     | Genérica                         | Decisión confirmada | **D-137**           |
| Roles administrador contextual, miembro y solo lectura                                                                     | Genérica                         | Decisión confirmada | D-084               |
| **Definición de facultades del rol miembro**                                                                               | Genérica                         | Decisión confirmada | **D-155**           |
| **Un miembro nunca añade participantes**                                                                                   | Genérica                         | Decisión confirmada | **D-156**           |
| Scopes administrativos separados, sin lectura automática                                                                   | Genérica                         | Decisión confirmada | D-082               |
| **Separación de scopes del sistema, independiente de la estructura organizacional**                                        | Genérica                         | Decisión confirmada | **D-149**           |
| **Mapeo de scopes: gerencia como administrador global y Seguridad/Compliance**                                             | Genérica                         | Decisión confirmada | **D-151**           |
| Acceso `break-glass` gobernado                                                                                             | Genérica                         | Decisión confirmada | D-083               |
| **`break-glass`: solicitud desde coordinación y desarrollo, aprobación desde gerencia**                                    | Genérica                         | Decisión confirmada | **D-150**           |
| Gobierno de administradores y recuperación de contextos huérfanos                                                          | Genérica                         | Decisión confirmada | D-085               |
| Subconversaciones configurables                                                                                            | Genérica                         | Decisión confirmada | D-047               |
| Archivado manual y automático configurable                                                                                 | Genérica                         | Decisión confirmada | D-027, D-060        |
| Cronología unificada de actividad humana y automática                                                                      | Genérica                         | Decisión confirmada | D-006               |
| Mensajería base: texto, emojis, reacciones, menciones individuales y respuestas citadas                                    | Genérica                         | Decisión confirmada | D-124               |
| Edición y eliminación lógica auditadas                                                                                     | Genérica                         | Decisión confirmada | D-023, D-024        |
| Eventos de negocio inmutables desde Chat                                                                                   | Genérica                         | Decisión confirmada | D-025               |
| Adjuntos multimedia con previsualización básica; video como adjunto                                                        | Genérica                         | Decisión confirmada | D-125               |
| Seguridad obligatoria de adjuntos                                                                                          | Genérica                         | Decisión confirmada | D-086               |
| Catálogo GIF con abstracción desacoplada                                                                                   | Genérica                         | Decisión confirmada | D-049               |
| Mensajes programados con revalidación de permisos                                                                          | Genérica                         | Decisión confirmada | D-053               |
| Mensajes fijados                                                                                                           | Genérica                         | Decisión confirmada | D-054               |
| Menciones masivas y por etiqueta                                                                                           | Genérica                         | Decisión confirmada | D-055               |
| **Etiquetas de mención definidas dentro de Workspace Chat**                                                                | Genérica                         | Decisión confirmada | **D-158**           |
| Realtime de mensajes y actividad                                                                                           | Genérica                         | Decisión confirmada | D-126               |
| Contrato genérico de eventos versionado, autorizado e idempotente                                                          | Genérica                         | Decisión confirmada | D-080, D-115        |
| **Invariante genérico de confiabilidad del productor**                                                                     | Genérica                         | Decisión confirmada | **D-141**           |
| **Exigibilidad del invariante sólo por contrato**                                                                          | Genérica                         | Decisión confirmada | **D-142**           |
| Emisión post-persistencia y no bloqueo del negocio                                                                         | Genérica validada primero en OBP | Decisión confirmada | D-008, D-009        |
| Rich cards y acciones gobernadas                                                                                           | Genérica                         | Decisión confirmada | D-057               |
| Contadores globales, por contexto y por tema, con indicador de mención                                                     | Genérica                         | Decisión confirmada | D-030               |
| Hub de Notificaciones y correo                                                                                             | Genérica                         | Decisión confirmada | D-030, D-061        |
| Búsqueda por aplicación                                                                                                    | Genérica                         | Decisión confirmada | D-031               |
| **Búsqueda en cliente central por aplicación seleccionada**                                                                | Genérica                         | Decisión confirmada | **D-157**           |
| Búsqueda local limitada en contextos E2EE                                                                                  | Genérica                         | Decisión confirmada | D-092               |
| Gobierno distribuido de contratos                                                                                          | Genérica                         | Decisión confirmada | D-115               |
| E2EE configurable por aplicación y contexto                                                                                | Genérica                         | Decisión confirmada | D-089, **D-132**    |
| **Fundamento de E2EE: confidencialidad comercial, sin obligación externa**                                                 | Genérica                         | Decisión confirmada | **D-131**           |
| Recuperación corporativa E2EE — **decisión condicionada**                                                                  | Genérica                         | Decisión confirmada | D-091, **D-147**    |
| Procesadores imprescindibles con alcance mínimo                                                                            | Genérica                         | Decisión confirmada | D-092               |
| Política E2EE inicial de OBP sin cifrado por defecto                                                                       | Específica OBP                   | Decisión confirmada | D-090               |
| Retención por cinco capas                                                                                                  | Genérica                         | Decisión confirmada | D-098               |
| Legal hold y exportación puntual gobernados                                                                                | Genérica                         | Decisión confirmada | D-099, **D-153**    |
| Residencia en la región aprobada                                                                                           | Genérica                         | Decisión confirmada | D-099               |
| **Herencia del marco corporativo de datos personales**                                                                     | Genérica                         | Decisión confirmada | **D-139**           |
| Invocación MCP explícita y de solo lectura                                                                                 | Genérica                         | Decisión confirmada | D-103               |
| Agente en tema manual privado no E2EE con membresía técnica                                                                | Genérica                         | Decisión confirmada | D-106               |
| Retención técnica del agente                                                                                               | Genérica                         | Decisión confirmada | D-104               |
| Agente externo de campañas como primer caso                                                                                | Específica OBP                   | Decisión confirmada | D-103               |
| Panel de administración                                                                                                    | Genérica                         | Decisión confirmada | D-058               |
| **Analítica general agregada de uso y operación**                                                                          | Genérica                         | Decisión confirmada | **D-161**           |
| Analítica agregada sin contenido en temas privados y E2EE                                                                  | Genérica                         | Decisión confirmada | D-109               |
| Observabilidad básica y atención en operación normal                                                                       | Genérica                         | Decisión confirmada | D-111               |
| Migración de campañas elegibles, historial completo, retención activa y corte                                              | Específica OBP                   | Decisión confirmada | D-119, D-120, D-121 |
| **Autoridad de exclusión: gerencia del equipo de producto**                                                                | Específica OBP                   | Decisión confirmada | **D-154**           |
**Inferencias aceptadas dentro de capacidades MVP:** entrega durable (D-010); realtime con
reconexión y resincronización; grabación de audio; capacidad de medios desacoplada;
transformación de roles y trazabilidad en migración; operación de componentes propios o
adoptados.

**Propuestas dentro de capacidades MVP:** selección de proveedores de GIF, antimalware,
búsqueda y componentes E2EE; construcción o contratación del servicio de llaves; spikes;
threat model; reconciliación de migración; responsables nominales; configuración concreta
de paneles, límites y herramientas; **tecnologías concretas de persistencia y cliente
(anexo A)**.

### 18.2 Preparación arquitectónica

| Capacidad                                                                     | Regla    | Tipo                | Base  |
| :---------------------------------------------------------------------------- | :------- | :------------------ | :---- |
| Frontera futura de `tenant_id`, separada de `application_id`                  | Genérica | Decisión confirmada | D-095 |
| Identidades externas y guest, sin habilitar invitaciones                      | Genérica | Decisión confirmada | D-064 |
| Registro de dispositivos para push y preferencias avanzadas de notificación   | Genérica | Decisión confirmada | D-062 |
| Webhooks salientes                                                            | Genérica | Decisión confirmada | D-063 |
| Documentación ligera de contratos en repositorios                             | Genérica | Decisión confirmada | D-116 |
| Puntos de integración con DLP corporativo                                     | Genérica | Decisión confirmada | D-101 |
| Gateway o adaptador MCP genérico                                              | Genérica | Decisión confirmada | D-127 |
| Instrumentación para SLO internos, RPO/RTO, capacidad, umbrales y presupuesto | Genérica | Decisión confirmada | D-112 |

### 18.3 Posterior al MVP

| Capacidad                                                                | Regla    | Tipo                | Base      |
| :----------------------------------------------------------------------- | :------- | :------------------ | :-------- |
| Almacenamiento dedicado por aplicación ante necesidad demostrada         | Genérica | Decisión confirmada | D-094     |
| Invitaciones B2B/B2C                                                     | Genérica | Decisión confirmada | D-065     |
| Búsqueda central completa e indexación confiable sobre E2EE              | Genérica | Decisión confirmada | D-096     |
| Filtros avanzados de búsqueda                                            | Genérica | **Propuesta**       | `17`:113  |
| Inspección DLP avanzada y clasificación automática                       | Genérica | Decisión confirmada | D-102     |
| Agente como participante o procesador criptográfico en E2EE              | Genérica | Decisión confirmada | D-107     |
| Escritura, cambios de negocio, proactividad y automatización del agente  | Genérica | Decisión confirmada | D-105     |
| Analítica identificable por tema privado o E2EE                          | Genérica | Decisión confirmada | D-110     |
| Guardia humana 24/7, programa formal de SLO y consola operativa avanzada | Genérica | Decisión confirmada | D-113     |
| Catálogo o comité central de contratos                                   | Genérica | Decisión confirmada | D-117     |
| **Presencia, indicador de escritura y confirmaciones de lectura**        | Genérica | Decisión confirmada | **D-159** |

### 18.4 Fuera de alcance

| Capacidad o límite                                                                                   | Regla          | Tipo                    | Base             |
| :--------------------------------------------------------------------------------------------------- | :------------- | :---------------------- | :--------------- |
| Historial y acciones móviles offline                                                                 | Genérica       | Decisión confirmada     | D-088            |
| Chat corporativo general                                                                             | Genérica       | Decisión confirmada     | D-073            |
| DMs, grupos y canales corporativos generales                                                         | Genérica       | **Inferencia aceptada** | D-073            |
| Federación                                                                                           | Genérica       | Decisión confirmada     | D-122            |
| **Descubrimiento abierto de conversaciones y solicitud de acceso**                                   | Genérica       | Decisión confirmada     | **D-160**        |
| **Fusión y división de contextos**                                                                   | Genérica       | Decisión confirmada     | **D-138**        |
| **Excepciones de retención por contexto**                                                            | Genérica       | Decisión confirmada     | **D-152**        |
| **Derechos del titular de datos personales como capacidad del producto**                             | Genérica       | Decisión confirmada     | **D-140**        |
| **Acción automática ante incumplimiento del invariante de confiabilidad**                            | Genérica       | Decisión confirmada     | **D-143**        |
| **Secuencia y orden de entrega como materia del Paso 0**                                             | Genérica       | Decisión confirmada     | **D-146**        |
| Silenciar tema o contexto                                                                            | Genérica       | Decisión confirmada     | D-056            |
| Tickets, tareas, responsables, SLA, resolución, workflow y conclusiones formales                     | Genérica       | Decisión confirmada     | D-015, D-097     |
| Mensajes efímeros                                                                                    | Genérica       | Decisión confirmada     | D-067            |
| Calendarios                                                                                          | Genérica       | Decisión confirmada     | D-066            |
| Moderación avanzada                                                                                  | Genérica       | Decisión confirmada     | D-068            |
| Integraciones adicionales no identificadas                                                           | Genérica       | Decisión confirmada     | D-069            |
| Llamadas, videollamadas, pantalla, grabación y transcripción síncrona                                | Genérica       | Decisión confirmada     | D-074            |
| Workspace Chat como fuente oficial o expediente del objeto de negocio                                | Genérica       | Decisión confirmada     | D-128            |
| Portal Legal, eDiscovery autoservicio, exportaciones masivas ordinarias y acceso permanente de Legal | Genérica       | Decisión confirmada     | D-100            |
| Embeddings propios de Workspace Chat                                                                 | Genérica       | Decisión confirmada     | D-104            |
| Agente durante `break-glass`                                                                         | Genérica       | Decisión confirmada     | D-108            |
| SLA contractual y centro de soporte permanente                                                       | Genérica       | Decisión confirmada     | D-114            |
| Campañas OBP no elegibles o excluidas                                                                | Específica OBP | Decisión confirmada     | D-119            |
| Teams o Slack como canal permanente                                                                  | Genérica       | Decisión confirmada     | D-070, D-121     |
| Bitrix y su flujo legado                                                                             | Específica OBP | Decisión confirmada     | D-118, **D-163** |

### 18.5 Pendiente de decisión

# **Ninguna capacidad.**

---

## 19. Riesgos, dependencias y supuestos

Un riesgo describe incertidumbre o exposición derivada del alcance vigente; **no incorpora
por sí mismo una capacidad nueva**. Probabilidad e impacto son valoraciones cualitativas
del Paso 0 y deben revisarse con evidencia.

### 19.1 Registro de riesgos

Todas las filas son **Inferencias aceptadas**.

| ID        | Riesgo                                                                                                                                                   | Prob.          | Impacto     | Señal temprana                                                                                                            | Regla                                                     | Base                           |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------- | :----------------------------- |
| R-001     | La amplitud del MVP deriva en una réplica generalista o en verticales incompletas                                                                        | Alta           | Alto        | Crecimiento de excepciones, superficies incompletas o trabajo sin vínculo con un contexto de negocio                      | Genérica                                                  | D-002, D-073, D-074, D-144     |
| R-002     | Una consulta, búsqueda, archivo, evento, contador o conexión realtime cruza fronteras de aplicación, contexto o tema privado                             | Media          | Crítico     | Relaciones cruzadas inválidas, denegaciones anómalas o diferencias entre API, barrera de datos y servicios auxiliares     | Genérica                                                  | D-028, D-082, D-093            |
| R-003     | Se pierden, duplican, desordenan o publican antes de tiempo eventos de negocio; una caída de Chat llega a bloquear al productor                          | Media          | **Crítico** | Diferencias entre commit y actividad persistida, reintentos envejecidos o duplicados visibles                             | Genérica                                                  | **D-141, D-142, D-143**        |
| R-004     | Un cambio incompatible u ownership difuso en SSO, eventos, Tasks, Hub, medios o MCP rompe consumidores o deja fallos sin responsable                     | Media          | Alto        | Versiones no documentadas, incompatibilidades tardías o incidentes transferidos entre equipos                             | Genérica                                                  | D-115, D-116, D-117            |
| R-005     | Identidades inestables, membresías mal resueltas o desactivaciones dejan acceso indebido, pierden autoría o crean contextos sin administrador            | Media          | Crítico     | Cuentas no resolubles fuera de migración, discrepancias entre SSO y membresía, o contextos huérfanos                      | Genérica; Tasks es especialización OBP                    | D-003, D-016–D-022, D-085      |
| R-006     | Un adjunto malicioso, sospechoso o no analizable queda visible, o la capacidad de medios impide compartir contenido de forma segura                      | Media          | Crítico     | Bypass de cuarentena, firmas desactualizadas, análisis vencidos o binarios servidos sin autorización                      | Genérica                                                  | D-086, D-092                   |
| R-007     | La implementación E2EE, la recuperación corporativa o un procesador imprescindible amplían acceso, pierden llaves o degradan disponibilidad              | **Media-Alta** | Crítico     | Recuperaciones fuera de alcance, fallos de rotación, procesadores sin alta explícita o contenido irrecuperable            | Genérica                                                  | D-089–D-092, **D-147**         |
| R-008     | Usuarios o aplicaciones esperan paridad funcional en E2EE y consideran defectos las degradaciones confirmadas                                            | Media          | Alto        | Incidencias por avisos sin cuerpo, búsqueda limitada o agente no disponible                                               | Genérica                                                  | D-092, D-096, D-107            |
| R-009     | Retención, purga, restauración, legal hold o exportación se aplican con periodos o alcances incorrectos, y Chat se interpreta como expediente permanente | Media          | Crítico     | Contenido visible u operativo vencido, tombstones reaparecidos, holds incompletos o exportaciones excesivas               | Genérica; D-120 introduce excepción OBP                   | D-098–D-104, D-120, **D-152**  |
| R-010     | Administración, soporte o `break-glass` se convierten en lectura ordinaria o recuperación E2EE sin aprobación y alcance válidos                          | Media          | Crítico     | **Accesos sin motivo, aprobación coincidente, sesiones sin expiración o llaves liberadas fuera del alcance**              | Genérica                                                  | D-082, D-083, **D-150**, D-091 |
| R-011     | El agente MCP hereda permisos del usuario, accede a temas no autorizados, filtra datos o amplifica una sesión E2EE o `break-glass`                       | Media          | Crítico     | Invocaciones sin membresía técnica, fuentes fuera del contexto, herramientas no permitidas o bloqueos omitidos            | Genérica; el agente de campañas es la especialización OBP | D-103–D-108                    |
| R-012     | Analítica u observabilidad reconstruyen contenido o comportamiento identificable de temas privados o E2EE                                                | Media          | Crítico     | Nombres, integrantes, prompts, búsquedas o archivos aparecen en tableros generales                                        | Genérica                                                  | D-109, D-110, **D-161**        |
| R-013     | El cliente móvil únicamente en línea pierde utilidad con conectividad inestable o muestra estado autorizado obsoleto al reconectar                       | Media          | Alto        | Sesiones desconectadas prolongadas, resincronización fallida o acciones ofrecidas sin conexión                            | Genérica                                                  | D-087, D-088                   |
| R-014     | Operar componentes propios o adoptados supera la capacidad normal de parches, respaldos, resiliencia, diagnóstico y atención                             | Media          | Alto        | Backups fallidos, vulnerabilidades sin atender, colas crecientes o incidentes sin respuesta en horario operativo          | Genérica                                                  | D-111–D-114, **D-148**         |
| R-015     | Licencias, términos, límites, coste, soporte u obsolescencia de APIs y componentes externos invalidan GIF, antimalware, búsqueda, E2EE o exportación     | Media          | Alto        | Cambio de términos, deprecaciones, límites agotados, firmas sin actualización o dependencia sin alternativa               | Genérica                                                  | D-049, D-086, D-092            |
| R-016     | Hub, correo o futuros canales de aviso fallan, filtran datos o generan ruido sin respetar privacidad y no leídos                                         | Media          | Alto        | Deep links denegados, cuerpo E2EE expuesto, contadores divergentes o baja utilidad de avisos                              | Genérica                                                  | D-030, D-061, D-092            |
| R-017     | El coste de historial, archivos, cuarentena, procesamiento, observabilidad o invocaciones MCP crece sin señales para gobernarlo                          | Media          | Alto        | Aumento sostenido de almacenamiento, campañas activas antiguas, payloads vencidos o coste por invocación                  | Genérica; incluye excepción OBP activa                    | D-098, D-104, D-112, D-120     |
| R-018     | Los usuarios mantienen conversaciones operativas fuera del contexto y no se reduce la dependencia de Teams o Google                                      | Media          | Alto        | Baja adopción embebida, doble captura o actividad posterior al corte en la superficie anterior                            | Genérica; se observa primero en OBP                       | D-002, D-007, D-028, D-073     |
| R-019     | La migración de campañas elegibles pierde relaciones, autoría, permisos, archivos o cambios del delta, o abre dos superficies de escritura               | Alta           | Crítico     | Diferencias de conteos o checksums, identidades ambiguas, excepciones omitidas o escritura en Teams tras el corte         | Específica OBP                                            | D-119–D-121, **D-154**         |
| R-020     | Una campaña OBP permanece activa indefinidamente y su excepción de retención acumula historial, coste y exposición de datos                              | Media          | Alto        | Edad o volumen anómalos, ausencia de transición a inactiva o crecimiento sin responsable funcional                        | Específica OBP                                            | D-120                          |
| **R-021** | **El servicio de llaves KMS/HSM no se construye o se retrasa, y E2EE queda sin recuperación corporativa operable**                                       | **Alta**       | **Crítico** | Ausencia de decisión de construcción o contratación, o de responsable asignado, antes de iniciar el trabajo criptográfico | Genérica                                                  | **D-147**, D-091               |
**Cambios registrados respecto del análisis anterior:**

- **R-003** conserva impacto Crítico pero **pierde su único control preventivo y
  correctivo**: D-142 elimina la prueba de integración obligatoria y D-143 elimina la
  reacción automática. Su tratamiento depende íntegramente de la disciplina de cada equipo
  productor y de la detección posterior mediante M-008. Debe reconsiderarse al integrar la
  segunda aplicación o si un productor queda fuera del control directo de la organización.
- **R-007** se eleva a probabilidad Media-Alta por D-147.
- **R-021** es nuevo y deriva directamente de D-147.
- **R-001** queda **sin mitigación documental** tras D-144 y D-146. La única palanca
  estructural disponible es D-145: desactivar una capacidad por aplicación sin reabrir su
  clasificación de alcance. Ésa es la vía prevista, **no** la reclasificación.

### 19.2 Dependencias vigentes

| ID          | Dependencia o frontera                                         | Condición relevante                                                                                                                                                               | Clasificación              | Tipo                    | Regla                                  | Base                           |
| :---------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :---------------------- | :------------------------------------- | :----------------------------- |
| DEP-001     | SSO Integral                                                   | Identidad, estado de cuenta, revocación y reautenticación reforzada                                                                                                               | MVP                        | Decisión confirmada     | Genérica                               | D-003, D-021, D-091            |
| DEP-002     | Sistemas productores y sus contratos                           | Actividad post-persistencia; el productor gobierna su contrato y Chat su adaptador                                                                                                | MVP                        | Decisión confirmada     | Genérica                               | **D-141**, D-115               |
| DEP-003     | Backend OBP y estado de campaña                                | Emite eventos sin bloquear el negocio e informa la condición activa o inactiva                                                                                                    | MVP                        | Decisión confirmada     | Específica OBP                         | D-008, D-009, D-119–D-121      |
| DEP-004     | Tasks                                                          | Aporta los equipos específicos usados para la **membresía inicial** de campañas. **Ya no resuelve menciones**                                                                     | MVP                        | Decisión confirmada     | Específica OBP                         | D-032, **D-158**               |
| DEP-005     | Hub de Notificaciones                                          | Centraliza avisos mientras Chat conserva los no leídos                                                                                                                            | MVP                        | Decisión confirmada     | Genérica                               | D-030                          |
| DEP-006     | Capacidad de medios y análisis antimalware                     | Almacena y entrega binarios sólo tras validación, cuarentena y análisis                                                                                                           | MVP                        | Decisión confirmada     | Genérica                               | D-086, D-092                   |
| DEP-007     | Persistencia y aislamiento de datos                            | `application_id`, autorización server-side, segunda barrera a nivel de datos y aislamiento equivalente en servicios auxiliares                                                    | MVP                        | Decisión confirmada     | Genérica                               | D-093, **D-162**               |
| DEP-008     | Entrega durable                                                | Mecanismo durable equivalente a Outbox, cola, reintentos, idempotencia y trazabilidad                                                                                             | MVP                        | **Inferencia aceptada** | Genérica                               | D-010                          |
| DEP-009     | Observabilidad operativa                                       | Salud, logs, métricas, correlación y alertas básicas                                                                                                                              | MVP                        | Decisión confirmada     | Genérica                               | D-111                          |
| **DEP-010** | **Servicio de llaves KMS/HSM**                                 | **No existe.** Debe construirse o contratarse para que D-091 sea ejecutable                                                                                                       | MVP                        | Decisión confirmada     | Genérica                               | **D-147**, D-091               |
| DEP-011     | Agente externo de campañas y contrato MCP                      | Invocación explícita de solo lectura con identidad, scopes, auditoría y revocación independientes                                                                                 | MVP                        | Decisión confirmada     | Específica OBP sobre contrato genérico | D-103–D-108                    |
| DEP-012     | Teams, Graph y repositorios de archivos autorizados            | Permiten exportar el historial disponible y el delta final                                                                                                                        | MVP                        | **Supuesto**            | Específica OBP y temporal              | D-119–D-121                    |
| DEP-013     | **Niveles jerárquicos del equipo de producto**                 | Gerencia ejerce administrador global y Seguridad/Compliance, aprueba `break-glass` y decide exclusiones; coordinación y desarrollo ejercen administración de aplicación y soporte | MVP                        | Decisión confirmada     | Genérica                               | **D-148, D-150, D-151, D-154** |
| DEP-014     | Conectividad del dispositivo móvil                             | El MVP móvil necesita conexión para consultar historial y ejecutar acciones                                                                                                       | MVP                        | Decisión confirmada     | Genérica                               | D-087, D-088                   |
| DEP-015     | Documentación de contratos en repositorios                     | Conserva versiones y responsables sin registro especializado                                                                                                                      | Preparación arquitectónica | Decisión confirmada     | Genérica                               | D-116                          |
| DEP-016     | Puntos de integración DLP                                      | Preservan una frontera futura; no bloquean el MVP                                                                                                                                 | Preparación arquitectónica | Decisión confirmada     | Genérica                               | D-101, D-102                   |
| DEP-017     | Proveedores o componentes de GIF, antimalware, búsqueda y E2EE | La selección debe validar licencia, límites, seguridad, soporte, coste y mantenibilidad                                                                                           | MVP                        | **Propuesta**           | Genérica                               | `15`                           |
**Ya no son dependencias:** áreas corporativas de Legal/Compliance, Seguridad de la
información y TI (D-148). Sus funciones se ejercen desde el equipo de producto conforme a
D-151. La dependencia de una **Dirección corporativa** para exclusiones de migración
desaparece por D-154.

### 19.3 Supuestos vigentes

| ID    | Supuesto                                                                                                                                                                                                       | Evidencia o validación propuesta                                                       | Regla                                  |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :------------------------------------- |
| A-001 | SSO ofrece identificador estable, estado de cuenta, revocación, OIDC/JWT/JWKS y reautenticación suficiente para dispositivos E2EE                                                                              | Contrato y prueba de integración autorizada                                            | Genérica                               |
| A-002 | Los productores pueden emitir después de persistir sin acoplar su éxito a Chat                                                                                                                                 | Spike end-to-end y prueba de indisponibilidad. **Recomendada, no obligatoria** (D-142) | Genérica; OBP primera validación       |
| A-003 | Tasks, Hub y las demás dependencias exponen contratos gobernados con disponibilidad suficiente                                                                                                                 | Responsables, versiones, límites y pruebas de degradación                              | Genérica; Tasks específico OBP         |
| A-004 | La capacidad de medios y el antimalware procesan los formatos admitidos sin liberar contenido inseguro                                                                                                         | Spike de cuarentena, carga, falsos positivos y bloqueo seguro                          | Genérica                               |
| A-005 | ~~La infraestructura dispone de KMS/HSM~~ → **Refutado.** Convertido en DEP-010 y R-021                                                                                                                        | —                                                                                      | Genérica                               |
| A-006 | El volumen inicial no exige almacenamiento dedicado por aplicación                                                                                                                                             | Pruebas de carga y aislamiento; D-094 gobierna el disparador futuro                    | Genérica                               |
| A-007 | El agente de campañas cumple minimización, licencias, identidad y scopes de solo lectura, y puede revocarse                                                                                                    | Prueba MCP con fuentes, permisos, auditoría y bloqueos negativos                       | Específica OBP sobre contrato genérico |
| A-008 | La conectividad esperada hace útil el cliente móvil únicamente en línea                                                                                                                                        | Medición de desconexión, reconexión, resincronización y utilidad                       | Genérica                               |
| A-009 | La telemetría puede agregarse sin exponer contenido ni dimensiones identificables                                                                                                                              | Revisión de esquema, cardinalidad, accesos y consultas                                 | Genérica                               |
| A-010 | ~~Dirección comunica exclusiones~~ → **Resuelto por D-154:** la exclusión corresponde a la gerencia del equipo. Persiste la parte de que OBP informe de forma confiable la transición activa/inactiva          | Reconciliación del estado de campaña                                                   | Específica OBP                         |
| A-011 | Los permisos de Teams, Graph y SharePoint permiten recuperar a tiempo todo el historial disponible                                                                                                             | Exportación representativa con mensajes, relaciones, autoría y archivos                | Específica OBP y temporal              |
| A-012 | ~~La organización asigna responsables funcionales, operativos, de seguridad y de contrato~~ → **Resuelto por D-148 y D-151:** todos los scopes se ejercen desde el equipo de producto, con el mapeo confirmado | —                                                                                      | Genérica                               |

### 19.4 Controles confirmados que reducen exposición

| Control vigente                                                                               | Riesgos cubiertos   | Base                |
| :-------------------------------------------------------------------------------------------- | :------------------ | :------------------ |
| Aislamiento por `application_id`, autorización server-side y segunda barrera a nivel de datos | R-002, R-012        | D-093, D-162        |
| Ownership distribuido y versionado con convivencia temporal y pruebas de compatibilidad       | R-003, R-004, R-015 | D-115               |
| Cuarentena, antimalware obligatorio, bloqueo seguro, URL firmada y auditoría de adjuntos      | R-006, R-019        | D-086, D-092        |
| Scopes administrativos separados, sin lectura implícita                                       | R-005, R-010, R-012 | D-082, D-149        |
| `break-glass` con solicitud desde coordinación y aprobación desde gerencia                    | R-010               | D-083, D-150        |
| E2EE fijado antes del contenido, frontera por tema y procesadores de alcance mínimo           | R-007, R-010        | D-089, D-092        |
| Autorización independiente de usuario y agente; bloqueo total durante `break-glass`           | R-011               | D-103–D-108         |
| Retención uniforme sin excepciones por contexto, con hold y exportación gobernados            | R-009, R-017, R-020 | D-098, D-152, D-153 |
| Analítica agregada; observabilidad y auditoría por vías separadas                             | R-012               | D-109, D-161        |
| Estado móvil desconectado y ausencia de historial o acciones offline                          | R-013               | D-087, D-088        |
| Activación modular por aplicación como palanca de exposición                                  | R-001, R-014        | **D-145**           |
| Migración por congelamiento, delta final, validación, solo lectura temporal y archivado       | R-018, R-019, R-020 | D-119–D-121         |
**Sin control confirmado:** R-003 (por D-142 y D-143) y R-021 (por D-147).
## 20. Métricas de éxito

### 20.1 Reglas confirmadas de medición

- Analítica general de uso y operación **agregada**, gobernada por autorización y
  privacidad (**D-161**, D-058).
- En temas privados y E2EE, únicamente agregados y metadata operativa, sin contenido ni
  dimensiones identificables (D-109). **Sin excepción para OBP.**
- Observabilidad operativa básica (D-111).
- Instrumentación de capacidad, recuperación y coste como preparación arquitectónica
  (D-112).
- Analítica identificable y programa formal de SLO, posteriores al MVP (D-110, D-113).
- SLA contractual, centro de soporte permanente y productividad offline, fuera de alcance
  (D-114, D-088).
- **North Star, fórmulas, líneas base, objetivos, ventanas, responsables, umbrales y
  presupuesto se concretan con evidencia durante diseño y gobierno de entrega.** Las
  señales siguientes **no son objetivos confirmados** (DF-011, DF-012).

### 20.2 Catálogo de señales

Todas son **Propuestas**. La clasificación corresponde a la capacidad que se instrumenta.

| ID        | Señal                                   | Definición                                                                                                                                                                                     | Clasificación              | Regla                                  |
| :-------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :------------------------------------- |
| M-001     | Cobertura de adopción contextual        | Usuarios elegibles activos y aplicaciones o contextos con actividad                                                                                                                            | MVP                        | Genérica                               |
| M-002     | Colaboración significativa              | Contextos con más de un actor autorizado y actividad humana o automática útil                                                                                                                  | MVP                        | Genérica                               |
| M-003     | Uso por superficie                      | Actividad en embebido, central, web y móvil; deep links completados                                                                                                                            | MVP                        | Genérica                               |
| M-004     | Permanencia en contexto                 | Colaboración en Chat frente a doble captura o salida a superficies anteriores                                                                                                                  | MVP                        | Genérica; primera observación en OBP   |
| M-005     | Utilidad de capacidades                 | Uso y finalización sin error de mensajes, media, programados, fijados, subconversaciones, menciones y búsqueda                                                                                 | MVP                        | Genérica                               |
| M-006     | Valor del agente                        | Invocaciones, respuestas, utilidad percibida, consultas sin fuente y bloqueos; no mide escritura ni proactividad                                                                               | MVP                        | Específica OBP sobre contrato genérico |
| M-007     | Experiencia inclusiva y estable         | Satisfacción, éxito de tareas, accesibilidad, errores y claridad de degradaciones                                                                                                              | MVP                        | Genérica                               |
| M-008     | Integridad de eventos                   | Eventos post-commit, aceptación, persistencia, orden, duplicados y pérdidas, correlacionados con el estado oficial del productor. **Único mecanismo de detección de incumplimientos de D-141** | MVP                        | Genérica; OBP primera validación       |
| M-009     | Latencia end-to-end                     | Commit del productor → registro → persistencia → realtime → cliente                                                                                                                            | MVP                        | Genérica                               |
| M-010     | Salud de entrega durable                | Reintentos, edad y volumen de pendientes, DLQ, recuperación, idempotencia y ownership                                                                                                          | MVP                        | Genérica                               |
| M-011     | Salud de servicios y dependencias       | Disponibilidad, errores y degradación de API, realtime, persistencia, medios, Hub, servicio de llaves y agente                                                                                 | MVP                        | Genérica                               |
| M-012     | Reconexión y resincronización           | Frecuencia, duración, éxito, divergencias y acciones offline correctamente bloqueadas                                                                                                          | MVP                        | Genérica                               |
| M-013     | Rendimiento de operaciones de usuario   | Carga, envío, búsqueda, deep link y no leídos, con errores y cancelaciones por autorización                                                                                                    | MVP                        | Genérica                               |
| M-014     | Compatibilidad y ownership de contratos | Versiones, responsables, pruebas y convivencias temporales                                                                                                                                     | MVP                        | Genérica                               |
| M-015     | Operabilidad y supply chain             | Backups, restauraciones, vulnerabilidades, deprecaciones, límites, licencias y owners                                                                                                          | MVP                        | Genérica                               |
| M-016     | Seguridad de adjuntos                   | Aceptados, en cuarentena, bloqueados y liberados; latencia y fallos del analizador                                                                                                             | MVP                        | Genérica                               |
| M-017     | Utilidad y privacidad de avisos         | Contadores, avisos y correos, deep links, no leídos, menciones y exposición indebida                                                                                                           | MVP                        | Genérica                               |
| M-018     | Aislamiento y autorización              | Pruebas negativas y eventos reales de acceso cruzado entre aplicación, contexto o tema                                                                                                         | MVP                        | Genérica                               |
| M-019     | Identidad, membresía y administración   | Revocaciones, discrepancias, autorías históricas, uso de solo lectura y contextos huérfanos                                                                                                    | MVP                        | Genérica; Tasks específico OBP         |
| M-020     | Gobierno de `break-glass`               | Solicitudes, separación entre solicitante y aprobador, expiración, revocación, accesos y llaves liberadas dentro o fuera del alcance                                                           | MVP                        | Genérica                               |
| M-021     | Ciclo criptográfico E2EE                | Dispositivos registrados y revocados, cifrado, rotaciones, procesadores y recuperaciones                                                                                                       | MVP                        | Genérica                               |
| M-022     | Degradaciones E2EE comprendidas         | Búsqueda limitada, avisos sin cuerpo, adjuntos y agente bloqueados, comunicados correctamente                                                                                                  | MVP                        | Genérica                               |
| M-023     | Retención, purga, hold y exportación    | Vencimientos, purgas, backups, tombstones, holds y exportaciones correctas                                                                                                                     | MVP                        | Genérica; excepción OBP activa         |
| M-024     | Privacidad de telemetría                | Dimensiones prohibidas, reidentificación, accesos y revisiones de esquema                                                                                                                      | MVP                        | Genérica, sin excepción OBP            |
| M-025     | Gobierno del agente                     | Autorizaciones, fuentes, scopes, membresía técnica, revocación y bloqueos                                                                                                                      | MVP                        | Genérica; agente inicial OBP           |
| M-026     | Capacidad y coste unitario              | Tendencia por almacenamiento, media, colas, búsqueda, telemetría, cifrado y MCP                                                                                                                | Preparación arquitectónica | Genérica                               |
| M-027     | Acumulación en campañas activas         | Edad, volumen, crecimiento, coste y anomalías                                                                                                                                                  | MVP                        | Específica OBP                         |
| M-028     | Cobertura de elegibilidad               | Campañas elegibles, migradas, excluidas, en corte o rechazadas                                                                                                                                 | MVP                        | Específica OBP                         |
| M-029     | Integridad del historial                | Esperados, migrados y fallidos; relaciones, fechas, autoría, checksums y excepciones                                                                                                           | MVP                        | Específica OBP                         |
| M-030     | Control del corte                       | Congelamiento, delta, reintentos, validación, solo lectura e incidentes                                                                                                                        | MVP                        | Específica OBP                         |
| M-031     | Salida efectiva de Teams                | Actividad residual, doble captura, deep links obsoletos e incidentes                                                                                                                           | MVP                        | Específica OBP                         |
| M-032     | Inicio correcto de retención            | Transición a inactiva, comienzo de relojes y anomalías de actividad indefinida                                                                                                                 | MVP                        | Específica OBP                         |
| **M-033** | **Progreso del servicio de llaves**     | Decisión de construcción o contratación, responsable asignado, hitos y disponibilidad para pruebas criptográficas                                                                              | MVP                        | Genérica                               |

### 20.3 Cobertura de riesgos por señales

| Riesgo | Señales                   | Riesgo    | Señales                    |
| :----- | :------------------------ | :-------- | :------------------------- |
| R-001  | M-001–M-003, M-005, M-007 | R-012     | M-024                      |
| R-002  | M-018                     | R-013     | M-007, M-012, M-013        |
| R-003  | M-008–M-010               | R-014     | M-009–M-011, M-015, M-026  |
| R-004  | M-010, M-014, M-015       | R-015     | M-015, M-016               |
| R-005  | M-019                     | R-016     | M-013, M-017               |
| R-006  | M-016                     | R-017     | M-006, M-016, M-026, M-027 |
| R-007  | M-021, **M-033**          | R-018     | M-001–M-004, M-028, M-031  |
| R-008  | M-007, M-022              | R-019     | M-028–M-031                |
| R-009  | M-023, M-032              | R-020     | M-027, M-032               |
| R-010  | M-020                     | **R-021** | **M-033**, M-011           |
| R-011  | M-006, M-025              |           |                            |

### 20.4 Inferencia aceptada

No existe una North Star confirmada. El éxito debe combinar colaboración contextual,
utilidad, confiabilidad, seguridad y gobierno; el volumen de mensajes o de usuarios
activos no basta por sí solo. OBP valida primero el núcleo, pero **no sustituye la
evaluación multiaplicación**.
## 21. Preguntas abiertas y diferidos legítimos

### 21.1 Preguntas abiertas P0

**Ninguna.** Q-001 a Q-029 están cerradas y no existe ninguna capacidad vigente
clasificada como `Pendiente de decisión`.

| Bloque                                                   | Cierre                                                        |
| :------------------------------------------------------- | :------------------------------------------------------------ |
| Q-001 – Q-022                                            | Cerradas por D-081 a D-122, conforme a `21-open-questions.md` |
| Q-023 — alta y ciclo de vida de aplicación consumidora   | **D-133, D-134, D-135**                                       |
| Q-024 — ciclo de vida destructivo del contexto           | **D-136, D-137, D-138**                                       |
| Q-025 — fundamento de E2EE en el MVP                     | **D-131, D-132**                                              |
| Q-026 — obligaciones de datos personales                 | **D-139, D-140**                                              |
| Q-027 — búsqueda en la aplicación central                | **D-157**                                                     |
| Q-028 — origen de equipos y etiquetas de mención         | **D-158**                                                     |
| Q-029 — presencia, escritura y confirmaciones de lectura | **D-159**                                                     |

### 21.2 Diferidos legítimos de diseño y gobierno

**No son preguntas abiertas ni capacidades `Pendiente de decisión`.**

| ID         | Prioridad | Tipo                                | Detalle diferido                                                                                                                                       |
| :--------- | :-------- | :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| DF-001     | P2        | Propuesta                           | Agregados candidatos y nombres concretos de API y persistencia                                                                                         |
| DF-002     | P2        | Propuesta                           | Defaults de subconversaciones, semántica de fijados y condiciones del archivado automático                                                             |
| DF-003     | P2        | Propuesta                           | Límites de mensajes y media, editor, proveedor GIF, motor y listas de antimalware, granularidad de herramientas MCP                                    |
| DF-004     | P2        | Propuesta                           | Variantes embebidas, theming y separación técnica o de despliegue de la consola                                                                        |
| DF-005     | P2        | Propuesta                           | Matriz y frecuencia de notificaciones, correo y confirmaciones reforzadas                                                                              |
| DF-006     | P1        | Propuesta                           | Algoritmos y protocolo E2EE, rotación, dispositivos, formato de respaldo, sesión y detalle del mecanismo de segunda barrera                            |
| DF-007     | P2        | Propuesta                           | Periodicidad, destinatarios y composición del primer panel; stack concreto de observabilidad                                                           |
| DF-008     | P1        | Propuesta                           | Selección y licencia de GIF, antimalware, búsqueda, componentes E2EE, colas y observabilidad                                                           |
| DF-009     | P1        | Propuesta                           | Scopes, herramienta, formato, reintentos, umbrales, ventana, owner de excepciones y no leídos de migración                                             |
| DF-010     | P1        | Propuesta                           | Responsables nominales, fechas y cadencia de revisión de riesgos y dependencias                                                                        |
| DF-011     | P1        | Decisión confirmada de diferimiento | Valores numéricos de capacidad, SLO internos, RPO/RTO, umbrales y presupuesto se concretan con evidencia                                               |
| DF-012     | P1        | Propuesta                           | North Star, líneas base, objetivos, ventanas, owners y composición del primer tablero                                                                  |
| **DF-013** | **P2**    | **Propuesta**                       | **Tipos de `contextType` permitidos por aplicación y detalle de la habilitación modular de capacidades**                                               |
| **DF-014** | **P1**    | **Propuesta**                       | **Baja, suspensión o revocación de una aplicación consumidora, y su interacción con retención, legal hold, contextos activos y credenciales emitidas** |
**DF-014 debe resolverse antes de integrar la segunda aplicación**, no antes de cerrar el
Paso 0.

### 21.3 Supuestos por validar

A-001, A-003, A-004, A-006, A-007, A-008, A-009, A-011 permanecen como **Supuestos** con
la evidencia propuesta en 19.3. A-002 permanece como validación **recomendada, no
obligatoria** (D-142).

A-005, A-010 y A-012 **dejaron de ser supuestos**: A-005 fue refutado y convertido en
DEP-010 y R-021; A-010 y A-012 fueron resueltos por D-154, D-148 y D-151.

Si una validación futura cambia seguridad, dominio, arquitectura, alcance o gobierno,
deberá registrarse como decisión nueva y propagarse **antes** de actualizar este
artefacto.
## 22. Anexo A — Restricciones técnicas propuestas

Conforme a **D-162**, los siguientes elementos **no son decisiones de dominio** y no deben
tratarse como restricciones firmes por una herramienta SDD. Se listan porque son las
opciones exploradas hasta ahora, no porque estén confirmadas.

| Elemento                                                               | Estado                | Nota                                                                                                                             |
| :--------------------------------------------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL como persistencia principal                                 | **Propuesta**         | El invariante exigible es el aislamiento por aplicación, no el motor                                                             |
| RLS como mecanismo de segunda barrera                                  | **Propuesta**         | El invariante exigible es "segunda barrera de autorización a nivel de datos, independiente de la autorización de aplicación"     |
| React / Next.js para el cliente web                                    | **Propuesta**         | El invariante exigible es que web y móvil compartan dominio, contratos, autenticación, realtime, validaciones y tokens de diseño |
| React Native + Expo para el cliente móvil                              | **Propuesta**         | Ídem                                                                                                                             |
| Estructura de monorepo                                                 | **Propuesta**         | Decisión de ingeniería sin contenido de dominio                                                                                  |
| NestJS, Redis, Socket.IO, BullMQ, Drizzle                              | **Propuesta** (P-001) | No confirmadas                                                                                                                   |
| Token corto de Chat intercambiado desde SSO                            | **Propuesta** (P-002) | No confirmada                                                                                                                    |
| Capacidad de medios como evolución compatible del servicio de imágenes | **Propuesta** (P-003) | No confirmada                                                                                                                    |
| OpenTelemetry y stack corporativo de observabilidad                    | **Propuesta** (P-005) | No confirmada                                                                                                                    |
**Advertencia para la herramienta SDD:** ninguna fila de este anexo debe convertirse en
requisito. Las decisiones de dominio correspondientes están en las secciones 9, 11 y 18.
## 23. Trazabilidad de decisiones y condición de salida

### 23.1 Cobertura de decisiones vigentes

| Grupo del registro canónico | Cobertura en este documento                                                                                                                                                                                                                                                                                                                        |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 – D-009               | Nombre, visión, SSO, contexto OBP, equivalencia Teams, cronología, sustitución de Make, eventos post-commit y no bloqueo                                                                                                                                                                                                                           |
| D-010                       | Entrega durable, conservada como **Inferencia aceptada** en 8.5, 16.2 y 19.2                                                                                                                                                                                                                                                                       |
| D-011 – D-032               | `General`, temas OBP, temas manuales, membresía, permisos, contenido, archivado, clientes, Hub, búsqueda y Tasks                                                                                                                                                                                                                                   |
| D-044, D-045, D-047, D-049  | Aplicación central, privacidad, subconversaciones y GIF                                                                                                                                                                                                                                                                                            |
| D-053 – D-070               | Programados, fijados, menciones, límites de tema, cards, administración, retención configurable, archivado, avisos y capacidades preparadas, posteriores o fuera                                                                                                                                                                                   |
| D-073, D-074                | **Vigentes.** Exclusión de chat corporativo y de comunicación síncrona                                                                                                                                                                                                                                                                             |
| D-078 – D-086               | Clientes, publicidad OBP, contrato genérico, privacidad fija, scopes, `break-glass`, solo lectura, huérfanos y adjuntos                                                                                                                                                                                                                            |
| D-087 – D-097               | Móvil en línea, E2EE, aislamiento, búsqueda E2EE y conclusiones fuera de alcance                                                                                                                                                                                                                                                                   |
| D-098 – D-108               | Retención, compliance y política completa del agente                                                                                                                                                                                                                                                                                               |
| D-109 – D-117               | Privacidad analítica, modelo operativo y gobierno de contratos                                                                                                                                                                                                                                                                                     |
| D-118 – D-122               | Bitrix, migración OBP y federación                                                                                                                                                                                                                                                                                                                 |
| D-123 – D-128               | Embebido, mensajería base, adjuntos, realtime, gateway MCP y frontera de sistema oficial                                                                                                                                                                                                                                                           |
| **D-129 – D-164**           | **Decisiones de cierre.** Documento definitivo, trazabilidad, E2EE, alta de aplicación, ciclo de vida del contexto, datos personales, invariante de confiabilidad, alcance, estructura organizacional, `break-glass`, retención, migración, rol miembro, descubrimiento, búsqueda central, etiquetas, presencia, analítica, tecnología y evidencia |

### 23.2 Decisiones históricas no presentadas como vigentes

**No se usan como reglas actuales:** D-033 a D-036, D-038 a D-043, D-046, D-048, D-050 a
D-052, **D-071, D-072 y D-075 a D-077**, porque fueron sustituidas o absorbidas.

> **Corrección respecto del documento anterior (G-2):** `99` declaraba no vigente el rango
> completo "D-071–D-077", lo que incluía erróneamente **D-073 y D-074**, que sí son
> **Vigentes** y sostienen la exclusión del chat corporativo y de la comunicación
> síncrona. El rango correcto es D-071–D-072 y D-075–D-077.

El residuo vigente de **D-037** (transparencia total) se representa mediante D-045, D-079,
D-081 y D-082: `General` y los temas automáticos de OBP son públicos, mientras los temas
manuales pueden ser privados con autorización explícita.

**D-075** (E2EE entra al MVP) fue sustituida por D-089–D-092 y ahora recibe además su
motivación registrada en **D-131**.

**D-078 y D-093** conservan vigente su contenido conceptual; su contenido tecnológico pasó
al anexo A por **D-162**.

**D-118** conserva su contenido; su evidencia fue sustituida por **D-163**.

Las propuestas **P-001 a P-005** no se elevan a decisiones y figuran en el anexo A.

### 23.3 Correcciones aplicadas respecto de `99`

| #    | Corrección                                                                                              | Origen       |
| :--- | :------------------------------------------------------------------------------------------------------ | :----------- |
| G-1  | Se registra la sustitución de `99` por este documento                                                   | D-129, H-001 |
| G-2  | Rango de decisiones históricas corregido a D-071–D-072 y D-075–D-077                                    | H-004        |
| G-3  | Señal temprana de R-010 restaurada según `18`:41                                                        | H-005        |
| G-4  | Identificadores de decisión presentes en todas las matrices                                             | D-130, H-006 |
| G-5  | Sección "Términos que deben evitarse" restituida en 5.2                                                 | H-007        |
| G-6  | Catálogo completo de lenguaje ubicuo restituido en 5.1                                                  | H-008        |
| G-7  | `campaña` sustituido por `contexto` en reglas genéricas; regla de temas automáticos etiquetada como OBP | H-014        |
| G-8  | Filas con dos tipos de afirmación descompuestas en 16.2                                                 | H-023        |
| G-9  | Cierres de preguntas trazados en 21.1                                                                   | H-021        |
| G-10 | Retirada la afirmación no verificable de integridad por hash                                            | H-022        |
| G-11 | Vocabulario cerrado de la columna `Regla` definido en 1.4                                               | H-026        |
| G-12 | D-076 recategorizada como pregunta abierta sustituida                                                   | H-027        |
| G-13 | Mecanismo genérico de temas administrados por aplicación elevado a decisión (D-080) en 5.1 y 18.1       | H-016        |
| —    | Declaración de límite metodológico sobre la fuente de descubrimiento                                    | D-164, H-003 |
| —    | Áreas corporativas reformuladas como funciones y scopes                                                 | D-148, H-011 |

### 23.4 Condición de salida del Paso 0

| Condición                                                  | Estado                                                                                                                                                                                                                                                              |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `00`–`22` auditados y reconciliados                        | ✅ Cumplida                                                                                                                                                                                                                                                          |
| Hallazgos críticos de la auditoría `98` resueltos          | ✅ Cumplida. H-001 cerrado por D-129; H-002 por las columnas de motivación, origen y autoridad incorporadas en `20.1`; H-003 por D-163 y D-164                                                                                                                       |
| Preguntas P0 cerradas                                      | ✅ Q-001 a Q-029 cerradas                                                                                                                                                                                                                                            |
| Capacidades `Pendiente de decisión`                        | ✅ Ninguna                                                                                                                                                                                                                                                           |
| Propagaciones pendientes dentro de `00`–`22`               | ⚠️ **Pendientes**: los archivos temáticos conservan redacción anterior sobre áreas corporativas, excepciones de retención, tecnología y afirmaciones sobre la fuente de descubrimiento. **Este documento es la fuente vigente**; `00`–`22` quedan como antecedentes |
| Trazabilidad de decisiones en el cuerpo del documento      | ✅ Cumplida (D-130)                                                                                                                                                                                                                                                  |
| Fundamento registrado de las decisiones de mayor impacto   | ✅ Cumplida en `20.1`                                                                                                                                                                                                                                                |
| Material listo para consumo por la herramienta SDD externa | ✅ **Sí**, con las advertencias de 23.5                                                                                                                                                                                                                              |

### 23.5 Advertencias finales para el consumidor de este documento

1. **No inventes decisiones.** Toda regla lleva su identificador. Si algo no tiene D-ID, no
   es una regla: es narrativa, inferencia o propuesta.
2. **El anexo A no es requisito.** Ninguna tecnología concreta está confirmada.
3. **Las áreas corporativas no existen.** `Seguridad/Compliance`, `Soporte/TI` y
   `responsable funcional` son scopes del sistema ejercidos por el equipo de producto
   (D-148, D-151). No diseñes flujos de aprobación entre departamentos.
4. **El servicio de llaves KMS/HSM no existe** (D-147). No asumas infraestructura
   criptográfica disponible.
5. **El invariante de confiabilidad no tiene control automático** (D-142, D-143). No
   diseñes verificación en tiempo de ejecución ni suspensión de integraciones.
6. **`Preparación arquitectónica` no obliga a implementar** la capacidad funcional.
7. **La ausencia de decisiones contradictorias fuera del registro canónico no ha podido
   verificarse** (D-164).
**Fin del documento.**