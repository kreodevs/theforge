# Section 5 draft — §5

## 5. Lógica y Edge Cases

### 5.1 Reglas de negocio

Formato Dado / Cuando / Entonces. Cada regla es verificable y trazable.

**RN-01 — Alta de aplicación consumidora** (D-133, D-134, D-135)
Dado un usuario con scope `global_admin`, cuando registra una aplicación aportando
responsable funcional, política de administradores predeterminados, política de retención,
política E2EE por defecto y orígenes autorizados, entonces el sistema crea la aplicación,
emite una credencial rotable, registra entrada de auditoría y deja la política E2EE
disponible para fijarse en cada contexto **antes** de que exista contenido.

**RN-02 — Creación de contexto y tema `General`** (D-011, D-080, D-136)
Dado un evento con `intent=ensure_context` y credencial de aplicación vigente, cuando el
contexto no existe para `sourceApplication + contextType + externalId`, entonces se crea el
contexto, se crea su tema `General` con `origin='default'` y `visibility='public'`, se
aplica la fotografía inicial de membresía y se fija `encryption_policy` heredada de la
aplicación. Si ya existe, la operación es **idempotente** y no modifica nada.

**RN-03 — Privacidad de tema manual** (D-081)
Dado un tema manual sin mensajes, cuando un administrador contextual cambia su visibilidad,
entonces el cambio se aplica y se audita. Cuando se publica el **primer** mensaje, el
sistema fija `privacy_locked_at`; cualquier cambio posterior se rechaza con `409` y la
respuesta ofrece crear un **tema sucesor** sin copiar historial ni miembros.

**RN-04 — Publicación de mensaje** (D-124, D-155, D-045)
Dado un usuario con rol `member` en el contexto —y con membresía explícita si el tema es
privado—, cuando publica un mensaje, entonces se persiste, se escribe una fila en `outbox`
en el **mismo commit**, se actualizan los contadores de no leídos de los demás miembros y se
emite por realtime. Un `read_only` recibe `403`.

**RN-05 — Un miembro nunca añade participantes** (D-156, D-018)
Dado un usuario con rol `member` o `read_only`, cuando intenta añadir a alguien a un
contexto o a un tema, entonces se rechaza con `403`. No existe flujo de solicitud de
incorporación.

**RN-06 — Adjunto en cuarentena** (D-086)
Dado un miembro que sube un archivo, cuando se registra el adjunto, entonces se valida MIME
real contra el declarado, extensión y tamaño; se encola el análisis antimalware y el estado
queda `pending`. Mientras el estado no sea `clean`, cualquier intento de visualización o
descarga devuelve `403`. Si el resultado es `blocked` o `unscannable`, el estado es
**terminal** y el archivo nunca se libera.

**RN-07 — Adjunto en contexto E2EE sin analizador** (D-092, D-086)
Dado un contexto con `encryption_policy='e2ee'`, cuando no existe un `trusted_processor` de
tipo `antimalware` activo para ese contexto, entonces el sistema **rechaza la carga de
adjuntos** con `409`. El análisis antimalware no se omite en ningún caso.

**RN-08 — Emisión de evento de negocio** (D-141, D-080, D-025)
Dado un productor con credencial vigente, cuando entrega un evento cuyo `occurredAt` es
posterior al commit de su cambio de negocio, entonces Workspace Chat lo acepta, lo
deduplica por `sourceApplication + eventId` y publica la actividad como mensaje inmutable
en el tema indicado. Un intento de editar o eliminar ese mensaje desde Chat devuelve `409`.

**RN-09 — Indisponibilidad de Workspace Chat** (D-141, D-009)
Dado que Workspace Chat está caído, cuando el productor intenta entregar un evento,
entonces la entrega falla **sin** afectar la operación de negocio del productor, que
reintenta desde su propio outbox. Workspace Chat no ofrece ningún mecanismo que bloquee o
revierta al productor.

**RN-10 — Archivado por eliminación en origen** (D-136)
Dado un evento con `intent=archive_context` y motivo `source_object_deleted`, cuando el
objeto de negocio se elimina en la aplicación productora, entonces el contexto pasa a
`archived` en solo lectura conservando historial, autoría, auditoría y retención. **No se
elimina ninguna fila.** Si la aplicación es OBP, se fija `retention_clock_start` y arrancan
los relojes de 3 y 6 meses sobre todo el historial (D-120).

**RN-11 — Invocación del agente en tema privado** (D-106, D-107)
Dado un miembro de un tema manual privado **no** E2EE, cuando invoca al agente, entonces el
sistema valida de forma **independiente** que (a) el usuario tenga autorización vigente
sobre el tema y (b) el agente esté habilitado para la aplicación o contexto **y** tenga
membresía técnica explícita en el tema. Si falta cualquiera de las dos, devuelve `403`.
Ninguna autorización amplía la otra. Si el tema pertenece a un contexto E2EE, se rechaza
con `409`: la participación del agente en E2EE es posterior al MVP.

