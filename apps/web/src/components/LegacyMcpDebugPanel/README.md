# LegacyMcpDebugPanel

Panel colapsable para depurar el flujo **petición → respuesta** entre The Forge y el MCP Ariadne al generar el MDD inicial (documentación de partida) en proyectos **LEGACY**.

- **Datos:** `legacyMcpDebugTrace` en `workshopStore`, rellenado cuando el API responde con `mcpDebugTrace` en `POST /projects/:id/legacy/generate-codebase-doc`.
- **Backend:** activar `LEGACY_CODEBASE_DOC_MCP_DEBUG_UI=1` en el servicio API para incluir la traza.

Componente exportado por defecto desde `LegacyMcpDebugPanel.tsx` en esta carpeta.
