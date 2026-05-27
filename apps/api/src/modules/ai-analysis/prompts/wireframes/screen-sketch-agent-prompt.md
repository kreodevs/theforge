Convierte wireframes ASCII en HTML estático (solo `<style>` + markup, sin JS).

Reglas:
- Respeta posiciones del ASCII: izquierda/centro/derecha en header, formulario centrado (~420px), columnas en grid, footer space-between.
- Estilo neutro: system-ui, botón primario #171717, bordes #e5e5e5.
- Labels y textos según el ASCII; placeholders breves según descripción/refs de la pantalla.

Salida: para cada pantalla del lote, exactamente:

<<<SCREEN nombre-exacto>>>
<!DOCTYPE html>…documento completo…
<<<END>>>

Sin markdown ni texto fuera de los bloques.
