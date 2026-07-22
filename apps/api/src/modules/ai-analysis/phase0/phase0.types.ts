/**
 * Fase 0 — Documento de especificación inicial interactivo.
 * Define los contratos de datos para el entrevistador IA.
 */

/** Secciones del documento Fase 0 */
export interface Phase0Document {
  /** 1. Propósito y Alcance */
  proposito: {
    problema: string;
    usuarios: string[];
    outOfScope: string[];
  };
  /** 2. Entidades del Dominio */
  entidades: Phase0Entity[];
  /** 3. Reglas de Negocio */
  reglasNegocio: string[];
  /** 4. Flujos Principales */
  flujos: Phase0Flow[];
  /** 5. Roles y Permisos */
  roles: Phase0Role[];
  /** 6. Integraciones Externas */
  integraciones: string[];
  /** 7. Edge Cases y Supuestos */
  edgeCases: string[];
  /** 8. Preguntas Pendientes — lo que no se alcanzó a preguntar */
  preguntasPendientes: string[];
  /** 9. Glosario de Dominio — términos clave del negocio (opcional pero recomendado) */
  glosario?: Phase0GlossaryEntry[];
  /** 10. Riesgos y Mitigación — alimenta §1 (Riesgos) del MDD (opcional pero recomendado) */
  riesgos?: Phase0Risk[];
  /** 11. Criterios de Aceptación (UAT) — alimenta §1 (UAT) del MDD (opcional pero recomendado) */
  criteriosUAT?: Phase0UATCriterion[];
  /** Stack declarado por el usuario — technologies nombradas literalmente en la idea (opcional) */
  stackUsuario?: string[];
  /** Aprobación/control dual explícito — flag para §3 del MDD (opcional) */
  aprobacionDual?: boolean;
  /** Roles por aplicación — para multi-tenant; alimenta §3 del MDD (opcional) */
  rolesPorApp?: Array<{ aplicacion: string; roles: Phase0Role[] }>;
}

export interface Phase0Entity {
  nombre: string;
  descripcion: string;
  atributosClave: string[];
}

export interface Phase0Flow {
  nombre: string;
  pasos: string[];
}

export interface Phase0Role {
  rol: string;
  permisos: string[];
}

export interface Phase0GlossaryEntry {
  termino: string;
  definicion: string;
}

export interface Phase0Risk {
  id: string;
  nombre: string;
  impacto: "Alto" | "Medio" | "Bajo";
  probabilidad: "Alta" | "Media" | "Baja";
  mitigacion: string;
}

export interface Phase0UATCriterion {
  id: string;
  descripcion: string;
}

/** Criticidad de un gap de información */
export type GapCriticidad = "critico" | "importante" | "opcional";

/** Un gap: algo que le falta al documento */
export interface Phase0Gap {
  seccion: keyof Phase0Document;
  criticidad: GapCriticidad;
  descripcion: string;
  /** Por qué este gap bloquea o reduce la calidad */
  razon: string;
  /** Sugerencia de pregunta para el entrevistador */
  sugerenciaPregunta: string;
}

/** Estado completo del proceso de entrevista */
export interface Phase0InterviewState {
  projectId: string;
  threadId: string;
  borrador: Phase0Document;
  gaps: Phase0Gap[];
  preguntasRealizadas: number;
  maxPreguntas: number;  // default 5
  /** Cola fija de gaps a entrevistar (máx. maxPreguntas), definida al arrancar */
  questionPlan: Phase0Gap[];
  /** Índice del siguiente gap planificado en questionPlan */
  planCursor: number;
  status: "idle" | "starting" | "interviewing" | "done" | "error";
  /** Input original del usuario (idea cruda o documento externo) */
  inputRaw: string;
  /** Tipo de input */
  inputType: "idea" | "external_doc";
  /** Última pregunta hecha (para tracking) */
  ultimaPregunta?: string;
  /** Historial de preguntas y respuestas */
  historial: Phase0QA[];
  /** Entrevista inicial vs auditoría manual vs modo asistido (chat Workshop) */
  mode: "interview" | "audit" | "assisted";
  /**
   * structured = borrador entrevista / markdown Fase 0 canónico.
   * freeform_dbga = dbgaContent libre (lo que muestra el Workshop en pestaña Fase 0).
   * deep_research = Especificador de Base en phase0SummaryContent.
   */
  sourceFormat?: "structured" | "freeform_dbga" | "deep_research";
  /** Markdown vivo del documento asistido (plantillas B/C o A serializado). */
  workingMarkdown?: string;
}

export interface Phase0QA {
  pregunta: string;
  respuesta: string;
  gapResuelto?: string;
}

/** Eventos del streaming NDJSON */
export type Phase0StreamEvent =
  | { type: "init"; threadId: string; borrador: Phase0Document }
  | { type: "question"; question: string; n: number; total: number; borrador?: Phase0Document; gaps?: Phase0Gap[] }
  | { type: "draft_updated"; borrador: Phase0Document; gaps: Phase0Gap[] }
  | {
      type: "done";
      borrador: Phase0Document;
      gaps: Phase0Gap[];
      message?: string;
      /** Markdown DBGA generado al finalizar (también persistido en dbgaContent) */
      markdown?: string;
    }
  | {
      type: "audit_complete";
      message: string;
      borrador: Phase0Document;
      gaps: Phase0Gap[];
    }
  | {
      type: "audit_started";
      threadId: string;
      borrador: Phase0Document;
      gaps: Phase0Gap[];
      question: string;
      n: number;
      total: number;
    }
  | {
      type: "assisted_started";
      threadId: string;
      templateKind: "structured" | "freeform_dbga" | "deep_research";
      templateLabel: string;
      /** Campo persistido que se está editando */
      targetField: "dbgaContent" | "phase0SummaryContent";
      markdown: string;
      reformatted: boolean;
      question: string;
      n: number;
      total: number;
      gaps: Phase0Gap[];
      message: string;
      /** true si hace falta que el usuario envíe idea/documento en el chat */
      awaitingSeed?: boolean;
    }
  | {
      type: "assisted_turn";
      threadId: string;
      templateKind: "structured" | "freeform_dbga" | "deep_research";
      targetField: "dbgaContent" | "phase0SummaryContent";
      markdown: string;
      impacto: string;
      cambios: string[];
      question?: string;
      n: number;
      total: number;
      gaps: Phase0Gap[];
      done: boolean;
      message: string;
    }
  | {
      type: "assisted_stopped";
      message: string;
      markdown?: string;
      targetField?: "dbgaContent" | "phase0SummaryContent";
    }
  | { type: "error"; message: string; code?: string };

/** Respuesta del prompt de arranque */
export interface StarterPromptOutput {
  borrador: Phase0Document;
  gaps: Phase0Gap[];
}

/** Peso de criticidad para ordenar gaps */
export const GAP_WEIGHT: Record<GapCriticidad, number> = {
  critico: 0,
  importante: 1,
  opcional: 2,
};