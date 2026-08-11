# Security draft — §6

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
