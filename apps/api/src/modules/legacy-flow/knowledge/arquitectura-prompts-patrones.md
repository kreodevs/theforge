# Arquitectura de Prompts y Patrones

Base de conocimiento para el flujo legacy (derivado del cuaderno NotebookLM "Arquitectura de Prompts y Patrones").

## Principios

- **Separación de responsabilidades:** System prompt (rol, restricciones, formato) vs user message (contexto y tarea concreta).
- **Patrones de composición:** Encadenar pasos (análisis → síntesis → revisión) con salidas estructuradas (JSON, markdown con secciones).
- **Contexto acotado:** Inyectar solo el contexto necesario; usar resúmenes o fragmentos cuando el documento sea largo.
- **Revisión antes de entregar:** Un paso de revisión (revisor) que valida coherencia, completitud y alineación con el contrato antes de devolver al usuario.

## Aplicación al flujo legacy

- El coordinador orquesta pasos y consulta FalkorSpecs MCP; el revisor revisa lista de archivos, MDD y entregables antes de presentarlos.
- Prompts del coordinador y revisor deben incluir este conocimiento para mantener consistencia y calidad.
