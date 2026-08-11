# Security + Integration draft — §6 y §7

## 6. Seguridad

### 6.1 Autenticación

| Regla | D-ID |
|---|---|
| La identidad de **personas** proviene exclusivamente de SSO Integral mediante OIDC. Se valida el token con JWKS del proveedor | D-003 |
| **No existen** endpoints de login, registro, contraseña, recuperación ni MFA propios. No se almacenan hashes de credenciales de usuario | D-003 |
| El bootstrap del primer administrador global se realiza vinculando un `sso_subject` conocido; **sin** credenciales estáticas | D-003 |
| Las **aplicaciones consumidoras** usan credencial propia emitida en su alta, con secreto rotable y orígenes autorizados. Es un plano distinto de la identidad de personas | D-134, D-135 |
| El registro de un **dispositivo** para E2EE exige reautenticación reforzada contra el SSO; Workspace Chat no implementa el segundo factor | D-091 |

### 6.2 Autorización

Evaluación en cadena, **todas** las condiciones deben cumplirse:

```text
1. application_id del token  ──►  ¿coincide con el del recurso?        (D-093)
2. membresía contextual      ──►  ¿existe y no está removida?          (D-016)
3. visibilidad del tema      ──►  público: basta 1+2                   (D-045)
                                  privado: exige membresía de tema
4. rol                       ──►  context_admin | member | read_only   (D-084, D-155)
5. scope de plataforma       ──►  sólo para operaciones administrativas (D-082)
6. segunda barrera de datos  ──►  filtro independiente por aplicación   (D-093, D-162)
```

| Regla | D-ID |
|---|---|
| **Ningún scope administrativo concede lectura automática de mensajes** ni membresía implícita en temas privados | D-082 |
| La separación de scopes es **del sistema**, no de la organización: se mantiene aunque una persona ejerza varios | D-149 |
| El `application_id` autorizado proviene del token o la sesión, **nunca** de un valor libre del cliente | D-093 |
| La aplicación central y la consola **no disponen de bypass** de aislamiento | D-044, D-058 |
| Un miembro **nunca** añade participantes; no existe solicitud de acceso | D-156, D-160 |
| Un recurso no autorizado devuelve `404` cuando `403` revelaría su existencia | D-160 |

### 6.3 Acceso excepcional — `break-glass`

| Elemento | Regla | D-ID |
|---|---|---|
| Quién solicita | Scope `support` o `application_admin` — coordinación y desarrollo | D-150 |
| Quién aprueba | Scope `global_admin` — **nivel gerencia**, distinto del solicitante | D-150, D-151 |
| Qué exige | Motivo, alcance limitado, ventana temporal y expiración | D-083 |
| Qué **no** hace | **No descifra E2EE por sí mismo.** Autoriza al servicio corporativo a liberar sólo las llaves del alcance aprobado | D-083, D-091 |
| Prohibición absoluta | El agente MCP **no** puede invocarse, habilitarse ni recibir acceso delegado durante la sesión, incluso supervisada | D-108 |
| Evidencia | Toda la actividad se audita, incluidas las referencias de llave liberadas | D-098 |

### 6.4 Cifrado de extremo a extremo

| Regla | D-ID |
|---|---|
| **Fundamento:** proteger información comercial sensible frente a accesos internos indebidos. **No hay obligación regulatoria ni contractual externa** | D-131 |
| Configurable por aplicación y contexto; se fija **antes** de publicar contenido y **no cambia después** | D-089 |
| Cada tema cifrado mantiene una **frontera criptográfica independiente**, con su propia época de llave | D-089 |
| El backend ordinario permanece **ciego**: sólo persiste `ciphertext` y sobre criptográfico | D-092 |
| Las llaves se respaldan cifradas mediante servicio corporativo protegido por KMS/HSM. **⚠ Ese servicio NO EXISTE (D-147, DEP-010, R-021)** | D-091, D-147 |
| La recuperación exige servicio de llaves **más** `break-glass` aprobado, con evidencia auditable | D-091 |
| Sólo productores y procesadores imprescindibles participan criptográficamente, con identidad propia, alcance mínimo, credenciales rotables, auditoría y revocación | D-092 |
| Las llaves de recuperación **nunca** sirven al procesamiento ordinario | D-092 |
| El antimalware es obligatorio también en E2EE; sin analizador disponible el contexto **no admite adjuntos** | D-092, D-086 |
| Notificaciones sin cuerpo; programados cifrados con cancelación ante rotación | D-092 |
| Búsqueda limitada al cliente sobre contenido ya cargado y descifrado, **sin índice central de texto plano** | D-092 |
| Participación del agente MCP como procesador criptográfico | D-107 — **Posterior al MVP** |

