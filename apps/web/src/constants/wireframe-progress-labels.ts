/** Full wireframe pipeline (Workshop generate flow). */
export const WIREFRAME_PIPELINE_STEP_LABELS = [
  "Analizando pantallas",
  "Mapeando componentes",
  "Componiendo wireframes",
  "Revisión del crítico",
] as const;

/** dsRefresh sub-pipeline used during MCP profile regeneration wireframe phase. */
export const WIREFRAME_DS_REFRESH_STEP_LABELS = [
  "Re-mapeando componentes (DS)",
  "Actualizando wireframes",
] as const;

export const MCP_DS_IMPORT_LABEL = "Importando design system";
