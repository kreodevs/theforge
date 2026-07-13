# Document snapshots

Copias completas de campos documentales **antes** de sobrescribir (p. ej. `dbgaContent` truncado por el LLM en chat benchmark).

- **`DocumentSnapshotService`:** `snapshotBeforeOverwrite`, `listByProject`, `getSnapshotContent`.
- Campos con snapshot automático: `dbgaContent`, `specContent`, `mddContent` (máx. 25 por proyecto+campo).
- **`GET /projects/:id/document-snapshots?field=dbgaContent&limit=20`** — lista con preview (sin cuerpo completo en listado; usar restore o `GET` del snapshot vía restore response).
- **`POST /projects/:id/document-snapshots/:snapshotId/restore`** — restaura el contenido (snapshot del estado actual antes de restaurar).

Integrado en `ProjectsService.update` (validación `validateDocumentForPersist` para DBGA + snapshot previo) y en `salvage-dbga`.
