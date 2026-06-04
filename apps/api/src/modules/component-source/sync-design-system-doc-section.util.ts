import type { DesignSystemMeta, DesignSystemTokens } from "@theforge/component-source";
import {
  MCP_DESIGN_SYSTEM_SECTION_HEADING,
  shouldUseMcpDesignSystem,
} from "@theforge/shared-types";
import { formatDesignSystemTokens } from "../ai-analysis/utils/wireframe-design-system-context.util.js";

export { MCP_DESIGN_SYSTEM_SECTION_HEADING };

const SECTION_HEADING_PATTERN = /^##\s+Design System \(MCP\)\s*$/im;

export type DesignSystemDocSyncTarget = "mdd" | "brd";

export type ApplyDesignSystemMcpToDocsInput = {
  designMd: string;
  tokens?: DesignSystemTokens;
  meta?: DesignSystemMeta;
  profileName?: string;
  mddContent?: string | null;
  brdContent?: string | null;
};

export type ApplyDesignSystemMcpToDocsResult = {
  target: DesignSystemDocSyncTarget | null;
  mddContent?: string;
  brdContent?: string;
  sectionHeading: typeof MCP_DESIGN_SYSTEM_SECTION_HEADING;
};

const MDD_SUBSTANTIAL_MIN = 400;
const BRD_SUBSTANTIAL_MIN = 200;

/**
 * MDD del proyecto si ya hay ingeniería; si no, BRD de fase 0 (paso previo al MDD técnico).
 */
export function resolveDesignSystemDocSyncTarget(
  mddContent: string | null | undefined,
  brdContent: string | null | undefined,
): DesignSystemDocSyncTarget | null {
  const mdd = (mddContent ?? "").trim();
  const brd = (brdContent ?? "").trim();
  if (mdd.length >= MDD_SUBSTANTIAL_MIN) return "mdd";
  if (brd.length >= BRD_SUBSTANTIAL_MIN) return "brd";
  if (mdd.length > 0) return "mdd";
  if (brd.length > 0) return "brd";
  return null;
}

