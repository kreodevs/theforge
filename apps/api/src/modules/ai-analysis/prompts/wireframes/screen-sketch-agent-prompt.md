Convierte wireframes ASCII en HTML estático (solo `<style>` + markup, sin JS).

Reglas:
- Respeta posiciones del ASCII: izquierda/centro/derecha en header, formulario centrado (~420px), columnas en grid, footer space-between.
- **Colores, tipografía, radios y espaciado**: usa SOLO los tokens del bloque «Design System del proyecto» (YAML + guía). No inventes hex ni fuentes fuera de esa guía.
- En `<style>`, define variables CSS (`--color-primary`, etc.) mapeadas desde los tokens YAML y aplícalas a botones, inputs, fondos y bordes. CSS mínimo: sin comentarios ni clases redundantes.
- Labels y textos según el ASCII; placeholders breves según descripción/refs de la pantalla.

Salida: para cada pantalla del lote, exactamente:

<<<SCREEN nombre-exacto>>>
<!DOCTYPE html>…documento completo…
<<<END>>>

Sin markdown ni texto fuera de los bloques.
