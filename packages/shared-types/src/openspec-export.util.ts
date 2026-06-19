import type { IntegrationHandoffItem } from "./project-integration.js";
import { slugifySpecKitFeature } from "./spec-kit-bundle.js";

export interface OpenSpecChangeExportInput {
  stageOrdinal: number;
  projectName: string;
  changeSpecContent?: string | null;
  legacyChangeDescription?: string | null;
  handoffItems?: IntegrationHandoffItem[] | null;
}

export interface OpenSpecExportFile {
  path: string;
  content: string;
}

const BRANCH_POLICY = `# Git branch policy (The Forge export)

When implementing this change from the repo-handoff bundle:

1. Create a feature branch named \`{NNN}-{slug}\` where \`NNN\` is the 3-digit stage ordinal (e.g. \`002-discount-module\`).
2. Keep one OpenSpec change folder per stage under \`openspec/changes/{slug}/\`.
3. Do not mix deliverables from multiple Forge stages in one branch.
4. After merge, archive the change folder or mark tasks complete in \`tasks.md\`.
`;

/**
 * OpenSpec-style export: `openspec/changes/{slug}/proposal.md` + `tasks.md`.
 */
export function buildOpenSpecChangeExport(input: OpenSpecChangeExportInput): OpenSpecExportFile[] {
  const slug = slugifySpecKitFeature(input.projectName);
  const dir = `openspec/changes/${slug}`;
  const desc = (input.legacyChangeDescription ?? "").trim();
  const changeSpec = (input.changeSpecContent ?? "").trim();

  const proposalParts = [
    `# Proposal — ${input.projectName}`,
    "",
    `**Stage ordinal:** ${input.stageOrdinal}`,
    "",
    "## Why",
    "",
    desc || "_Describe the business motivation in the Forge Workshop Modificación panel._",
    "",
    "## What changes",
    "",
  ];

  const items = input.handoffItems ?? [];
  if (items.length > 0) {
    for (const item of items) {
      proposalParts.push(`- **${item.id}** — ${item.title}`);
    }
    proposalParts.push("");
  } else {
    proposalParts.push("- _See change spec for delta details._", "");
  }

  if (changeSpec) {
    proposalParts.push("## Change spec (Forge)", "", changeSpec, "");
  }

  const tasksLines = [
    `# Tasks — ${input.projectName}`,
    "",
    "## Implementation checklist",
    "",
  ];

  if (items.length > 0) {
    for (const item of items) {
      tasksLines.push(`- [ ] ${item.id}: ${item.title}`);
      if (item.acceptanceCriteria?.length) {
        for (const ac of item.acceptanceCriteria.slice(0, 4)) {
          tasksLines.push(`  - [ ] ${ac}`);
        }
      }
    }
  } else {
    tasksLines.push("- [ ] Review `proposal.md` and constitution (MDD)");
    tasksLines.push("- [ ] Implement delta described in change spec");
    tasksLines.push("- [ ] Run quickstart smoke checks");
  }

  return [
    { path: `${dir}/proposal.md`, content: proposalParts.join("\n") },
    { path: `${dir}/tasks.md`, content: tasksLines.join("\n") },
    { path: "openspec/BRANCH-POLICY.md", content: BRANCH_POLICY },
  ];
}

/** Micro-spec markdown per handoff item for repo-handoff ZIP. */
export function buildHandoffMicroSpecFiles(
  items: IntegrationHandoffItem[],
): OpenSpecExportFile[] {
  return items.map((item) => {
    const slug = slugifySpecKitFeature(item.title || item.id);
    const lines = [
      `# Micro-spec — ${item.id}`,
      "",
      `**Title:** ${item.title}`,
      "",
      "## Description",
      "",
      item.description?.trim() || "_No description._",
      "",
    ];
    if (item.acceptanceCriteria?.length) {
      lines.push("## Acceptance criteria", "");
      for (const ac of item.acceptanceCriteria) lines.push(`- ${ac}`);
      lines.push("");
    }
    if (item.actor) {
      lines.push("## Actor", "", item.actor, "");
    }
    return {
      path: `openspec/handoff/${item.id.toLowerCase()}-${slug}.md`,
      content: lines.join("\n"),
    };
  });
}