> **El modelo criptográfico es de recuperación corporativa administrada, no de clave
> precompartida fuera de banda.** Un esquema sin custodia haría imposibles la recuperación,
> el legal hold sobre E2EE y el alta de nuevos dispositivos.

### 6.5 Seguridad de contenido

| Regla | D-ID |
|---|---|
| Todo adjunto valida MIME **real** contra el declarado, extensión y tamaño | D-086 |
| Cuarentena obligatoria: mientras no supere el análisis **no se visualiza ni descarga** | D-086 |
| `blocked` y `unscannable` son estados **terminales**; el archivo nunca se libera | D-086 |
| La política corporativa de formatos fija el mínimo; una aplicación puede **restringirla, nunca debilitarla** | D-086 |
| Entrega mediante URLs firmadas y temporales | D-086 |
| Se auditan carga, resultado del análisis, descarga, bloqueo y eliminación | D-086 |
| La misma política aplica al contenido **migrado** antes de ponerlo a disposición | D-120, D-086 |

### 6.6 Auditoría y evidencia

| Regla | D-ID |
|---|---|
| `audit_entries` es **append-only**: sin UPDATE ni DELETE a nivel de aplicación | D-098 |
| Se auditan actor, instante, motivo cuando corresponde, participantes, roles, archivado, privacidad, ediciones, eliminaciones, adjuntos, exportaciones, recuperaciones y acciones de agentes | D-098, D-099 |
| La evidencia de auditoría se conserva **2 años** desde el evento | D-098 |
| La **consulta** de auditoría se audita a su vez | D-099 |
| Observabilidad y auditoría son **vías separadas**: la observabilidad usa identificadores internos y no concede lectura de contenido | D-109 |

### 6.7 Protección de datos personales

| Regla | D-ID |
|---|---|
| Workspace Chat **hereda el marco corporativo vigente** y no define un marco propio | D-139 |
| Los **derechos del titular** (acceso, rectificación, supresión) quedan **fuera del alcance del producto**; se atienden por el canal corporativo y Chat aporta información mediante la exportación gobernada | D-140 |

**Dos particularidades registradas que deben comunicarse al responsable del marco
corporativo:**

1. En contextos E2EE, Workspace Chat **no puede localizar ni suprimir** contenido de una
   persona sin recuperación corporativa y `break-glass` aprobado. Una solicitud de supresión
   **no es ejecutable por la vía ordinaria**.
2. La migración conserva **atribuciones históricas con nombre y fecha** de identidades no
   resolubles, que pueden corresponder a personas ya desvinculadas (D-120).

### 6.8 Transporte y red

- TLS 1.3 obligatorio en todo el tráfico externo.
- Rate limiting en el gateway por identidad y por credencial de aplicación.
- CORS restringido a los `allowed_origins` registrados en el alta de cada aplicación
  (D-134): el BFF embebido acepta **sólo** el origen de la aplicación consumidora.
- El handshake de realtime valida token, `application_id` y membresía **antes** de aceptar
  la conexión, y la revalida ante cada entrega (EC-02).
- Secretos gestionados fuera del código y del repositorio.

---


## 7. Infraestructura

> Todo el contenido de esta sección es **propuesta de implementación** (D-162). Lo
> vinculante son los invariantes de las secciones 3 y 6.

### 7.1 Flujo de autenticación

1. El cliente inicia OAuth 2.0 + PKCE contra el proveedor de identidad corporativo.
2. El proveedor autentica —incluida cualquier política de segundo factor **propia del
   proveedor**— y devuelve el código de autorización.
3. El cliente lo intercambia por tokens.
4. El gateway valida firma y expiración contra JWKS y extrae `sub`.
5. El núcleo resuelve la identidad y el conjunto de aplicaciones autorizadas; el
   `application_id` efectivo se deriva del contexto de la petición, **nunca** del cliente.

### 7.2 Resiliencia

- Probes de liveness y readiness en todos los servicios.
- Circuit breaker frente a SSO, capacidad de medios, antimalware, Hub, servicio de llaves y
  agente MCP (DEP-001 a DEP-011).
- Reintentos con backoff exponencial y DLQ con inspección manual.
- **Degradación explícita y comunicada** (D-092, R-008): sin analizador no hay adjuntos; sin
  servicio de llaves no hay recuperación E2EE; sin Hub, Chat conserva no leídos y los avisos
  se acumulan.
