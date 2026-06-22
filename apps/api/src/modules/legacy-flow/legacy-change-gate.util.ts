import { BadRequestException } from "@nestjs/common";
import {
  getLegacyChangeGateInput,
  isLegacyChangeGateSatisfied,
  LEGACY_CHANGE_GATE_CODE,
  LEGACY_CHANGE_GATE_MESSAGE,
} from "@theforge/shared-types";

type LegacyChangeGateStage = {
  ordinal?: number;
  legacyChangeState?: unknown;
  handoffImportedAt?: Date | string | null;
  handoffSnapshot?: unknown;
};

/**
 * Blocks legacy MDD / deliverables generation on stage 2+ until change intent is captured
 * (modification description, handoff import, or legacy/start).
 */
export function assertLegacyChangeGate(
  stage: LegacyChangeGateStage | null | undefined,
): void {
  const ordinal = stage?.ordinal ?? 1;
  if (ordinal < 2) return;

  const satisfied = isLegacyChangeGateSatisfied(getLegacyChangeGateInput(stage));

  if (satisfied) return;

  throw new BadRequestException({
    statusCode: 400,
    message: LEGACY_CHANGE_GATE_MESSAGE,
    error: "Bad Request",
    code: LEGACY_CHANGE_GATE_CODE,
  });
}