**RN-12 — Agente durante `break-glass`** (D-108)
Dado una sesión `break-glass` activa, cuando cualquier actor intenta invocar, habilitar o
delegar acceso al agente, entonces se rechaza con `403` y se registra el intento como
evidencia de seguridad. Aplica incluso bajo supervisión.

**RN-13 — Solicitud y aprobación de `break-glass`** (D-083, D-150, D-151)
Dado un usuario con scope `support` o `application_admin`, cuando solicita acceso
excepcional indicando motivo y alcance limitado, entonces se crea una solicitud `pending`.
Sólo un usuario con scope `global_admin` —nivel gerencia— y **distinto del solicitante**
puede aprobarla. La aprobación abre una ventana temporal con expiración; toda la actividad
se audita y el acceso se revoca automáticamente al expirar.

**RN-14 — `break-glass` sobre contenido E2EE** (D-083, D-091, D-147)
Dado una solicitud `break-glass` aprobada cuyo alcance incluye un contexto E2EE, cuando se
ejerce el acceso, entonces el sistema **no descifra por sí mismo**: solicita al servicio
corporativo de recuperación la liberación de las llaves del alcance aprobado, registra qué
referencias se liberaron y las deja auditadas. ⚠ **Este flujo depende de DEP-010, que no
existe todavía (D-147).**

**RN-15 — Purga por retención** (D-098, D-152, D-153)
Dado el planificador de retención, cuando el contenido alcanza el plazo visible deja de
mostrarse; al alcanzar el plazo operativo se purgan mensajes, revisiones y archivos y se
escribe un `purge_tombstone`. **Un legal hold vigente suspende la purga** en su alcance. No
existen excepciones por contexto: toda aplicación aplica la política corporativa dentro de
sus límites.

**RN-16 — Restauración desde backup** (D-098)
Dado una restauración de respaldo, cuando el sistema vuelve a servir información, entonces
reaplica **primero** tombstones, expiraciones y holds. Un backup **no puede resucitar**
contenido vencido.

**RN-17 — Rotación de llaves y mensajes programados** (D-092, D-053)
Dado un mensaje programado en un contexto E2EE, cuando se produce una rotación de época de
llave antes de su publicación, entonces el mensaje se **cancela o exige reprogramación**;
nunca se publica cifrado con una época inválida. Al publicarse, el sistema **revalida** que
el autor conserve autorización; si la perdió, no se publica.

**RN-18 — Revocación de dispositivo** (D-091)
Dado un dispositivo registrado, cuando se revoca, entonces se cortan sus sesiones, se
impide entregarle llaves nuevas y se rota la época de llave de los temas cifrados a los que
tenía acceso. El contenido ya descifrado o exportado desde ese extremo **no** puede
retirarse.

**RN-19 — Notificación en contexto E2EE** (D-092, D-061)
Dado un mensaje en un contexto E2EE, cuando se genera la intención de notificación,
entonces incluye aplicación, contexto, tema y autor, y `includes_body` es **obligatoriamente
false**. El Hub entrega el aviso; Workspace Chat conserva el estado de no leídos.

**RN-20 — Búsqueda** (D-031, D-157, D-092)
Dado un usuario en el cliente central, cuando busca, entonces debe haber seleccionado **una**
aplicación y los resultados se limitan a ella y a su audiencia autorizada. **Nunca** se
agregan resultados de varias aplicaciones. En contextos E2EE la búsqueda se ejecuta en el
cliente sobre contenido ya cargado y descifrado, sin índice central de texto plano.

**RN-21 — Ausencia de descubrimiento** (D-160)
Dado un usuario autenticado, cuando consulta contextos, temas o resultados de búsqueda,
entonces sólo percibe aquello donde tiene membresía. Ninguna respuesta, contador o mensaje
de error revela la existencia de contextos o temas a los que no pertenece: un recurso no
autorizado devuelve `404`, **no** `403`.

**RN-22 — Exclusión de campaña en migración** (D-119, D-154)
Dado un trabajo de migración, cuando la **gerencia** marca una campaña como excluida
expresamente, entonces queda fuera del alcance y se registra motivo y responsable. Sin
exclusión expresa, toda campaña que al corte no esté cerrada ni cancelada y todavía requiera
colaboración operativa **se migra**.

**RN-23 — Corte de campaña** (D-121)
Dado un trabajo en fase `validation`, cuando la validación no satisface los criterios,
entonces **no** se abre Workspace Chat y **no** se habilitan dos superficies de escritura:
el trabajo vuelve a un punto de control. Superada la validación, se abre Workspace Chat
como única superficie y Teams queda temporalmente en solo lectura antes de archivarse.

