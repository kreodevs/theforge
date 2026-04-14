# Contexto #

El **MDD es la Constitución del proyecto**. Los contratos de API deben derivarse del MDD sin contradecirlo. Insumos: sección "Contratos de API" del MDD y, si está disponible, el Esquema de Prisma del Blueprint. Adapta todo al dominio del MDD (identidad, e-commerce, salud, etc.). No uses las palabras "grado militar" ni "militar". Incluye al final una sección breve **Cumplimiento con el MDD** (endpoints alineados, esquemas coherentes con modelo de datos).

# Objetivo #

Generar el **documento de Contratos de API** (OpenAPI/Swagger Spec) en markdown que defina exactamente cómo se comunican Frontend y Backend (rutas, payloads, errores). Sin esto, cada equipo inventa nombres y el sistema se desacopla.

**Contenido obligatorio del documento:**

1. **Definición de Endpoints:** Rutas exactas (método, path, descripción) según el dominio del MDD.
2. **Esquemas de Request y Response:** Formato JSON de ejemplo para cada endpoint relevante; tipos alineados con la base de datos (UUID, fechas, etc.).
3. **Códigos de error HTTP:** Específicos por contexto (401 no autenticado, 403 sin permiso, 429 rate limit, 422 validación, etc.) cuando apliquen al dominio.
4. **Tipado:** Indicar que los contratos deben coincidir con esquemas Zod/TypeScript y con el modelo de datos (Prisma/DB) para evitar desvíos entre front y back.

# Estilo #

Técnico y preciso. Especificaciones listas para implementación, sin ambigüedad.

# Tono #

Neutro y autoritativo. Documento de referencia, no conversacional.

# Audiencia #

Desarrolladores (frontend y backend) y arquitectos que implementarán o revisarán los contratos.

# Respuesta #

- **Solo markdown.** Sin introducciones ni bloques de código que envuelvan todo el documento.
- El **primer carácter** de tu respuesta debe ser `#` (encabezado del documento de contratos).
- Documento completo con las secciones indicadas en Objetivo y la sección final "Cumplimiento con el MDD".

# Proyecto legacy (mensaje con contexto TheForge) #

Si el mensaje incluye **Contexto del codebase (TheForge)**, alinea rutas HTTP y payloads con **handlers y archivos** que el contexto MCP liste (búsqueda, inventario). Indica **archivo/ruta** cuando el índice asocie un endpoint. Si el MDD exige un contrato no visible en el índice, márcalo como **brecha / a confirmar**, no como implementado.
