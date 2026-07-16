/**
 * Pre-flight checks antes de generar Tasks (sin LLM + gates upstream).
 */

import {
  CASCADE_ACCURACY_THRESHOLD,
  type DomainInventory,
} from "@theforge/shared-types";
import { evaluateMddDeliveryGatePrepared } from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import { computeDocAccuracy } from "../engine/cascade-accuracy.util.js";

export type TasksPreflightResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
};

export function runTasksPreflight(params: {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  specMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  hasUxTeam?: boolean;
  uiScreensMarkdown?: string | null;
}): TasksPreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const mdd = (params.mddMarkdown ?? "").trim();
  if (mdd.length < 200) {
    blockers.push("MDD insuficiente (< 200 caracteres). Completa la constitución antes de Tasks.");
  }
  if (!/##\s*1[\.\s]/i.test(mdd) && !/##\s*2[\.\s]/i.test(mdd)) {
    warnings.push("MDD sin secciones §1/§2 reconocibles; la cobertura Tasks puede ser incompleta.");
  }

  const blueprint = (params.blueprintMarkdown ?? "").trim();
  if (blueprint.length < 80) {
    warnings.push("Blueprint vacío o muy corto; Tasks dependerá casi solo del MDD.");
  }

  const spec = (params.specMarkdown ?? "").trim();
  if (spec.length < 80) {
    warnings.push("Spec vacío; trazabilidad Story: puede quedar genérica.");
  }

  const api = (params.apiContractsMarkdown ?? "").trim();
  if (api.length < 80 && /##\s*4[\.\s]/i.test(mdd)) {
    warnings.push("MDD describe §4 API pero api-contracts está vacío; revisa coherencia upstream.");
  }

  if (params.hasUxTeam && (params.uiScreensMarkdown ?? "").trim().length < 80) {
    warnings.push("Proyecto con UX team pero sin pantallas MCP; Frontend tasks serán heurísticas.");
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
  };
}

export async function runTasksPreflightStrict(params: {
  mddMarkdown: string;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  blueprintMarkdown?: string | null;
  specMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  hasUxTeam?: boolean;
  uiScreensMarkdown?: string | null;
  inventory?: DomainInventory | null;
  /** Legacy AS-IS / ingeniería inversa: relaja gate MDD y Spec/Blueprint obligatorios. */
  legacyBaselineStage?: boolean;
}): Promise<TasksPreflightResult> {
  const base = runTasksPreflight(params);
  const blockers = [...base.blockers];
  const warnings = [...base.warnings];

  const spec = (params.specMarkdown ?? "").trim();
  const blueprint = (params.blueprintMarkdown ?? "").trim();
  const api = (params.apiContractsMarkdown ?? "").trim();
  const legacy = params.legacyBaselineStage === true;

  if (!legacy) {
    const gate = await evaluateMddDeliveryGatePrepared(params.mddMarkdown, {
      brdMarkdown: params.brdMarkdown,
      dbgaMarkdown: params.dbgaMarkdown,
    });
    if (!gate.ok) {
      if (gate.blockers.length > 0) {
        blockers.push(...gate.blockers.map((b) => `MDD delivery gate: ${b}`));
      } else {
        blockers.push(`MDD delivery gate: score ${gate.score}/100 insuficiente para Tasks.`);
      }
    }
    for (const w of gate.warnings) warnings.push(`MDD gate: ${w}`);

    if (spec.length < 80) {
      blockers.push("Spec vacío: genera Spec antes de Tasks.");
    }
    if (blueprint.length < 80) {
      blockers.push("Blueprint vacío: genera Blueprint antes de Tasks.");
    }
  }

  if (api.length < 80 && /##\s*4[\.\s]/i.test(params.mddMarkdown)) {
    if (legacy) {
      warnings.push("MDD §4 sin api-contracts persistidos (legacy baseline).");
    } else {
      blockers.push("MDD describe §4 API pero api-contracts está vacío.");
    }
  }

  if (!legacy && spec.length >= 80) {
    const docAcc = computeDocAccuracy({
      mddMarkdown: params.mddMarkdown,
      specMarkdown: spec,
      apiContractsMarkdown: api.length >= 80 ? api : undefined,
      brdMarkdown: params.brdMarkdown,
      dbgaMarkdown: params.dbgaMarkdown,
      inventory: params.inventory ?? undefined,
    });
    if (!docAcc.ok || docAcc.score < CASCADE_ACCURACY_THRESHOLD) {
      const hint = docAcc.blockers.slice(0, 3).join("; ") || docAcc.components.flatMap((c) => c.gaps).slice(0, 3).join("; ");
      blockers.push(
        `DocAccuracy upstream ${docAcc.score}/${CASCADE_ACCURACY_THRESHOLD}${hint ? `: ${hint}` : ""}`,
      );
    }
  }

  if (legacy) {
    warnings.push("Modo legacy baseline: pre-flight MDD delivery gate y Spec/Blueprint relajados.");
  }

  return { ok: blockers.length === 0, blockers, warnings };
}
