import { z } from "zod";

/** Señales «Constitución Cursor» (rellenadas al normalizar markdown → JSON para el semáforo HIGH). */
export const mddConstitutionSchema = z.object({
  /** El MDD sigue la plantilla nueva (§1 con mapa/glosario); si es false, el semáforo no aplica puertas extra. */
  template_detected: z.boolean().optional(),
  has_context_map: z.boolean().optional(),
  has_glossary: z.boolean().optional(),
  has_gherkin: z.boolean().optional(),
  gherkin_scenario_count: z.number().optional(),
  /** true = hay ítems de bloqueo explícitos (no «Ninguno»). */
  has_open_blockers: z.boolean().optional(),
  has_stack_rationale: z.boolean().optional(),
});

export type MddConstitutionSignals = z.infer<typeof mddConstitutionSchema>;

export const mddJsonSchema = z
  .object({
    db_entities: z.array(z.unknown()).default([]),
    business_core: z.unknown().nullable().optional(),
    edge_cases: z.unknown().optional(),
    field_types: z.unknown().optional(),
    constitution: mddConstitutionSchema.optional(),
  })
  .passthrough();

export type MddJson = z.infer<typeof mddJsonSchema>;

/** Resultado del gate bloqueante de entrega MDD (≥9/10). Emitido en stream SSE y estimación en vivo. */
export interface MddDeliveryGateResult {
  ok: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
}

/** Gap estructurado del Quality Gate lean (enrutamiento Manager → generador por sección). */
export interface MddQualityGateGap {
  section: string;
  issue: string;
  fix: string;
}

/**
 * Resultado del Quality Gate lean del pipeline MDD.
 * `ok === true` cuando `blockers.length === 0` (sin umbrales 85/90).
 */
export interface MddQualityGateResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  gaps: MddQualityGateGap[];
}
