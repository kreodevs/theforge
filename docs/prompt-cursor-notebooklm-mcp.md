# PROMPT (para pegar en Cursor)

Quiero dejar NotebookLM conectado a Cursor vía MCP y funcionando al 100%.

Tareas que tienes que completar **en orden**:

---

## A) Instalación

- **No hace falta instalar nada a mano.** El servidor se arranca con **npx** cuando Cursor lo necesite.
- Requisitos: tener **Node.js** (y `npx`) en el sistema. Si no está instalado, instálalo antes de continuar.

---

## B) Configuración en Cursor

- **Localiza el archivo de configuración MCP de Cursor:**
  - **macOS/Linux:** `~/.cursor/mcp.json`
  - **Windows:** `%USERPROFILE%\.cursor\mcp.json`
- **Añade el servidor de NotebookLM** dentro de `mcpServers`. Si ya tienes otros servidores, añade la entrada sin borrar los existentes:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "@pan-sec/notebooklm-mcp@latest"]
    }
  }
}
```

- **Comprueba** que el servidor aparece en la configuración MCP de Cursor (Settings → MCP o Manage MCP Servers). Reinicia Cursor si hace falta para que cargue el servidor.

---

## C) Autenticación (navegador)

- **Pide al agente de Cursor** que ejecute la herramienta **setup_auth** del servidor NotebookLM (por ejemplo: “Ejecuta setup_auth de NotebookLM” o “Configura la autenticación de NotebookLM”).
- Se abrirá una ventana de **Chrome**. Ahí:
  1. Inicia sesión con tu cuenta de **Google** (la que usas en notebooklm.google.com).
  2. Cuando hayas iniciado sesión correctamente, el comando terminará y guardará la sesión.
- La sesión se guarda en el perfil del MCP (en macOS: `~/Library/Application Support/notebooklm-mcp/` o similar). No hace falta volver a autenticar cada vez.
- **Guíame con pasos claros:** qué ventana es, dónde iniciar sesión y cuándo volver a Cursor.

---

## D) Verificación final

- **Comprueba que el servidor está activo:** pide al agente que ejecute la herramienta **get_health** del servidor NotebookLM. Debe devolver `authenticated: true`.
- **Verifica que funciona de verdad:** pide que ejecute **list_notebooks**. Si no tengo ningún cuaderno, opcionalmente crea uno de prueba (por ejemplo nombre “Prueba Cursor”) con **create_notebook** y luego vuelve a listar.

---

**Importante:** Si en algún momento necesitas que acepte permisos o que confirme una acción sensible (editar config, instalar Node, etc.), **pídemelo antes de continuar**.

---

## Referencias

- Repo del MCP (Pantheon-Security): https://github.com/Pantheon-Security/notebooklm-mcp-secure
- Paquete npm: `@pan-sec/notebooklm-mcp`
- Cursor MCP: el archivo de config es `~/.cursor/mcp.json`
