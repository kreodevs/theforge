import { z } from "zod";

export const securityArchitectureAuditHallazgoSchema = z.object({
  id: z.string().optional(),
  severidad: z.string().optional(),
  familia: z.string().optional(),
  verificacion: z.string().optional(),
  titulo: z.string().optional(),
  ubicacion: z.string().optional(),
  evidencia: z.string().optional(),
  consecuencia: z.string().optional(),
  criterio_cierre: z.string().optional(),
  depende_de: z.array(z.string()).optional(),
});

export const securityArchitectureAuditStructuredSchema = z.object({
  documento: z.string().optional(),
  version_auditada: z.string().optional(),
  fecha_auditoria: z.string().optional(),
  /** ISO-8601 inyectado por el servidor al consolidar la respuesta. */
  auditedAt: z.string().optional(),
  veredicto: z.string().optional(),
  resumen: z
    .object({
      bloqueante: z.number().optional(),
      alto: z.number().optional(),
      medio: z.number().optional(),
      bajo: z.number().optional(),
    })
    .optional(),
  cobertura: z
    .object({
      ejecutadas: z.number().optional(),
      pasa: z.number().optional(),
      falla: z.number().optional(),
      no_aplica: z.number().optional(),
    })
    .optional(),
  hallazgos: z.array(securityArchitectureAuditHallazgoSchema).optional(),
  /** Solo en extracción por fragmento: IDs del catálogo con evidencia evaluable en ese chunk. */
  ids_vistos: z.array(z.string()).optional(),
  no_evaluado: z.array(z.string()).optional(),
  supuestos: z.array(z.string()).optional(),
  /** Texto §8.4 Orden de resolución recomendado. */
  orden_resolucion: z.string().optional(),
});

export type SecurityArchitectureAuditHallazgo = z.infer<
  typeof securityArchitectureAuditHallazgoSchema
>;

export type SecurityArchitectureAuditStructured = z.infer<
  typeof securityArchitectureAuditStructuredSchema
>;

export interface MddSecurityArchitectureAuditResponse {
  veredicto?: string;
  markdownReport: string;
  structured?: SecurityArchitectureAuditStructured | null;
  /** p. ej. `cobertura_analitica_baja` cuando el modelo devolvió pocos hallazgos en MDD extenso */
  warnings?: string[];
  error?: string;
}

export interface MddSecurityArchitectureAuditSnapshot {
  veredicto?: string;
  markdownReport: string;
  structured?: SecurityArchitectureAuditStructured | null;
  auditedAt: string;
}
