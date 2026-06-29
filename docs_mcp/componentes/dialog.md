---
id: dialog
title: Dialog
category: Componentes
last_updated: 2026-06-29
---

# Dialog

> **AI Context Brief:** Modal accesible sobre Radix UI (`apps/web/src/components/ui/Dialog.tsx`); úsalo para diálogos/confirmaciones con overlay; expón el control con `open`/`onOpenChange`.

## 1. Uso Básico (Quick Start)

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export const Example = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>Confirmar</DialogTitle>
        <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant="destructive" onClick={handleConfirm}>Eliminar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

## 2. API & Contrato de Tipos (Specs)

`Dialog` re-exporta primitivas de `@radix-ui/react-dialog` (`Dialog` = Root, `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogOverlay`).

**`Dialog` (Root):** `open?: boolean`, `onOpenChange?: (open: boolean) => void`, `defaultOpen?`, `modal?`.

**`DialogContent`** extiende las props de `Radix.Content` y añade:

| Propiedad | Tipo                                          | Por Defecto | Descripción                          |
| --------- | --------------------------------------------- | ----------- | ------------------------------------ |
| size      | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'`      | `'md'`      | Ancho máximo del modal.              |
| showClose | `boolean`                                     | `true`      | Muestra el botón «X» (con aria-label). |
| className | `string`                                      | —           | Clases extra fusionadas con `cn()`.  |

Subcomponentes: `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`.

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Incluye **siempre** `DialogTitle` (Radix lo exige para accesibilidad); usa `DialogDescription` para el cuerpo corto.
- **Regla 2:** El overlay y el z-index salen de tokens (`--z-modal`, `--z-modal-backdrop`). No fijes z-index manuales.
- **Regla 3:** Para alertas destructivas con confirmación dedicada, prefiere `AlertDialog` si ya existe ese patrón en la vista.
- **Regla 4:** Controla el estado fuera (`open`/`onOpenChange`); evita estados internos duplicados.