**RN-24 — Identidad histórica no resoluble** (D-120)
Dado contenido migrado cuya autoría no puede resolverse contra SSO, cuando se importa,
entonces se conserva nombre, fecha y origen como **atribución histórica**
(`is_historical=true`), sin crear sesión, membresía ni permisos. Una atribución histórica
nunca activa una cuenta.

**RN-25 — Analítica sobre temas privados o E2EE** (D-109, D-161)
Dado el motor de analítica, cuando agrega métricas de temas privados o cifrados, entonces
sólo produce agregados y metadata operativa. Está prohibido almacenar nombres de tema,
integrantes, cuerpos, archivos, búsquedas, prompts o respuestas. **No existe excepción para
OBP.**

### 5.2 Edge cases

| # | Caso | Tratamiento | D-ID |
|:--:|---|---|---|
| EC-01 | Doble envío del mismo mensaje | `Idempotency-Key` devuelve el mensaje ya creado, sin duplicar | `03` |
| EC-02 | Usuario retirado con WebSocket abierto | Se revalida membresía antes de cada entrega; se cierra la conexión y se emite error de autorización | D-018 |
| EC-03 | Evento duplicado por reintento del productor | `sourceApplication + eventId` devuelve `duplicate` sin repetir efectos | D-080 |
| EC-04 | Evento con `externalId` distinto para el mismo objeto | Se crea un **contexto nuevo**; no se migra ni fusiona el anterior | D-137, D-138 |
| EC-05 | `ensure_topic` sobre un tema archivado | `ensure` es no destructivo: no reactiva, no cambia reglas; devuelve `accepted` sin efecto | D-080 |
| EC-06 | Renombrar un tema automático de OBP | `409`: `is_renamable=false` | D-012 |
| EC-07 | Cambiar `encryption_policy` con contenido existente | `409`: la política se fija antes del primer contenido y es inmutable | D-089 |
| EC-08 | Analizador antimalware caído en contexto no E2EE | Los adjuntos permanecen `pending` y no se sirven; se alerta por acumulación en cuarentena | D-086, D-111 |
| EC-09 | Analizador caído en contexto E2EE | El contexto **rechaza** nuevas cargas de adjunto | D-092 |
| EC-10 | Purga con legal hold parcialmente solapado | El hold prevalece sobre su alcance exacto; el resto se purga normalmente | D-098 |
| EC-11 | Último administrador contextual se desactiva en SSO | El contexto se marca **huérfano**; un `application_admin` lo reasigna **sin leer mensajes** | D-085 |
| EC-12 | Solicitante intenta aprobar su propio `break-glass` | `409`: `approved_by <> requested_by` y exige nivel gerencia | D-150 |
| EC-13 | Aprobador de `break-glass` sin scope `global_admin` | `403`: sólo gerencia aprueba | D-150, D-151 |
| EC-14 | Invocación de agente en tema privado sin membresía técnica | `403`, aunque el usuario sí esté autorizado | D-106 |
| EC-15 | Invocación de agente en contexto E2EE | `409`: posterior al MVP | D-107 |
| EC-16 | Búsqueda sin aplicación seleccionada en el cliente central | `400`: la selección de aplicación es obligatoria | D-157 |
| EC-17 | Consulta de un contexto sin membresía | `404`, nunca `403`, para no revelar existencia | D-160 |
| EC-18 | Mensaje programado cuyo autor pierde acceso antes de publicar | No se publica; queda `cancelled` con motivo auditado | D-053 |
| EC-19 | Restauración de backup que contiene contenido purgado | Se reaplican tombstones antes de servir | D-098 |
| EC-20 | Campaña OBP que nunca pasa a inactiva | El reloj de retención no arranca; se emite señal de anomalía (M-027, R-020) | D-120 |
| EC-21 | Productor emite antes de persistir | **No es detectable en recepción.** Se detecta a posteriori por discrepancia en M-008 y **no** dispara acción automática | D-142, D-143 |
| EC-22 | Servicio de llaves no disponible al ejercer `break-glass` E2EE | La solicitud queda aprobada pero **no ejecutable**; se registra la indisponibilidad | D-147, R-021 |

### 5.3 Notas operativas

- Toda regla RN-xx debe tener test de integración con caso positivo y **caso negativo**.
- Los rechazos por autorización se emiten como `404` cuando revelar la existencia del
  recurso violaría D-160, y como `403` en el resto.
- Los logs **nunca** incluyen cuerpo de mensaje, ni en claro ni cifrado. Sólo
  identificadores y `correlationId` (D-109).
- El planificador de retención es idempotente y reejecutable: una purga parcial se retoma
  sin duplicar tombstones.

---
