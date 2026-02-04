# PROMPT (para pegar en Antigravity)

Quiero dejar NotebookLM conectado a Antigravity vía MCP y funcionando al 100%.

Tareas que tienes que completar **en orden**:

---

## A) Instalación

- Instala el paquete **notebooklm-mcp-server** (PyPI: https://pypi.org/project/notebooklm-mcp-server/).
- **Prioriza uv:** `uv tool install notebooklm-mcp-server`
- Si uv no está disponible, usa: `pip install notebooklm-mcp-server`
- Requisito: Python ≥ 3.11.

---

## B) Configuración en Antigravity

- **Localiza el archivo de configuración MCP** que usa Antigravity:
  - En Antigravity: abre el menú "..." en el panel del agente → **Manage MCP Servers** → **View raw config**. Ahí se edita el `mcp_config.json`.
  - Ruta típica del archivo (por si tienes que editarlo por terminal):
    - **macOS/Linux:** `~/.gemini/antigravity/mcp_config.json`
    - **Windows:** `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- **Añade el servidor de NotebookLM** en ese JSON. Primero obtén la ruta del ejecutable:
  - Ejecuta: `which notebooklm-mcp` (macOS/Linux) o `where notebooklm-mcp` (Windows).
  - Típicamente con uv: `~/.local/bin/notebooklm-mcp` (Linux/macOS) o en el path de uv en Windows.
- Entrada a añadir en `mcpServers` (sustituye `RUTA_COMPLETA` por el resultado de `which`/`where`):

```json
"notebooklm-mcp": {
  "command": "RUTA_COMPLETA"
}
```

- **Comprueba** que el servidor aparece en **Manage MCP Servers** y que Antigravity puede arrancarlo (reinicia o reconecta MCP si hace falta).

---

## C) Autenticación (navegador)

- Ejecuta en terminal: **`notebooklm-mcp-auth`**
- Se abrirá una ventana de **Chrome** (perfil dedicado del MCP). Ahí:
  1. Inicia sesión con tu cuenta de **Google** (la que usas en notebooklm.google.com).
  2. Ve a https://notebooklm.google.com si hace falta y confirma que ves tu cuenta.
  3. Cuando hayas iniciado sesión correctamente, cierra esa ventana de Chrome o sigue las instrucciones que muestre el comando.
- Los tokens se guardan en `~/.notebooklm-mcp` (o equivalente en Windows). No hace falta volver a autenticar cada vez.
- **Guíame con pasos claros:** qué ventana es, dónde iniciar sesión y cuándo volver a Antigravity (por ejemplo: “Cuando cierres Chrome y el comando termine, vuelve a Antigravity y prueba a listar notebooks”).

---

## D) Verificación final

- Confirma que el servidor MCP está **activo** (por ejemplo que aparece como conectado en Manage MCP Servers; si el servidor expone un healthcheck, úsalo).
- **Verifica que funciona de verdad:** listando mis notebooks con la herramienta que corresponda (en este MCP suele ser algo como `notebook_list` o equivalente). Si no tengo ningún notebook, crea uno de prueba (por ejemplo nombre “Prueba Antigravity”) y luego lista de nuevo.

---

**Importante:** Si en algún momento necesitas que acepte permisos o que confirme una acción sensible (instalar paquetes, editar config, ejecutar comandos en mi máquina), **pídemelo antes de continuar**.

---

## Referencias

- Paquete PyPI: https://pypi.org/project/notebooklm-mcp-server/
- Auth y uso: en la misma página PyPI, sección "Authentication" y "MCP Configuration".
- Antigravity MCP: https://antigravity.google/docs/mcp
