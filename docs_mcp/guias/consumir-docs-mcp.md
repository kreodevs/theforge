---
id: consumir-docs-mcp
title: Cómo consumir el Docs MCP desde un agente
category: Guías
last_updated: 2026-06-29
---

# Cómo consumir el Docs MCP desde un agente

> **AI Context Brief:** Flujo recomendado para que un agente de IA navegue la documentación de The Forge sin saturar su ventana de contexto: manifest → página concreta → herramientas puntuales.

## 1. Uso Básico (Quick Start)

```typescript
// 1) Descubrir qué existe (barato, una sola llamada):
//    leer recurso  docs://manifest   -> JSON con secciones y topics

// 2) Leer SOLO la página que necesitas:
//    leer recurso  docs://componentes/button

// 3) Búsqueda por palabras clave cuando no sabes la URI:
//    tool search_docs { "query": "estado de carga botón", "limit": 5 }

// 4) Contrato de un componente sin prosa alrededor:
//    tool get_component_api { "componentName": "Button" }
```

## 2. API & Contrato de Tipos (Specs)

| Paso | Acción MCP                         | Cuándo usarlo                                              |
| ---- | ---------------------------------- | --------------------------------------------------------- |
| 1    | Recurso `docs://manifest`          | Siempre primero; da el índice sin leer páginas completas. |
| 2    | Recurso `docs://<section>/<topic>` | Cuando ya sabes la URI desde el manifest o la búsqueda.   |
| 3    | Tool `search_docs(query)`          | No conoces la URI; buscas por tema/palabra clave.         |
| 4    | Tool `get_component_api(name)`     | Solo necesitas Props/Tipos/Uso de un componente.          |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No leas todas las páginas "por si acaso". Empieza por `docs://manifest` y abre solo lo necesario (filosofía atómica, contexto eficiente).
- **Regla 2:** Para preguntas de API de componentes, prefiere `get_component_api` sobre leer la página completa: devuelve menos tokens y solo el contrato.
- **Regla 3:** Si una URI no existe, el servidor responde con un error claro; relee `docs://manifest` para ver secciones/topics válidos en vez de adivinar.