- El cliente móvil muestra **estado desconectado** y al reconectar obtiene del servidor el
  estado autorizado vigente; **jamás** publica acciones creadas sin conexión (D-087, D-088).

### 7.3 Observabilidad

| Elemento | Contenido | D-ID |
|---|---|---|
| Logs centralizados | Identificadores y `correlationId`. **Nunca** cuerpo de mensaje | D-111, D-109 |
| Métricas básicas | Salud, latencia, entrega, errores | D-111 |
| Alertas | Indisponibilidad, eventos fallidos, respaldos, antimalware y **acumulación en cuarentena** | D-111 |
| Correlación end-to-end | Desde el productor hasta Chat, Hub y cliente | D-111 |
| Atención | Equipo responsable **dentro de su operación normal**. Sin guardia 24/7 | D-111, D-113 |
| Instrumentación diferida | Uso, capacidad y recuperación para fijar después SLO, RPO/RTO y umbrales | D-112 |

**No se fijan valores numéricos de SLO, capacidad, RPO/RTO ni presupuesto** (DF-011).

### 7.4 Despliegue

- Contenedores con imagen base mínima y usuario no root.
- Entorno local reproducible con la persistencia, caché, cola y almacén de objetos.
- Despliegue con actualización progresiva y drenado de conexiones realtime.
- Respaldos con **rotación de 35 días**; una restauración **reaplica tombstones,
  expiraciones y holds antes de servir** (D-098).
- Evidencia de auditoría en almacenamiento inmutable, con retención de 2 años (D-098).
- Residencia en la región aprobada por la infraestructura disponible, **sin selección por
  aplicación** (D-099).

### 7.5 Variables de entorno

```text
SSO_ISSUER, SSO_JWKS_URL, SSO_AUDIENCE
DB_URL
CACHE_URL
QUEUE_URL
OBJECT_STORE_ENDPOINT, OBJECT_STORE_BUCKET, OBJECT_STORE_KEY, OBJECT_STORE_SECRET
ANTIMALWARE_ENDPOINT                 # sin él, los adjuntos no se liberan (D-086)
KEY_SERVICE_ENDPOINT                 # ⚠ DEP-010: aún no existe (D-147)
MCP_GATEWAY_ENDPOINT                 # D-127
NOTIFICATION_HUB_ENDPOINT            # D-030
CORS_ALLOWED_ORIGINS                 # se deriva del alta de cada aplicación (D-134)
LOG_LEVEL, OTEL_EXPORTER_ENDPOINT
```

### 7.6 CI/CD

- Lint, formato y tipado estricto en pre-commit y en pipeline.
- Tests con **cobertura obligatoria de los casos negativos** de las reglas RN-xx.
- **Pruebas de aislamiento automáticas** que verifiquen que ninguna consulta cruza
  fronteras de aplicación, contexto o tema privado (D-093, R-002, M-018).
- Despliegue a preproducción y promoción tras validación.
- Verificación post-despliegue de salud y endpoints críticos.

### 7.7 Manifest de infraestructura

```json
{
  "project_id": "workspace-chat",
  "traceability": {
    "source_of_truth": "100-workspace-chat-domain-benchmark-gap-analysis.md",
    "decision_log": ["20-decision-log.md", "20.1-decision-log-cierre.md"]
  },
  "stack_status": "PROPUESTA — no es decisión de dominio (D-162)",
  "stack": {
    "backend": { "framework": "NestJS", "language": "TypeScript" },
    "database": { "engine": "PostgreSQL", "second_barrier": "RLS" },
    "queue": { "engine": "RabbitMQ o BullMQ" },
    "object_store": { "engine": "S3-compatible" },
    "realtime": { "engine": "Socket.IO" }
  },
  "security": {
    "authentication": "SSO corporativo OIDC — sin credenciales de usuario propias (D-003)",
    "application_credentials": "cliente/secreto rotable por aplicación (D-135)",
    "isolation_axis": "application_id (D-093)",
    "multi_tenant_support": false,
    "e2ee": "recuperación corporativa administrada (D-091)",
    "key_service_available": false
  },
  "explicitly_excluded": [
    "multi-tenancy", "channels", "conversations", "canal de mensajería externo",
    "login propio", "MFA propio", "orquestación de LLM", "Strangler Fig",
    "convivencia con Teams", "borrado físico en cascada", "presencia",
    "confirmaciones de lectura", "descubrimiento abierto", "solicitud de acceso"
  ]
}
```

---
