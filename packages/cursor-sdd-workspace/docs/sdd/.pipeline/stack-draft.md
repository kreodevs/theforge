# Stack draft — §2

## 2. Arquitectura y Stack

### 2.1 Visión general

> **Advertencia de lectura (D-162).** Las tecnologías concretas de esta sección son
> **propuestas**, no decisiones de dominio. Lo vinculante son los invariantes:
> aislamiento por aplicación con defensa en profundidad, y clientes que comparten dominio,
> contratos, autenticación, realtime, validaciones y tokens de diseño. Cambiar una
> tecnología **no** reabre el alcance.

Monolito modular con arquitectura hexagonal, tres BFF por superficie y un núcleo de dominio
único. El aislamiento es **por aplicación consumidora** (D-093), aplicado en tres capas:
autorización server-side, barrera a nivel de datos, y controles equivalentes en archivos,
caché, búsqueda, colas y realtime.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   API Gateway (authn, rate limit)                     │
└──────┬────────────────────┬────────────────────┬─────────────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│ BFF Embebido │   │  BFF Central Web │   │  BFF Móvil   │
│ 1 aplicación │   │ N aplicaciones   │   │ solo en línea│
│   (D-028)    │   │ autorizadas D-044│   │   (D-087)    │
└──────┬───────┘   └────────┬─────────┘   └──────┬───────┘
       └────────────────────┼────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  NÚCLEO DE DOMINIO (hexagonal)                        │
│                                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │ Contexto  │ │ Mensajería│ │  Acceso   │ │ Ingesta   │            │
│  │  y temas  │ │ y media   │ │ y gobierno│ │de eventos │            │
│  │ D-011/136 │ │ D-124/086 │ │ D-082/150 │ │ D-080/141 │            │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │ Retención │ │  Cifrado  │ │  Agente   │ │ Migración │            │
│  │ y evidencia│ │  E2EE     │ │   MCP     │ │    OBP    │            │
│  │ D-098/153 │ │ D-089/092 │ │ D-103/106 │ │ D-119/121 │            │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────────┐
│Persistencia│ │   Caché    │ │   Cola     │ │  Almacén de objetos  │
│  + barrera │ │ + pub/sub  │ │ + DLQ      │ │  + URLs firmadas     │
│  de datos  │ │            │ │            │ │                      │
└────────────┘ └────────────┘ └────────────┘ └──────────────────────┘
       │                                              │
       ▼                                              ▼
┌────────────────────┐                    ┌──────────────────────────┐
│ Servicio de llaves │  ⚠ NO EXISTE       │  Analizador antimalware  │
│   KMS/HSM (D-147)  │  DEP-010 · R-021   │  procesador confiable    │
└────────────────────┘                    │        (D-092)           │
                                          └──────────────────────────┘
