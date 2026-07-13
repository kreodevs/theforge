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

/** Tipo de campo en un panel de ajustes de plugin */
export type PluginSettingsFieldType = "text" | "password" | "select" | "url";

/** Campo de formulario declarado por un plugin para Ajustes */
export interface PluginSettingsFieldDefinition {
  key: string;
  label: string;
  type: PluginSettingsFieldType;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Solo para type === "select" */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Panel de ajustes que un plugin expone en la UI de Ajustes del core.
 * El core lo monta como tarjeta «enganchada» sin conocer la lógica del plugin.
 */
export interface PluginSettingsPanelDefinition {
  /** Identificador reverse-DNS del plugin dueño */
  pluginId: string;
  /** Id único del panel dentro del plugin */
  id: string;
  /** Título visible en Ajustes */
  label: string;
  description?: string;
  /** Sección de Ajustes donde se monta (hoy solo plugins) */
  mountPoint?: "settings.plugins";
  /** Orden relativo dentro de la sección (menor = arriba) */
  order?: number;
  fields: PluginSettingsFieldDefinition[];
}

/** Mapa userId → ajustes por pluginId */
export type PluginUserSettingsMap = Record<string, Record<string, unknown>>;
