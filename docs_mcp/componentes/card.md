---
id: card
title: Card
category: Componentes
last_updated: 2026-06-29
---

# Card

> **AI Context Brief:** Contenedor de superficie (`apps/web/src/components/ui/Card.tsx`) con subcomponentes Header/Content/Footer/Title/Description; úsalo para agrupar contenido en paneles del Workshop, no para layouts de página completos.

## 1. Uso Básico (Quick Start)

```typescript
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";

export const Example = () => (
  <Card variant="elevated" hoverable>
    <CardHeader>
      <CardTitle>Proyecto</CardTitle>
      <CardDescription>Resumen del proyecto activo</CardDescription>
    </CardHeader>
    <CardContent>Contenido principal…</CardContent>
    <CardFooter>Acciones…</CardFooter>
  </Card>
);
```

## 2. API & Contrato de Tipos (Specs)

`Card extends React.HTMLAttributes<HTMLDivElement>`.

| Propiedad | Tipo                                                | Por Defecto | Descripción                                          |
| --------- | --------------------------------------------------- | ----------- | ---------------------------------------------------- |
| variant   | `'default' \| 'bordered' \| 'elevated' \| 'ghost'`  | `'default'` | Estilo de superficie/borde.                          |
| hoverable | `boolean`                                           | `false`     | Activa hover dorado + cursor pointer (tarjeta clicable). |
| className | `string`                                            | —           | Clases extra fusionadas con `cn()`.                  |

Subcomponentes (`children`/`className`): `CardHeader`, `CardContent`, `CardFooter`, `CardTitle` (`<h3>`), `CardDescription` (`<p>`).

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** El `Card` ya aplica `overflow-hidden`. No anides contenido que necesite desbordar (popovers, tooltips que salgan del borde) sin portal.
- **Regla 2:** Usa `hoverable` solo cuando toda la tarjeta es clicable; combínalo con un handler en el `Card` o envolviéndolo, no con botones internos contradictorios.
- **Regla 3:** Header y Footer dibujan sus propios bordes (`border-b` / `border-t`); no añadas separadores extra.
- **Regla 4:** Colores vía tokens (`--card`, `--card-border`, `--border`). No codifiques hex.