```

**Adaptadores de entrada por aplicación productora.** Cada aplicación tiene su propio
adaptador que traduce su semántica al contrato canónico. `campaña`, `medio` y los nombres
de tipos de medio viven **exclusivamente** en el adaptador de OBP y nunca alcanzan el núcleo
(D-005, D-115).

### 2.2 Módulos del núcleo

| Módulo | Responsabilidad | D-ID principales |
|---|---|---|
| `applications` | Alta, credenciales, políticas por defecto, flags de capacidad | D-133, D-134, D-135, D-145 |
| `contexts` | Contextos, temas, membresías, privacidad, archivado, ciclo de vida | D-011, D-045, D-081, D-136, D-137 |
| `messaging` | Mensajes, subconversaciones, reacciones, menciones, fijados, programados | D-124, D-047, D-053, D-054, D-055 |
| `media` | Adjuntos, cuarentena, antimalware, entrega firmada | D-086, D-125 |
| `ingestion` | Recepción de eventos, idempotencia, intents, adaptadores | D-080, D-115, D-141 |
| `realtime` | Distribución, reconexión, resincronización, contadores | D-126, D-030 |
| `notifications` | Intención de notificación y frontera con el Hub corporativo | D-030, D-061 |
| `search` | Índice por aplicación; delegación al cliente en E2EE | D-031, D-157, D-092 |
| `access` | Identidad, membresías, roles, scopes, `break-glass` | D-003, D-082, D-150 |
| `crypto` | Política E2EE, dispositivos, procesadores confiables, custodia de llaves | D-089, D-091, D-092, D-147 |
| `retention` | Cinco capas, purga, tombstones, legal hold, exportación | D-098, D-153 |
| `agent` | Registro, habilitación, membresía técnica e invocación MCP | D-103, D-106, D-127 |
| `audit` | Entrada de auditoría inmutable | D-098, D-099 |
| `analytics` | Métricas agregadas sin contenido | D-109, D-161 |
| `migration` | Trabajos e ítems de migración OBP | D-119, D-120, D-121 |

### 2.3 Stack propuesto — no es decisión de dominio

| Capa | Propuesta | Invariante vinculante |
|---|---|---|
| Runtime | Node.js 20 LTS + TypeScript estricto | — |
| Framework backend | NestJS 10 | Modularidad y puertos/adaptadores |
| Persistencia | PostgreSQL 16 | **Aislamiento por aplicación con segunda barrera a nivel de datos** (D-093, D-162) |
| Segunda barrera | RLS de PostgreSQL | Barrera independiente de la autorización de aplicación |
| Caché y pub/sub | Redis 7 | — |
| Cola y reintentos | RabbitMQ o BullMQ | Entrega durable, reintentos, DLQ, idempotencia (D-010) |
| Objetos | S3-compatible (MinIO) | Binarios fuera de la base; URLs firmadas y temporales (D-086) |
| Realtime | Socket.IO | Persistir antes de emitir; reconexión y resincronización (D-126) |
| Cliente web | React / Next.js | Dominio, contratos, auth, realtime, validaciones y tokens compartidos (D-078) |
| Cliente móvil | React Native + Expo | Ídem, **solo en línea** (D-087) |
| Cliente embebido | Paquete React + SDK agnóstico | Aislamiento a una aplicación (D-028) |
| Validación | Zod | Contratos versionados |
| Observabilidad | OpenTelemetry | Salud, logs, métricas, correlación, alertas (D-111) |
| **Servicio de llaves** | **Por construir o contratar** | **No existe (D-147, DEP-010, R-021)** |
| Antimalware | Motor tras la capacidad de medios | Análisis obligatorio; sin él no hay adjuntos (D-086, D-092) |

### 2.4 Mensajería asíncrona

| Cola / exchange | Productor | Consumidor | Propósito | D-ID |
|---|---|---|---|---|
| `inbound.business-events` | Adaptadores de aplicación | `ingestion` | Eventos post-persistencia, idempotentes | D-080, D-141 |
| `outbox.dispatch` | Núcleo | `realtime`, `notifications` | Publicación confiable tras commit local | D-010 |
| `media.scan` | `media` | Analizador antimalware | Cuarentena obligatoria | D-086 |
| `agent.invocations` | `messaging` | `agent` | Invocación MCP explícita de solo lectura | D-103 |
| `retention.jobs` | Planificador | `retention` | Purga verificable y reaplicación de tombstones | D-098 |
| `migration.items` | `migration` | `migration` | Ítems de migración con reintento idempotente | D-119–D-121 |
| `audit.stream` | Todos | `audit` | Entradas inmutables | D-098 |

**Garantías:** confirmación de publicación, `manual ack`, DLQ con inspección manual, backoff
exponencial. El orden se exige **sólo dentro de la partición que lo necesita** (`03`
§Reglas e invariantes), nunca globalmente.

### 2.5 Frontera con sistemas externos

| Dependencia | Naturaleza | Estado | D-ID |
|---|---|---|---|
| SSO Integral | Identidad de personas | Decisión confirmada | D-003, DEP-001 |
| Aplicaciones productoras | Emiten actividad post-persistencia | Decisión confirmada | D-141, DEP-002 |
| Backend OBP | Primer productor; informa actividad de campaña | Decisión confirmada | DEP-003 |
| Tasks | **Sólo** membresía inicial de campaña. **Ya no resuelve menciones** | Decisión confirmada | D-032, D-158, DEP-004 |
| Hub de Notificaciones | Entrega avisos; Chat conserva no leídos | Decisión confirmada | D-030, DEP-005 |
| Capacidad de medios y antimalware | Almacena y analiza binarios | Decisión confirmada | D-086, DEP-006 |
| **Servicio de llaves KMS/HSM** | **No existe. Debe construirse o contratarse** | **DEP-010, R-021** | D-147 |
| Agente de campañas (MCP) | Solo lectura, identidad y scopes propios | Decisión confirmada | D-103, DEP-011 |
| Teams / Graph | **Temporal**, sólo migración | Supuesto | DEP-012, A-011 |

---
