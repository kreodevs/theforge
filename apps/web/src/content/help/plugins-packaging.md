# Plugins comerciales — empaquetado e instalación

The Forge permite **extender el Workshop** con funcionalidades comerciales (por ejemplo **EVD — Executive Visual Deck**) sin modificar el código del core. Cada plugin es un paquete independiente que el servidor carga en runtime.

> **En una frase:** el autor del plugin genera un archivo **`.tfplugin`** (ZIP + manifest); un administrador lo instala desde **Ajustes → Plugins** — sin consola ni `git clone` en producción.

---

## ¿Para quién es esta guía?

| Rol | Qué te interesa |
|-----|-----------------|
| **Administrador de The Forge** | Instalar EVD u otros plugins desde la UI o con licencia |
| **Desarrollador de plugin** (p. ej. equipo EVD) | Empaquetar el plugin según las reglas del manifest |
| **DevOps / Dokploy** | Volumen persistente y reinicio del worker tras instalar |

---

## Conceptos básicos

```text
  Autor del plugin                The Forge (servidor)
  ─────────────────              ──────────────────────
  Código + build  ──►  .tfplugin  ──►  plugins-enabled/
       │                    │              │
       │                    │              ▼
       │                    │         PluginLoaderService
       │                    │              │
       └─ manifest.json ◄───┘              ▼
                                    Workshop + Ajustes
```

| Pieza | Qué es |
|-------|--------|
| **Core** | The Forge sin lógica comercial (open source / base) |
| **Plugin** | Clase que implementa `ITheForgePlugin` (hooks + artifacts) |
| **`.tfplugin`** | ZIP con manifest + `index.js` compilado |
| **`plugins-enabled/`** | Carpeta en el servidor donde viven los plugins instalados |

---

## Formato del paquete `.tfplugin`

Al descomprimir, la **raíz del ZIP** es la carpeta del plugin:

```text
com.kreodevs.evd@2.1.0.tfplugin
├── theforge-plugin.manifest.json   ← obligatorio
├── index.js                        ← entry (export default class)
├── dist/                           ← opcional
└── assets/                         ← opcional (templates, fuentes…)
```

### Manifest obligatorio

Archivo `theforge-plugin.manifest.json` en la raíz:

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `manifestVersion` | Sí | `"1"` |
| `id` | Sí | reverse-DNS, ej. `com.kreodevs.evd` |
| `version` | Sí | semver, ej. `2.1.0` |
| `name` | Sí | Nombre legible |
| `entry` | No | Default `index.js` |
| `minCoreVersion` | No | Versión mínima del core |
| `payloadSha256` | Recomendado | Integridad del contenido (sin manifest) |
| `signature` | Opcional | HMAC si el servidor exige firma |

El `id` del manifest **debe coincidir** con el `id` de la clase del plugin.

---

## Tutorial: empaquetar un plugin (autor)

### Paso 1 — Estructura mínima del proyecto

```text
mi-plugin/
├── package.json
├── src/
│   ├── index.ts          → export default class
│   └── mi-plugin.ts      → implements ITheForgePlugin
└── dist/                 → salida de build (producción)
    └── index.js
```

**Reglas de build:**

1. Solo **JavaScript compilado** en el ZIP de producción (no `.ts`).
2. **`index.js` en la raíz** del paquete con `export default class`.
3. **Contrato autocontenido** — copia las interfaces del core; no importes el monorepo The Forge.
4. **Peer deps** (`@nestjs/common`, etc.) **no** van en el ZIP; ya están en la imagen del servidor.
5. Dependencias propias: bundlear con esbuild o incluir solo lo necesario.

### Paso 2 — Compilar

```bash
cd mi-plugin
pnpm install
pnpm run build    # tsc o esbuild → dist/
```

### Paso 3 — Generar el `.tfplugin`

Desde el monorepo The Forge (o copiando el script):

```bash
pnpm exec tsx scripts/pack-theforge-plugin.ts \
  --dir /ruta/a/mi-plugin \
  --out dist/com.empresa.mi-plugin@1.0.0.tfplugin \
  --id com.empresa.mi-plugin
```

Opcional, con firma HMAC:

