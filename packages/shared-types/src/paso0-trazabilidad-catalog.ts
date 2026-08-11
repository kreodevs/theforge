/**
 * Catálogo determinístico para §8 UI/UX, §9 Trazabilidad y §10 changelog (Workspace Chat / EXPECTED-MDD).
 * No duplica el MDD gold — solo patrones reutilizables por el pipeline Paso 0.
 */

export type Paso0TrazabilidadGroup = {
  decisionIds: readonly string[];
  materialization: string;
};

/** Grupos §9.1 — cobertura D-ID → secciones del MDD (EXPECTED-MDD extracto). */
export const WORKSPACE_CHAT_TRAZABILIDAD_GROUPS: readonly Paso0TrazabilidadGroup[] = [
  { decisionIds: ["D-002", "D-004"], materialization: "§1.1, §3.3 `contexts`" },
  { decisionIds: ["D-003", "D-135"], materialization: "§6.1; ausencia deliberada de endpoints de autenticación" },
  { decisionIds: ["D-006", "D-124", "D-025"], materialization: "§3.4 `messages`; RN-04, RN-08" },
  { decisionIds: ["D-010", "D-141", "D-142", "D-143"], materialization: "§2.4, §3.5 `outbox`, RN-08, RN-09, EC-21" },
  { decisionIds: ["D-011", "D-012", "D-013", "D-014", "D-045", "D-081"], materialization: "§3.3 `topics`; RN-02, RN-03" },
  { decisionIds: ["D-016", "D-017", "D-018", "D-019", "D-020", "D-021", "D-022", "D-023", "D-024"], materialization: "§3.3 `context_memberships`; RN-04, RN-05" },
  { decisionIds: ["D-027", "D-060", "D-136", "D-137", "D-138"], materialization: "§3.3; RN-10, EC-04, EC-05" },
  { decisionIds: ["D-030", "D-061"], materialization: "§3.9 `read_states`, `notification_intents`; RN-19" },
  { decisionIds: ["D-031", "D-157"], materialization: "§4.2 `/search`; RN-20, EC-16" },
  { decisionIds: ["D-047", "D-053", "D-054", "D-055", "D-158"], materialization: "§3.3, §3.4; §4.2" },
  { decisionIds: ["D-057", "D-080", "D-115"], materialization: "§3.4 `card_*`, §3.5 `business_events`, §4.3" },
  { decisionIds: ["D-082", "D-083", "D-084", "D-085", "D-149", "D-150", "D-151"], materialization: "§3.2 `platform_scopes`, §6.2, §6.3; RN-13, EC-11 a EC-13" },
  { decisionIds: ["D-086", "D-125"], materialization: "§3.4 `attachments`, §6.5; RN-06, RN-07" },
  { decisionIds: ["D-087", "D-088"], materialization: "§7.2, §8.1" },
  { decisionIds: ["D-089", "D-090", "D-091", "D-092", "D-131", "D-132", "D-147"], materialization: "§3.6, §6.4; RN-14, RN-17, RN-18, EC-07, EC-22" },
  { decisionIds: ["D-093", "D-095", "D-162"], materialization: "§3 invariantes, §6.2, §7.7" },
  { decisionIds: ["D-098", "D-099", "D-152", "D-153"], materialization: "§3.7, §6.6; RN-15, RN-16" },
  { decisionIds: ["D-103", "D-104", "D-105", "D-106", "D-107", "D-108", "D-127"], materialization: "§3.8, §4.2; RN-11, RN-12, EC-14, EC-15" },
  { decisionIds: ["D-109", "D-110", "D-161"], materialization: "§3.9 `analytics_rollups`; RN-25" },
  { decisionIds: ["D-111", "D-112", "D-113", "D-114"], materialization: "§7.2, §7.3" },
  { decisionIds: ["D-119", "D-120", "D-121", "D-154"], materialization: "§3.9 `migration_jobs`; RN-22, RN-23, RN-24" },
  { decisionIds: ["D-123", "D-028", "D-044"], materialization: "§2.1, §8.1" },
  { decisionIds: ["D-133", "D-134", "D-135", "D-145"], materialization: "§3.1, §4.2, RN-01" },
  { decisionIds: ["D-139", "D-140"], materialization: "§6.7" },
  { decisionIds: ["D-144", "D-146"], materialization: "§1.3; ausencia deliberada de secuencia de entrega" },
  { decisionIds: ["D-148", "D-155", "D-156"], materialization: "§1.6, §3.2; RN-05" },
  { decisionIds: ["D-159", "D-160"], materialization: "§8.2; RN-21, EC-17" },
  { decisionIds: ["D-163", "D-164"], materialization: "§1.4; §9.3" },
];

