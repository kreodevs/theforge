/**
 * Tipos del sistema de plugins compartidos entre API y frontend.
 */

/** Definición de un artifact type que un plugin puede registrar */
export interface ArtifactTypeDefinition {
  /** Identificador único del artifact (ej: "evd", "ppt-export") */
  id: string;
  /** Label legible para humanos (ej: "Executive Visual Deck") */
  label: string;
  /** Nombre del ícono Lucide (ej: "Presentation", "FileText") */
  icon?: string;
  /** Si true, aparece en el sidebar de documentos del Workshop */
  showInSidebar?: boolean;
}

/** Datos de un plugin por proyecto: { [pluginId]: any } */
export type PluginDataMap = Record<string, unknown>;