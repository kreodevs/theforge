/**
 * Mensajes de progreso MDD en tiempo pasado: se emiten cuando el nodo LangGraph ya terminó.
 */
export const MDD_NODE_PROGRESS_MESSAGE: Record<string, string> = {
  manager: "Entrevista con el usuario completada",
  clarifier: "Alcance y requisitos clarificados",
  software_architect: "Schema SQL y contratos de API definidos",
  formatter: "Documento MDD formateado",
  security: "Arquitectura de seguridad definida",
  integration: "Integraciones definidas",
  format_sec_int: "Secciones §6 y §7 fusionadas",
  diagram_injector: "Diagramas Mermaid añadidos",
  quality_gate: "Calidad del MDD evaluada (Quality Gate)",
  graph_populator: "Grafo de decisiones actualizado",
  /** Alias SSE legacy (1 release) — mismo mensaje que quality_gate. */
  auditor: "Calidad del MDD evaluada",
};

export function getMddNodeProgressMessage(nodeName: string): string {
  return MDD_NODE_PROGRESS_MESSAGE[nodeName] ?? `Paso «${nodeName}» completado`;
}