/** §9.2 — exclusiones verificables (texto canónico). */
export const WORKSPACE_CHAT_TRAZABILIDAD_EXCLUSIONS =
  "Este MDD **no contiene**: `tenant`, `channel`, `conversation` como entidad, ningún canal de " +
  "mensajería externo, endpoints de autenticación propia, configuración de modelos de lenguaje, " +
  "patrón Strangler, `ON DELETE CASCADE` sobre contenido, presencia ni confirmaciones de lectura.";

/** §9.3 — límites declarados (lista numerada). */
export const WORKSPACE_CHAT_TRAZABILIDAD_LIMITS: readonly string[] = [
  "**La fuente de descubrimiento no está versionada** (D-164): no ha podido verificarse que no existan decisiones anteriores contradictorias fuera del registro canónico.",
  "**El servicio de llaves KMS/HSM no existe** (D-147, DEP-010, R-021). Toda la sección 6.4 depende de una capacidad por construir o contratar.",
  "**R-003 no tiene control preventivo** (D-142, D-143): el invariante de confiabilidad se exige por contrato, sin prueba obligatoria ni reacción automática.",
  "**R-001 no tiene mitigación documental** (D-144, D-146): la única palanca es la desactivación de capacidades por aplicación (D-145).",
  "Las tecnologías de §2.3 y §7 son **propuestas** (D-162) y pueden cambiar sin reabrir el alcance.",
];

/** Headings canónicos §6.1–§6.8 (EXPECTED-MDD). */
export const WORKSPACE_CHAT_SECTION6_HEADINGS: readonly { num: string; title: string }[] = [
  { num: "6.1", title: "Autenticación" },
  { num: "6.2", title: "Autorización" },
  { num: "6.3", title: "Acceso excepcional — `break-glass`" },
  { num: "6.4", title: "Cifrado de extremo a extremo" },
  { num: "6.5", title: "Seguridad de contenido" },
  { num: "6.6", title: "Auditoría y evidencia" },
  { num: "6.7", title: "Protección de datos personales" },
  { num: "6.8", title: "Transporte y red" },
];

/** §8.1 Superficies Workspace Chat (EXPECTED-MDD). */
export const WORKSPACE_CHAT_UI_SURFACES: readonly {
  surface: string;
  scope: string;
  rule: string;
  decisionIds: string;
}[] = [
  {
    surface: "Componente embebido",
    scope: "Una sola aplicación consumidora",
    rule: "Muestra **exclusivamente** conversaciones de esa aplicación. Contextual y no invasivo",
    decisionIds: "D-123, D-028",
  },
  {
    surface: "Aplicación central web",
    scope: "N aplicaciones autorizadas",
    rule: "Agrega conversaciones contextuales autorizadas **sin bypass**. Sin DMs, grupos ni canales generales",
    decisionIds: "D-044, D-073",
  },
  {
    surface: "Cliente móvil",
    scope: "Ídem central",
    rule: "**Solo en línea.** Estado desconectado explícito; sin historial local ni cola de acciones",
    decisionIds: "D-087, D-088",
  },
  {
    surface: "Consola de administración",
    scope: "Plataforma",
    rule: "Experiencia separada de la aplicación central de usuario",
    decisionIds: "D-058",
  },
];

/** §8.2 Reglas de composición vinculantes (EXPECTED-MDD extracto). */
export const WORKSPACE_CHAT_UI_COMPOSITION_RULES: readonly { rule: string; decisionIds: string }[] = [
  { rule: "La navegación **nunca** ofrece contextos o temas sin membresía. No hay directorio ni \"solicitar acceso\"", decisionIds: "D-160" },
  { rule: "En el cliente central, la búsqueda exige **seleccionar una aplicación** antes de ejecutarse", decisionIds: "D-157" },
  { rule: "La separación visual entre aplicaciones es estricta: ninguna vista mezcla contextos de distintas aplicaciones en una misma lista de resultados", decisionIds: "D-044, D-093" },
  { rule: "El cambio de privacidad de un tema sólo se ofrece mientras esté vacío; después, la UI ofrece **crear tema sucesor**", decisionIds: "D-081" },
  { rule: "Los temas administrados por aplicación se muestran **sin** acciones de renombrar ni eliminar", decisionIds: "D-012" },
  { rule: "Un adjunto en cuarentena se muestra con estado explícito y **sin** acción de descarga", decisionIds: "D-086" },
  { rule: "En contextos E2EE la UI comunica las degradaciones: búsqueda limitada, avisos sin cuerpo, agente no disponible", decisionIds: "D-092, R-008, M-022" },
  { rule: "La invocación del agente es **explícita**: publicar la pregunta es la confirmación. No hay respuesta privada previa", decisionIds: "D-103" },
  { rule: "**No** se muestran presencia, indicador de escritura ni confirmaciones de lectura", decisionIds: "D-159" },
  { rule: "Estados `loading`, `empty` y `error` obligatorios en toda vista con datos remotos", decisionIds: "—" },
  { rule: "Accesibilidad WCAG AA; objetivo táctil ≥ 44×44 px", decisionIds: "—" },
];

