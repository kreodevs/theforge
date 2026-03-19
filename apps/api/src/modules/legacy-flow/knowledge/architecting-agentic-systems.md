# Architecting Agentic Systems: Frameworks, Patterns, and Advanced Workflows

Base de conocimiento para el flujo legacy (derivado del cuaderno "Architecting Agentic Systems: Frameworks, Patterns, and Advanced Workflows").

## Principios

- **Coordinador vs trabajadores:** Un agente coordinador orquesta pasos, toma decisiones de flujo y delega en herramientas (TheForge, generadores). Los trabajadores (revisor, generadores) no orquestan.
- **Herramientas externas:** Integrar MCPs (TheForge) para consultar código, impacto, contratos; las respuestas de herramientas se inyectan en el contexto del coordinador.
- **Revisor como gate:** Un agente revisor valida salidas (listas, documentos) antes de devolverlas al usuario; puede pedir correcciones al coordinador en un loop interno.
- **Estado del flujo:** Mantener estado explícito (archivos a modificar, preguntas, respuestas del usuario, MDD generado) para poder reanudar o auditar.

## Aplicación al flujo legacy

- LegacyCoordinator: orquesta start (TheForge → archivos + preguntas), answer, generate-mdd, generate-deliverables.
- LegacyReviewer: revisa lista de archivos/preguntas, MDD de cambio y cada entregable de la cascada antes de persistir o devolver.
- TheForge como herramienta: ask_codebase, get_modification_plan, validate_before_edit (obligatorio antes de editar; fallback get_legacy_impact), get_file_content, get_contract_specs y get_component_graph cuando el MCP los expone.
