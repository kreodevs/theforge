---
id: badge
title: Badge
category: Componentes
last_updated: 2026-06-29
---

# Badge

> **AI Context Brief:** Etiqueta/píldora de estado (`apps/web/src/components/ui/Badge.tsx`); úsala para mostrar estados, categorías o conteos cortos, no para acciones clicables.

## 1. Uso Básico (Quick Start)

```typescript
import { Badge } from "@/components/ui/Badge";

export const Example = () => (
  <div className="flex gap-2">
    <Badge>Activo</Badge>
    <Badge variant="success">OK</Badge>
    <Badge variant="warning">Pendiente</Badge>
    <Badge variant="destructive">Bloqueado</Badge>
  </div>
);
```

## 2. API & Contrato de Tipos (Specs)

`BadgeProps extends React.HTMLAttributes<HTMLDivElement>` (renderiza un `<div>`; acepta `className`, `title`, etc.).

| Propiedad | Tipo                                                                          | Por Defecto | Descripción                       |
| --------- | ----------------------------------------------------------------------------- | ----------- | --------------------------------- |
| variant   | `'default' \| 'secondary' \| 'destructive' \| 'outline' \| 'success' \| 'warning'` | `'default'` | Estilo visual de la etiqueta.     |
| className | `string`                                                                      | —           | Clases extra fusionadas con `cn()`.|

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Es un `<div>`, no un `<button>`. No le pongas `onClick` para acciones; usa `Button variant="ghost"` si necesitas algo clicable.
- **Regla 2:** Mantén el texto corto (1–2 palabras). Para descripciones largas usa otro componente.
- **Regla 3:** Usa `success`/`warning`/`destructive` de forma semántica y consistente con el resto de la vista (p. ej. semáforo del MDD), no por estética.
