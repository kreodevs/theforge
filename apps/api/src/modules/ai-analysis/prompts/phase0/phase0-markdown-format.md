# Formato markdown — Fase 0 estructurado

Aplica cuando el documento use la plantilla **«Fase 0 — Especificación Inicial»** (secciones `## 1.` … `## 7.`).

## §4 Flujos Principales (crítico)

- Cada flujo: subtítulo `### Nombre del flujo`.
- Los pasos son **listas ordenadas** (`1.`, `2.`, …) **al mismo nivel** que el flujo, **sin** encabezados markdown:

```markdown
### Inicio de chat y autenticación
1. El usuario envía un mensaje por WhatsApp.
2. El middleware valida la identidad del usuario.
3. El copiloto asigna el chat al agente configurado.
```

**Prohibido** dentro de §4:

- `## 1. …`, `## 2. …` (compiten con `## 5. Roles y Permisos` y rompen el índice).
- `### La cola es gestionada…` como nota suelta: usa viñeta `- La cola es gestionada…` bajo el paso correspondiente.

## Otras secciones

- **Entidades (§2):** `### Nombre` + `**Descripción:**` + atributos en `**Atributos clave:**` o viñetas `-`.
- **Reglas (§3), integraciones (§6), edge cases (§7):** viñetas `-`.
- **Roles (§5):** `- **Rol:** permisos, permisos`.

No inventes secciones `## N.` intermedias dentro de un flujo; reserva `## N.` solo para las siete secciones canónicas del documento.
