/** Visual category for cross-artifact analyze gap lines from the API. */
export type SddGapCategory =
  | "phase0"
  | "spec"
  | "hu"
  | "tasks"
  | "conformance"
  | "governance"
  | "brd"
  | "other";

export function categorizeSddAnalyzeGap(gap: string): SddGapCategory {
  if (/^\[Phase0→/i.test(gap)) return "phase0";
  if (/^\[Spec↔MDD\]/i.test(gap) || /^Spec ausente/i.test(gap) || /NEEDS CLARIFICATION/i.test(gap)) return "spec";
  if (/^\[HU↔UC\]/i.test(gap) || /Historias de usuario|Casos de uso/i.test(gap)) return "hu";
  if (/^\[Tasks\]/i.test(gap) || /^Tasks ausente/i.test(gap)) return "tasks";
  if (/^\[(Blueprint|API|Flujos|Infra)/i.test(gap)) return "conformance";
  if (/Gobernanza/i.test(gap)) return "governance";
  if (/^\[BRD/i.test(gap)) return "brd";
  return "other";
}

export const SDD_GAP_CATEGORY_LABEL: Record<SddGapCategory, string> = {
  phase0: "Phase0 → BRD/Spec",
  spec: "Spec / MDD",
  hu: "HU / UC",
  tasks: "Tasks",
  conformance: "Conformance",
  governance: "Gobernanza IA",
  brd: "BRD",
  other: "Otros",
};