/** Reemplaza o añade `## Design System (MCP)` sin modificar otras secciones. */
export function mergeMarkdownSectionByHeading(
  currentDoc: string,
  sectionWithHeading: string,
  headingPattern: RegExp = SECTION_HEADING_PATTERN,
): string {
  const current = (currentDoc ?? "").trim();
  const section = (sectionWithHeading ?? "").trim();
  if (!section) return current;
  if (!current) return section;

  const match = current.match(headingPattern);
  if (match?.index == null) {
    return `${current}\n\n${section}`;
  }

  const start = match.index;
  const afterHeading = current.slice(start + match[0].length);
  const nextH2 = afterHeading.match(/\n##\s+(?!#)/);
  const end =
    nextH2?.index != null ? start + match[0].length + nextH2.index : current.length;
  const before = current.slice(0, start).trimEnd();
  const after = current.slice(end).trimStart();
  return [before, section, after].filter(Boolean).join("\n\n");
}

function extractYamlTopLevelColors(designMd: string): Record<string, string> {
  const fm = designMd.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fm) return {};
  const yaml = fm[1] ?? "";
  const out: Record<string, string> = {};
  let inColors = false;
  for (const line of yaml.split("\n")) {
    if (/^colors:\s*$/i.test(line.trim())) {
      inColors = true;
      continue;
    }
    if (inColors && /^\S/.test(line) && !line.startsWith(" ")) {
      inColors = false;
    }
    if (!inColors) continue;
    const m = line.match(/^\s{2}(\w[\w-]*):\s*["']?(#[0-9A-Fa-f]{6})["']?\s*$/i);
    if (m) out[m[1]!.toLowerCase()] = m[2]!.toUpperCase();
  }
  return out;
}

export function buildMcpDesignSystemReferenceSection(input: {
  designMd: string;
  tokens?: DesignSystemTokens;
  meta?: DesignSystemMeta;
  profileName?: string;
}): string {
  const lines: string[] = [];
  lines.push(`## ${MCP_DESIGN_SYSTEM_SECTION_HEADING}`);
  lines.push("");
  const profileLabel = input.profileName?.trim() || "fuente de componentes";
  lines.push(
    `> Sincronizado desde el MCP **${profileLabel}**. Solo esta sección (y la Guía UX/UI) se actualizan al importar; el resto del documento no se modifica.`,
  );
  lines.push("");

  if (input.meta) {
    const { name, version, package: pkg } = input.meta;
    if (name || version || pkg) {
      lines.push("### Metadatos MCP");
      if (name) lines.push(`- **Nombre:** ${name}`);
      if (version) lines.push(`- **Versión:** ${version}`);
      if (pkg) lines.push(`- **Paquete:** ${pkg}`);
      lines.push("");
    }
  }

  const yamlColors = extractYamlTopLevelColors(input.designMd);
  const colorEntries = Object.entries(yamlColors);
  if (colorEntries.length > 0) {
    lines.push("### Paleta (tokens YAML)");
    lines.push("");
    lines.push("| Token | Hex |");
    lines.push("| --- | --- |");
    for (const [name, hex] of colorEntries.slice(0, 12)) {
      lines.push(`| ${name} | \`${hex}\` |`);
    }
    lines.push("");
  }

  let tokenBlock = "";
  if (input.tokens && Object.keys(input.tokens).length > 0) {
    tokenBlock = formatDesignSystemTokens({
      designMd: input.designMd,
      tokens: input.tokens,
      meta: input.meta ?? {
        name: input.profileName ?? "MCP",
        version: "—",
        schemaVersion: "—",
        indexedAt: "—",
        package: "—",
        tokensPackage: "—",
        tailwindPrefix: "—",
        theme: "light",
      },
      cssVars: {},
      styleRules: [],
      catalog: { moduleCount: 0 },
    });
  }
  if (tokenBlock) {
    lines.push("### Referencia técnica");
    lines.push("");
    lines.push(tokenBlock.slice(0, 2400));
    if (tokenBlock.length > 2400) lines.push("\n\n… (referencia recortada)");
    lines.push("");
  }

  lines.push(
    "La **Guía UX/UI** del proyecto contiene el DESIGN.md completo importado desde este MCP.",
  );

  return lines.join("\n").trim();
}

export function applyDesignSystemMcpToProjectDocs(
  input: ApplyDesignSystemMcpToDocsInput,
): ApplyDesignSystemMcpToDocsResult {
  const target = resolveDesignSystemDocSyncTarget(input.mddContent, input.brdContent);
  const section = buildMcpDesignSystemReferenceSection({
    designMd: input.designMd,
    tokens: input.tokens,
    meta: input.meta,
    profileName: input.profileName,
  });

  if (!target) {
    return { target: null, sectionHeading: MCP_DESIGN_SYSTEM_SECTION_HEADING };
  }

  if (target === "mdd") {
    return {
      target,
      sectionHeading: MCP_DESIGN_SYSTEM_SECTION_HEADING,
      mddContent: mergeMarkdownSectionByHeading(input.mddContent ?? "", section),
    };
  }

  return {
    target,
    sectionHeading: MCP_DESIGN_SYSTEM_SECTION_HEADING,
    brdContent: mergeMarkdownSectionByHeading(input.brdContent ?? "", section),
  };
}

/**
 * Tras regenerar el MDD, inyecta `## Design System (MCP)` si la guía MCP es válida.
 * Si no lo es, devuelve el MDD tal cual (el LLM define estilos en la guía por separado).
 */
export function preserveImportedDesignSystemInMdd(
  newMdd: string,
  input: ApplyDesignSystemMcpToDocsInput,
): string {
  if (!shouldUseMcpDesignSystem({ uxUiGuideContent: input.designMd })) {
    return newMdd;
  }
  const designMd = (input.designMd ?? "").trim();
  if (!designMd) return newMdd;

  const sync = applyDesignSystemMcpToProjectDocs({
    ...input,
    mddContent: newMdd,
  });
  return sync.mddContent ?? newMdd;
}