```bash
PLUGINS_SIGNING_SECRET=tu-secreto \
  pnpm exec tsx scripts/pack-theforge-plugin.ts \
  --dir . --out dist/mi-plugin.tfplugin --id com.empresa.mi-plugin --sign
```

El script calcula `payloadSha256` y escribe el manifest automáticamente.

### Paso 4 — Publicar

- **Portal de licencias:** sube el `.tfplugin` para que los clientes lo descarguen con su clave.
- **Manual:** entrega el archivo al administrador del servidor.

Documentación técnica completa en el repo: `docs/PLUGINS-PACKAGING.md`.

---

## Instrucciones IA para empaquetado

Copiá el bloque siguiente en **Cursor**, Copilot u otro agente cuando trabajes en el **repo del plugin** (p. ej. `evd-plugin`). Ajustá los valores entre `<…>` antes de pegar.

```text
Contexto: estoy desarrollando un plugin comercial para The Forge. El core carga plugins
desde plugins-enabled/ vía dynamic import() — NUNCA importes código del monorepo theforge.

Objetivo: dejar el repo listo para generar un paquete .tfplugin instalable desde
Ajustes → Plugins (sin git clone ni consola en producción).

─── Contrato obligatorio (ITheForgePlugin) ───
- Clase con export default; readonly id (reverse-DNS, ej. com.kreodevs.evd), version, name, description.
- onPluginInit(context) — validar licencia/config; no lanzar errores fatales (el core hace skip).
- Opcional: getArtifactTypes(), generateArtifact(), getSettingsPanels(), hooks before/afterDocumentRender.
- Copia autocontenida de interfaces en src/core/plugin-contract.ts (no @theforge/* en runtime del plugin).

─── Estructura del repo ───
mi-plugin/
  package.json          # scripts: build, pack:tfplugin
  src/index.ts          # export { default } from "./plugin.js"
  src/plugin.ts         # class implements ITheForgePlugin
  dist/index.js         # salida ESM de producción

─── Reglas de build (NO negociables) ───
1. El ZIP de producción solo contiene .js compilado (no .ts).
2. index.js en la RAÍZ del ZIP (no subcarpeta extra al descomprimir).
3. export default class — el PluginLoaderService no acepta solo named exports.
4. No incluir node_modules ni peer deps (@nestjs/common, @nestjs/core) en el ZIP.
5. Dependencias propias: bundlear con esbuild (--platform=node) o documentar en manifest.
6. id en manifest === id en la clase del plugin.

─── Manifest (theforge-plugin.manifest.json en raíz del ZIP) ───
{
  "manifestVersion": "1",
  "id": "<com.empresa.mi-plugin>",
  "version": "<semver de package.json>",
  "name": "<nombre legible>",
  "entry": "index.js",
  "minCoreVersion": "<versión mínima del core, ej. 1.6.0>",
  "payloadSha256": "<hex calculado por el script de empaquetado>"
}

─── Empaquetado ───
Usar el script del monorepo The Forge (o copiarlo al repo del plugin):

  pnpm run build
  pnpm exec tsx scripts/pack-theforge-plugin.ts \
    --dir . \
    --out dist/<id>@<version>.tfplugin \
    --id <com.empresa.mi-plugin>

Si el servidor exige firma: añadir --sign con PLUGINS_SIGNING_SECRET en el entorno.

─── Checklist antes de entregar el .tfplugin ───
[ ] index.js existe en la raíz del ZIP y carga sin error
[ ] theforge-plugin.manifest.json presente y manifestVersion "1"
[ ] payloadSha256 coincide (regenerar con el script, no editar a mano)
[ ] minCoreVersion <= versión del core destino
[ ] Probar instalación: Ajustes → Plugins → Subir .tfplugin
[ ] Tras instalar en Docker: reiniciar theforge-worker (jobs BullMQ plugin-artifact)
[ ] getSettingsPanels / artifacts aparecen en UI tras carga exitosa

─── Referencias (repo theforge) ───
- docs/PLUGINS.md — contrato completo y hooks
- docs/PLUGINS-PACKAGING.md — especificación .tfplugin
- plugins-enabled/template/ — plantilla mínima
- scripts/pack-theforge-plugin.ts — empaquetador oficial

No inventes APIs de instalación distintas. No hardcodees rutas del core.
Si falta información (id, versión, artifacts), pregúntame antes de empaquetar.
```

