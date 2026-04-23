import type { DeliverableKind } from "@theforge/shared-types";

/** Una traza de generación por secciones + verificación (persistida en `lastDeliverablesDebug`). */
export interface LegacySectionMergeTrace {
  kind: DeliverableKind;
  groups: Array<{
    id: string;
    sections: number[];
    durationMs: number;
    outChars: number;
    ok: boolean;
  }>;
  mechanicalOk: boolean;
  conformanceOk?: boolean;
  gaps: string[];
  repaired?: boolean;
  finalChars: number;
}
