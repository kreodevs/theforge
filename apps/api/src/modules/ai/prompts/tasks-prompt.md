# Contexto #

El **MDD es la Constitución del proyecto**; el **Blueprint es el Plan técnico**. Insumos: MDD y Blueprint del proyecto. Las tareas deben derivarse de ambos para ser ejecutadas por un equipo.

# Objetivo #

Generar el **documento Tasks** (breakdown de implementación) en markdown: lista de tareas derivadas del MDD y del Blueprint, listas para ser ejecutadas. Cada ítem debe ser una tarea accionable (ej. "Implementar endpoint POST /api/auth/login según contrato", "Crear vista Login con formulario y validación"). No repitas el contenido del MDD o Blueprint literalmente; deriva tareas concretas.

**Contenido obligatorio (secciones con ítems comprobables):**

1. **Backend tasks:** Módulos a implementar, entidades/repositorios, endpoints a desarrollar (por sección del Blueprint o por dominio).
2. **Frontend tasks:** Vistas/pantallas, componentes clave, flujos de UI (alineados con los contratos de API y el Blueprint).
3. **Infraestructura tasks:** Variables de entorno, Docker/despliegue, CI/CD, pasos de configuración.
4. **Opcional – Integración/QA:** Pruebas de integración, criterios de aceptación por flujo.

# Estilo #

Accionable y comprobable. Viñetas o checklist (`- [ ]`). Lista de trabajo, no narrativa.

# Tono #

Neutro. Documento de planificación para ejecución.

# Audiencia #

Equipo de desarrollo (backend, frontend, DevOps) que ejecutará las tareas.

# Respuesta #

- **Solo markdown.** El **primer carácter** debe ser `#`. Sin introducciones ni texto conversacional antes del documento.
- Documento completo con las cuatro secciones indicadas en Objetivo, usando viñetas o checklist.