**Tip:** guardá este bloque como regla de Cursor (`.cursor/rules/plugin-packaging.mdc`) o skill en el repo del plugin para que el agente lo aplique en cada sesión.

---

## Tutorial: instalar un plugin (administrador)

### Opción A — Subir archivo

1. Entrá a **Ajustes → Plugins**.
2. En **Instalación de plugins**, pulsá **Subir .tfplugin**.
3. Elegí el archivo (p. ej. `com.kreodevs.evd@2.1.0.tfplugin`).
4. Esperá confirmación. El plugin debe aparecer como **cargado** (icono verde).
5. Si el plugin expone ajustes (licencia, modelo de imagen…), configurálos en la misma pantalla.

### Opción B — Clave de licencia (EVD y comerciales)

1. **Ajustes → Plugins**.
2. En **Instalar con licencia**, indicá el id del plugin (ej. `com.kreodevs.evd`).
3. Pegá la clave de licencia (`tk_…`).
4. Pulsá **Instalar**. El core descarga el ZIP del portal y lo instala.

### Verificar

| Dónde | Qué comprobar |
|-------|----------------|
| Ajustes → Plugins | Plugin en lista **instalado** y **cargado** |
| Workshop | Sidebar con el artifact del plugin (p. ej. EVD) |
| API | `GET /api/plugins/health` — id en `pluginIds` |

### Desinstalar o actualizar

- **Quitar:** botón **Quitar** junto al plugin (solo admin).
- **Actualizar:** subí un `.tfplugin` con versión mayor; reemplaza la instalación anterior.
- **Recargar:** botón **Recargar** si el plugin está en disco pero no cargado.

---

## Producción (Dokploy / Docker)

En despliegues con Docker, los plugins viven en un **volumen persistente** compartido entre API y worker:

```text
theforge_plugins  →  /app/plugins-enabled
```

Así una instalación desde UI **sobrevive** a redeploys del código del core.

> **Importante — worker:** tras instalar, reiniciá el contenedor **`theforge-worker`** (jobs en cola como generación EVD). La API recarga el plugin al instante; el worker necesita reinicio para cargarlo en memoria.

```bash
docker compose restart theforge-worker
```

Variables útiles en el servidor:

| Variable | Uso |
|----------|-----|
| `PLUGINS_DIRECTORY` | Ruta de plugins (default `/app/plugins-enabled`) |
| `PLUGINS_MAX_UPLOAD_BYTES` | Límite de subida (default 50 MB) |
| `PLUGINS_SIGNING_SECRET` | Verificar firma de manifests |
| `LICENSE_PORTAL_URL` | URL del portal de licencias |

---

## Ejemplo: EVD (Executive Visual Deck)

EVD es el plugin comercial de presentaciones ejecutivas con imágenes IA.

| Paso | Acción |
|------|--------|
| 1 | El repo `evd-plugin` genera `com.kreodevs.evd@X.Y.Z.tfplugin` en CI |
| 2 | Se publica en el portal de licencias |
| 3 | Admin instala con licencia o subiendo el `.tfplugin` |
| 4 | Configura licencia y modelo de imagen en Ajustes → Plugins |
| 5 | En el Workshop, sidebar **EVD** → **Generar** |

---

## Errores frecuentes

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| “No hay plugins instalados” | Volumen vacío o sin install | Subir `.tfplugin` o activar licencia |
| Instalado pero no **cargado** | Error en `index.js` o falta entry | Revisar logs del API; pulsar **Recargar** |
| EVD en cola falla | Worker sin el plugin en memoria | `restart theforge-worker` |
| Checksum inválido | ZIP alterado o mal empaquetado | Regenerar con `pack-theforge-plugin.ts` |
| Core version | `minCoreVersion` mayor que el servidor | Actualizar The Forge o bajar requisito en manifest |

---

## Referencias en el repositorio

- `docs/PLUGINS-PACKAGING.md` — especificación completa del formato
- `docs/PLUGINS.md` — contrato `ITheForgePlugin` y hooks
- `docs/ARCHITECTURE_PLUGINS.md` — arquitectura runtime
- `scripts/pack-theforge-plugin.ts` — script de empaquetado
- `plugins-enabled/template/` — plantilla para nuevos plugins
