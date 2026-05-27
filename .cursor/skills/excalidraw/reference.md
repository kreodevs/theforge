# Excalidraw MCP — referencia rápida

Fuente canónica en runtime: tool `read_me` (llamar una vez por conversación).

## MCP

| Tool | Uso |
|------|-----|
| `read_me` | Formato completo + ejemplos |
| `create_view` | Render animado inline; devuelve `checkpointId` |
| `export_to_excalidraw` | Sube a excalidraw.com, URL compartible |
| `save_checkpoint` / `read_checkpoint` | Persistencia por id |

## Colores (resumen)

**Trazo / acento:** `#4a9eed` `#f59e0b` `#22c55e` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16`

**Relleno pastel:** `#a5d8ff` `#b2f2bb` `#ffd8a8` `#d0bfff` `#ffc9c9` `#fff3bf` `#c3fae8` `#eebefa`

**Zonas (opacity ~30):** `#dbe4ff` UI · `#e5dbff` lógica · `#d3f9d8` datos

## Elementos mínimos

```json
{ "type": "rectangle", "id": "r1", "x": 100, "y": 100, "width": 200, "height": 80,
  "roundness": { "type": 3 }, "backgroundColor": "#a5d8ff", "fillStyle": "solid",
  "label": { "text": "Servicio", "fontSize": 16 } }
```

```json
{ "type": "arrow", "id": "a1", "x": 300, "y": 140, "width": 150, "height": 0,
  "points": [[0,0],[150,0]], "endArrowhead": "arrow",
  "startBinding": { "elementId": "r1", "fixedPoint": [1, 0.5] },
  "endBinding": { "elementId": "r2", "fixedPoint": [0, 0.5] } }
```

**Pseudo-elementos:** `cameraUpdate`, `delete`, `restoreCheckpoint`

## Plantilla mínima

```json
[
  {"type":"cameraUpdate","width":800,"height":600,"x":0,"y":0},
  {"type":"rectangle","id":"a","x":80,"y":120,"width":180,"height":70,"roundness":{"type":3},"backgroundColor":"#a5d8ff","fillStyle":"solid","label":{"text":"A","fontSize":18}},
  {"type":"rectangle","id":"b","x":380,"y":120,"width":180,"height":70,"roundness":{"type":3},"backgroundColor":"#b2f2bb","fillStyle":"solid","label":{"text":"B","fontSize":18}},
  {"type":"arrow","id":"ab","x":260,"y":155,"width":120,"height":0,"points":[[0,0],[120,0]],"endArrowhead":"arrow","startBinding":{"elementId":"a","fixedPoint":[1,0.5]},"endBinding":{"elementId":"b","fixedPoint":[0,0.5]}}
]
```

## The Forge

- Documentación persistida (MDD, flujos): seguir Mermaid en repo salvo que pidan explícitamente Excalidraw.
- Arquitectura explicativa en chat / workshops: buen fit para `create_view` + `cameraUpdate`.
