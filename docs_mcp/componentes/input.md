---
id: input
title: Input
category: Componentes
last_updated: 2026-06-29
---

# Input

> **AI Context Brief:** Campo de texto base (`apps/web/src/components/ui/Input.tsx`); envoltorio fino de `<input>` con estilos del design system, úsalo para cualquier entrada de una línea.

## 1. Uso Básico (Quick Start)

```typescript
import { Input } from "@/components/ui/Input";

export const Example = () => (
  <Input
    type="text"
    placeholder="Nombre del proyecto"
    value={value}
    onChange={handleChange}
  />
);
```

## 2. API & Contrato de Tipos (Specs)

`InputProps extends React.InputHTMLAttributes<HTMLInputElement>` — acepta **todas** las props nativas de `<input>` (`type`, `value`, `onChange`, `placeholder`, `disabled`, `name`, `required`, etc.).

| Propiedad | Tipo     | Por Defecto | Descripción                                  |
| --------- | -------- | ----------- | -------------------------------------------- |
| type      | `string` | —           | Tipo de input HTML (`text`, `email`, …).     |
| className | `string` | —           | Clases extra fusionadas con `cn()`.          |
| ...props  | nativas  | —           | Cualquier atributo de `HTMLInputElement`.    |

Soporta `ref` (forwardRef a `HTMLInputElement`).

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No incluye `<label>` ni manejo de error; compón esos elementos alrededor (label asociado por `id`/`htmlFor`).
- **Regla 2:** El estado `disabled` ya baja opacidad y cambia el cursor; no dupliques estilos.
- **Regla 3:** Para selección/textarea usa los componentes correspondientes, no fuerces este `Input`.
- **Regla 4:** Colores vía tokens (`--input`, `--input-border`, `--ring`, `--foreground-muted`).
