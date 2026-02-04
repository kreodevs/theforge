# components

Componentes reutilizables.

| Componente            | Uso                                                                                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ChatContainer.tsx** | Columna de chat: mensajes con scroll automático, input y botón Enviar. Usa useInterview(projectId) para mensajes y sendMessage. En tab MDD, si hay `pendingPlanApproval` (HITL 4.4), muestra una tarjeta con el plan propuesto y botones "Ejecutar" / "Modificar".            |
| **MddViewer.tsx**     | Visualizador de MDD por secciones: parsea markdown por cabeceras (##, ###), renderiza cada sección con ReactMarkdown en un MdSection memoizado. Soporta bloques `mermaid` (gráficos Mermaid). Solo re-renderiza las secciones cuyo contenido cambió (streaming sin parpadeo). |
