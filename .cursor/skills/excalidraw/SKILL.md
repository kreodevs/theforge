---
name: excalidraw
description: Creates and edits hand-drawn diagrams in Cursor via the Excalidraw MCP (create_view, checkpoints, export). Use when the user mentions Excalidraw, hand-drawn diagrams, architecture sketches, sequence/flow visuals, or wants an animated inline diagram instead of Mermaid-only output.
---

# Excalidraw (MCP)

Server MCP: **`user-excalidraw`** (tools: `read_me`, `create_view`, `export_to_excalidraw`, `save_checkpoint`, `read_checkpoint`).

## Workflow

1. **Primera vez en la conversación:** `CallMcpTool` → `read_me` (formato, colores, cámaras). **No volver a llamarlo** en el mismo hilo.
2. **Dibujar:** `create_view` con `elements` = **string JSON** de un array compacto (sin comentarios ni trailing commas).
3. **Guardar `checkpointId`** de la respuesta para iterar.
4. **Iterar:** prefijo `[{"type":"restoreCheckpoint","id":"<checkpointId>"}, ...nuevos...]` (incluye ediciones del usuario en fullscreen).
5. **Exportar enlace público (opcional):** `export_to_excalidraw` con JSON serializado completo.
6. **Checkpoints manuales:** `save_checkpoint` / `read_checkpoint` solo si el flujo lo exige.

## Reglas críticas (resumen)

| Tema | Regla |
|------|--------|
| Orden z | Fondo → forma → label → flechas → siguiente bloque (no agrupar todos los rects y luego todas las flechas) |
| Cámara | **Primer elemento:** `cameraUpdate` con ratio **4:3** (400×300, 600×450, **800×600** default, 1200×900, 1600×1200). Cámara **antes** del contenido que enmarca |
| Labels | Preferir `label` en rectangle/ellipse/diamond; texto suelto solo títulos/anotaciones |
| Tamaño | fontSize ≥ 16 cuerpo, ≥ 20 títulos; cajas ≥ 120×60; gaps 20–30px |
| IDs | Únicos; tras `delete` no reutilizar id |
| JSON | Válido, compacto, una sola línea si ayuda al límite de tokens |
| Emoji | No en textos (no renderizan) |
| Mermaid | Excalidraw ≠ Mermaid; si piden “estilo pizarra animado”, usar MCP, no solo ```mermaid |

## Patrones

**Diagrama nuevo:** `cameraUpdate` → zonas (opacity ~30) → nodos con `label` → `arrow` con `startBinding`/`endBinding`.

**Secuencia UML:** columnas actor + lifeline dashed; varias `cameraUpdate` que recorren el diagrama.

**Editar:** `restoreCheckpoint` + `delete` quirúrgico + elementos nuevos con ids frescos.

**Modo oscuro:** rect enorme `#1e1e2e` como **primer** elemento; texto `#e5e5e5`, nunca gris `#555` sobre oscuro.

## Cuándo NO usar

- El usuario pide solo Mermaid en markdown del repo (MDD, `/formatear`) → `@theforge/shared-types/mermaid`.
- MCP `user-excalidraw` no está habilitado → decirlo y ofrecer Mermaid o ASCII.

## Errores frecuentes

- `elements` inválido → validar JSON antes de `create_view`.
- Cámara sin padding → bordes cortados.
- Título centrado mal: `x ≈ cx - (text.length × fontSize × 0.5) / 2` para `type: text`.
- Flechas cortas con label largo → acortar label o alargar arrow.

## Referencia extendida

Paleta, ejemplos photosynthesis/MCP sequence/snake animation: [reference.md](reference.md)
