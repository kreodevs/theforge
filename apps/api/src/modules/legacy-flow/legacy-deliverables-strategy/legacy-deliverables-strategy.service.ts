import { Injectable } from "@nestjs/common";
import type { DeliverableKind } from "@theforge/shared-types";
import { resolveLegacyDeliverablesSectionMergeAttempt } from "./legacy-deliverables-strategy.resolver.js";
import type {
  LegacyDeliverablesStrategyContext,
  LegacyDeliverablesStrategyResolution,
} from "./legacy-deliverables-strategy.types.js";

/**
 * Fachada Nest sobre el resolver puro de estrategia de entregables legacy.
 * Permite sustituir o componer reglas (p. ej. tokenizador real) sin acoplar el coordinador.
 */
@Injectable()
export class LegacyDeliverablesStrategyService {
  async resolveSectionMergeAttempt(
    kind: DeliverableKind,
    ctx: LegacyDeliverablesStrategyContext,
  ): Promise<LegacyDeliverablesStrategyResolution> {
    return resolveLegacyDeliverablesSectionMergeAttempt(kind, ctx);
  }
}
