---
id: button
title: Button
category: Componentes
last_updated: 2026-06-29
---

# Button

> **AI Context Brief:** Botón base del design system (`apps/web/src/components/ui/Button.tsx`); úsalo para cualquier acción clicable, con estado de carga opcional (spinner o puntos generativos para tareas largas de IA).

## 1. Uso Básico (Quick Start)

```typescript
import { Button } from "@/components/ui/Button";

export const Example = () => (
  <Button variant="default" size="default" onClick={handleClick}>
    Guardar
  </Button>
);

// Estado de carga para acciones largas (genera documentos / llama a la IA)
export const Generating = () => (
  <Button loading generativeLoading>
    Generando…
  </Button>
);
```

## 2. API & Contrato de Tipos (Specs)

`ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>` (acepta `onClick`, `type`, `disabled`, etc.).

| Propiedad         | Tipo                                                                      | Por Defecto | Descripción                                                              |
| ----------------- | ------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| variant           | `'default' \| 'secondary' \| 'outline' \| 'ghost' \| 'destructive' \| 'link'` | `'default'` | Estilo visual del botón.                                                 |
| size              | `'default' \| 'sm' \| 'lg' \| 'icon'`                                     | `'default'` | Tamaño; `icon` produce un botón cuadrado 10×10 sin padding horizontal.   |
| loading           | `boolean`                                                                 | `false`     | Muestra indicador de carga y deshabilita el botón.                       |
| generativeLoading | `boolean`                                                                 | `false`     | Con `loading`, usa puntos estilo IA en vez del spinner circular.         |
| disabled          | `boolean`                                                                 | `false`     | Deshabilita la interacción (también se fuerza cuando `loading` es true). |
| className         | `string`                                                                  | —           | Clases extra; se fusionan con `cn()` sobre las variantes.                |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** El color sale de tokens CSS (`--primary`, `--secondary`, `--destructive`, …). No codifiques colores hex; usa `variant` o ajusta el token.
- **Regla 2:** `loading` ya fuerza `disabled`; no necesitas pasar ambos para bloquear el click durante una operación.
- **Regla 3:** Usa `generativeLoading` solo para tareas largas de IA/documentos (coherencia con el resto del Workshop); para acciones cortas deja el spinner por defecto.
- **Regla 4:** Para botones solo-ícono usa `size="icon"` e incluye `aria-label` por accesibilidad.
