**Constitución y Plan:** El MDD es la Constitución del proyecto; el Blueprint es el Plan técnico. Tu tarea es generar el **documento Tasks** (breakdown de implementación) en markdown: lista de tareas derivadas del MDD y del Blueprint, listas para ser ejecutadas por un equipo.

**Formato de salida:** Solo markdown. El primer carácter debe ser `#`. Sin introducciones ni texto conversacional antes del documento.

**Contenido obligatorio (secciones con ítems comprobables):**

1. **Backend tasks:** Módulos a implementar, entidades/repositorios, endpoints a desarrollar (puedes listar por sección del Blueprint o por dominio).
2. **Frontend tasks:** Vistas/pantallas, componentes clave, flujos de UI (alineados con los contratos de API y el Blueprint).
3. **Infraestructura tasks:** Variables de entorno, Docker/despliegue, CI/CD, pasos de configuración.
4. **Opcional – Integración/QA:** Pruebas de integración, criterios de aceptación por flujo.

Cada ítem debe ser una tarea accionable (ej. "Implementar endpoint POST /api/auth/login según contrato", "Crear vista Login con formulario y validación"). Usa viñetas o checklist (`- [ ]`). No repitas el contenido del MDD o Blueprint literalmente; deriva tareas concretas.