/** §8.3 Fuera de alcance UI (EXPECTED-MDD). */
export const WORKSPACE_CHAT_UI_OUT_OF_SCOPE =
  "CRUD administrativo por entidad sin endpoint en §4; pantallas para entidades técnicas " +
  "(`outbox`, `audit_entries`, `business_events`, `analytics_rollups`); cualquier vista que " +
  "liste contextos ajenos a la membresía del usuario (D-160); indicadores de presencia (D-159).";

/** Cuerpo canónico §6.1–§6.8 (EXPECTED-MDD v2.0 — reglas vinculantes con D-ID). */
export const WORKSPACE_CHAT_SECTION6_CANONICAL_BODY = `### 6.1 Autenticación

| Regla | D-ID |
|---|---|
| La identidad de **personas** proviene exclusivamente de SSO Integral mediante OIDC. Se valida el token con JWKS del proveedor | D-003 |
| **No existen** endpoints de login, registro, contraseña, recuperación ni MFA propios. No se almacenan hashes de credenciales de usuario | D-003 |
| El bootstrap del primer administrador global se realiza vinculando un \`sso_subject\` conocido; **sin** credenciales estáticas | D-003 |
| Las **aplicaciones consumidoras** usan credencial propia emitida en su alta, con secreto rotable y orígenes autorizados. Es un plano distinto de la identidad de personas | D-134, D-135 |
| El registro de un **dispositivo** para E2EE exige reautenticación reforzada contra el SSO; Workspace Chat no implementa el segundo factor | D-091 |

### 6.2 Autorización

Evaluación en cadena, **todas** las condiciones deben cumplirse:

\`\`\`text
1. application_id del token  ──►  ¿coincide con el del recurso?        (D-093)
2. membresía contextual      ──►  ¿existe y no está removida?          (D-016)
3. visibilidad del tema      ──►  público: basta 1+2                   (D-045)
                                  privado: exige membresía de tema
4. rol                       ──►  context_admin | member | read_only   (D-084, D-155)
5. scope de plataforma       ──►  sólo para operaciones administrativas (D-082)
6. segunda barrera de datos  ──►  filtro independiente por aplicación   (D-093, D-162)
\`\`\`

| Regla | D-ID |
|---|---|
| **Ningún scope administrativo concede lectura automática de mensajes** ni membresía implícita en temas privados | D-082 |
| La separación de scopes es **del sistema**, no de la organización: se mantiene aunque una persona ejerza varios | D-149 |
| El \`application_id\` autorizado proviene del token o la sesión, **nunca** de un valor libre del cliente | D-093 |
| La aplicación central y la consola **no disponen de bypass** de aislamiento | D-044, D-058 |
| Un miembro **nunca** añade participantes; no existe solicitud de acceso | D-156, D-160 |
| Un recurso no autorizado devuelve \`404\` cuando \`403\` revelaría su existencia | D-160 |

### 6.3 Acceso excepcional — \`break-glass\`

| Elemento | Regla | D-ID |
|---|---|---|
| Quién solicita | Scope \`support\` o \`application_admin\` — coordinación y desarrollo | D-150 |
| Quién aprueba | Scope \`global_admin\` — **nivel gerencia**, distinto del solicitante | D-150, D-151 |
| Qué exige | Motivo, alcance limitado, ventana temporal y expiración | D-083 |
| Qué **no** hace | **No descifra E2EE por sí mismo.** Autoriza al servicio corporativo a liberar sólo las llaves del alcance aprobado | D-083, D-091 |
| Prohibición absoluta | El agente MCP **no** puede invocarse, habilitarse ni recibir acceso delegado durante la sesión, incluso supervisada | D-108 |
| Evidencia | Toda la actividad se audita, incluidas las referencias de llave liberadas | D-098 |

### 6.4 Cifrado de extremo a extremo

| Regla | D-ID |
|---|---|
| **Fundamento:** proteger información comercial sensible frente a accesos internos indebidos. **No hay obligación regulatoria ni contractual externa** | D-131 |
| Configurable por aplicación y contexto; se fija **antes** de publicar contenido y **no cambia después** | D-089, D-132 |
| Cada tema cifrado mantiene una **frontera criptográfica independiente**, con su propia época de llave | D-089 |
| El backend ordinario permanece **ciego**: sólo persiste \`ciphertext\` y sobre criptográfico | D-092 |
| Las llaves se respaldan cifradas mediante servicio corporativo protegido por KMS/HSM. **⚠ Ese servicio NO EXISTE (D-147, DEP-010, R-021)** | D-091, D-147 |
| La recuperación exige servicio de llaves **más** \`break-glass\` aprobado, con evidencia auditable | D-091 |
| Sólo productores y procesadores imprescindibles participan criptográficamente, con identidad propia, alcance mínimo, credenciales rotables, auditoría y revocación | D-092 |
| Las llaves de recuperación **nunca** sirven al procesamiento ordinario | D-092 |
| El antimalware es obligatorio también en E2EE; sin analizador disponible el contexto **no admite adjuntos** | D-092, D-086 |
| Notificaciones sin cuerpo; programados cifrados con cancelación ante rotación | D-092 |
| Búsqueda limitada al cliente sobre contenido ya cargado y descifrado, **sin índice central de texto plano** | D-092 |
| Participación del agente MCP como procesador criptográfico | D-107 — **Posterior al MVP** |

> El modelo criptográfico es de recuperación corporativa administrada, no de clave
> precompartida fuera de banda.

### 6.5 Seguridad de contenido

| Regla | D-ID |
|---|---|
| Todo adjunto valida MIME **real** contra el declarado, extensión y tamaño | D-086 |
| Cuarentena obligatoria: mientras no supere el análisis **no se visualiza ni descarga** | D-086 |
| \`blocked\` y \`unscannable\` son estados **terminales**; el archivo nunca se libera | D-086 |
| La política corporativa de formatos fija el mínimo; una aplicación puede **restringirla, nunca debilitarla** | D-086 |
| Entrega mediante URLs firmadas y temporales | D-086 |
| Se auditan carga, resultado del análisis, descarga, bloqueo y eliminación | D-086 |
| La misma política aplica al contenido **migrado** antes de ponerlo a disposición | D-120, D-086 |

### 6.6 Auditoría y evidencia

| Regla | D-ID |
|---|---|
| \`audit_entries\` es **append-only**: sin UPDATE ni DELETE a nivel de aplicación | D-098 |
| Se auditan actor, instante, motivo cuando corresponde, participantes, roles, archivado, privacidad, ediciones, eliminaciones, adjuntos, exportaciones, recuperaciones y acciones de agentes | D-098, D-099 |
| La evidencia de auditoría se conserva **2 años** desde el evento | D-098 |
| La **consulta** de auditoría se audita a su vez | D-099 |
| Observabilidad y auditoría son **vías separadas**: la observabilidad usa identificadores internos y no concede lectura de contenido | D-109 |

### 6.7 Protección de datos personales

| Regla | D-ID |
|---|---|
| Workspace Chat **hereda el marco corporativo vigente** y no define un marco propio | D-139 |
| Los **derechos del titular** (acceso, rectificación, supresión) quedan **fuera del alcance del producto**; se atienden por el canal corporativo y Chat aporta información mediante la exportación gobernada | D-140 |

**Dos particularidades registradas:**

1. En contextos E2EE, Workspace Chat **no puede localizar ni suprimir** contenido de una persona sin recuperación corporativa y \`break-glass\` aprobado.
2. La migración conserva **atribuciones históricas con nombre y fecha** de identidades no resolubles (D-120).

### 6.8 Transporte y red

- TLS 1.3 obligatorio en todo el tráfico externo.
- Rate limiting en el gateway por identidad y por credencial de aplicación.
- CORS restringido a los \`allowed_origins\` registrados en el alta de cada aplicación (D-134).
- El handshake de realtime valida token, \`application_id\` y membresía **antes** de aceptar la conexión (D-126).
- Secretos gestionados fuera del código y del repositorio.`;

/** Texto canónico de política de retención D-098 para glosario §1. */
export const WORKSPACE_CHAT_RETENTION_GLOSSARY_TEXT =
  "Conjunto de periodos para visibilidad (3 meses), operación (6 meses), auditoría (2 años), " +
  "archivos (6 meses), backups (rotación 35 días) y legal hold (hasta liberación + 30 días). " +
  "En campañas OBP activas los relojes visible y operativo comienzan al dejar de estar activa (D-120).";

/** Changelog mínimo §10 cuando el MDD no lo trae (EXPECTED-MDD 2.0). */
export const WORKSPACE_CHAT_CHANGELOG_ROWS: readonly { version: string; date: string; change: string }[] = [
  {
    version: "2.0",
    date: "2026-08-04",
    change:
      "Regeneración alineada al catálogo Paso 0 D-ID: adjuntos con cuarentena, reacciones, menciones, " +
      "fijados, no leídos, dispositivos, retención, legal hold, búsqueda, alta de aplicación, migración por corte " +
      "de campaña (sin Strangler Fig). Trazabilidad D-ID en reglas y §9 auto-generada.",
  },
];
