---
id: empty-state
title: EmptyState
category: Componentes
last_updated: 2026-06-29
---

# EmptyState

> **AI Context Brief:** Estado vacío con ícono, título, descripción y acción opcional (`apps/web/src/components/ui/EmptyState.tsx`); úsalo cuando una lista/panel no tiene datos todavía.

## 1. Uso Básico (Quick Start)

```typescript
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, FolderGit2 } from "lucide-react";

export const Example = () => (
  <EmptyState
    icon={FolderGit2}
    title="Sin proyectos"
    description="Crea tu primer proyecto para empezar."
    action={{ label: "Nuevo proyecto", onClick: handleCreate, icon: <Plus className="h-4 w-4" /> }}
  />
);
```

## 2. API & Contrato de Tipos (Specs)

| Propiedad   | Tipo                                                          | Por Defecto   | Descripción                                  |
| ----------- | ------------------------------------------------------------- | ------------- | -------------------------------------------- |
| title       | `string`                                                      | — (requerido) | Encabezado del estado vacío.                 |
| description | `string`                                                      | —             | Texto secundario opcional.                   |
| icon        | `LucideIcon`                                                  | `FolderGit2`  | Ícono mostrado en el círculo superior.       |
| action      | `{ label: string; onClick: () => void; icon?: ReactNode }`   | —             | Botón de acción opcional (variant `outline`).|
| className   | `string`                                                      | —             | Clases extra fusionadas con `cn()`.          |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** `title` es obligatorio; mantenlo corto y accionable.
- **Regla 2:** Pasa el **componente** del ícono (`FolderGit2`), no un JSX renderizado, en `icon`.
- **Regla 3:** El botón de acción usa `variant="outline"` por diseño; no lo cambies para mantener consistencia entre estados vacíos.
- **Regla 4:** Tiene `min-h-[300px]` y borde discontinuo; pensado para ocupar el área de contenido, no como banner inline.
