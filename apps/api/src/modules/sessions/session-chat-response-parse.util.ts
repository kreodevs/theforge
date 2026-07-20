import type { MddDocumentAst } from "@theforge/shared-types";
import type { WorkshopChatAction } from "../ai/intent-route.types.js";

export type DocSplit = { docPart: string; chatPart: string } | null;
export type MddSplit = { mddPart: string; chatPart: string } | null;

export type WorkshopAssistantResponseParser = {
  tryParseDualOutput(
    response: string,
  ): { markdown: string; ast: MddDocumentAst | null; chatPart: string } | null;
  splitMddAndChat(response: string): MddSplit;
  splitUxUiGuideAndChat(response: string): DocSplit;
  splitDbgaAndChat(response: string): DocSplit;
  splitPhase0AndChat(response: string): DocSplit;
  splitDocAndChat(response: string, tag: string): DocSplit;
  detectDocFallback(response: string, activeTab: string): DocSplit;
};

export type ParsedWorkshopAssistantResponse = {
  dualMdd: { markdown: string; chatPart: string; ast?: MddDocumentAst | null } | null;
  mddSplit: MddSplit;
  uxSplit: DocSplit;
  dbgaSplit: DocSplit;
  phase0Split: DocSplit;
  specSplit: DocSplit;
  brdSplit: DocSplit;
  blueSplit: DocSplit;
  apiSplit: DocSplit;
  flowsSplit: DocSplit;
  tasksSplit: DocSplit;
  infraSplit: DocSplit;
  archSplit: DocSplit;
  useCasesSplit: DocSplit;
  storiesSplit: DocSplit;
  hasMdd: boolean;
  hasUx: boolean;
  hasDbga: boolean;
  hasSpec: boolean;
  hasBrd: boolean;
  hasPhase0: boolean;
  hasBlue: boolean;
  hasApi: boolean;
  hasFlows: boolean;
  hasTasks: boolean;
  hasInfra: boolean;
  hasArch: boolean;
  hasUseCases: boolean;
  hasStories: boolean;
  uxDocPart: string | undefined;
  dbgaDocPart: string | undefined;
  phase0DocPart: string | undefined;
  rawChat: string;
};

export type ParseWorkshopAssistantResponseOptions = {
  activeTab: string;
  intentAction: WorkshopChatAction;
  /** `sync` = chat(); `stream` = chatStream() — conserva diferencias menores del fallback. */
  mode: "sync" | "stream";
  logPrefix?: string;
};

export function parseWorkshopAssistantResponse(
  safeResponse: string,
  parser: WorkshopAssistantResponseParser,
  opts: ParseWorkshopAssistantResponseOptions,
): ParsedWorkshopAssistantResponse {
  const { activeTab, intentAction, mode, logPrefix = mode === "sync" ? "Chat" : "ChatStream" } = opts;

  let dualMdd: ParsedWorkshopAssistantResponse["dualMdd"] = null;
  if (intentAction === "edit_document" && activeTab === "mdd") {
    try {
      const dual = parser.tryParseDualOutput(safeResponse);
      if (dual) {
        dualMdd =
          mode === "sync"
            ? { markdown: dual.markdown, chatPart: dual.chatPart, ast: dual.ast }
            : { markdown: dual.markdown, chatPart: dual.chatPart };
      }
    } catch {
      dualMdd = null;
    }
  }

  let mddSplit = dualMdd
    ? { mddPart: dualMdd.markdown, chatPart: dualMdd.chatPart }
    : parser.splitMddAndChat(safeResponse);
  const uxSplit = parser.splitUxUiGuideAndChat(safeResponse);
  let dbgaSplit = parser.splitDbgaAndChat(safeResponse);
  let phase0Split = parser.splitPhase0AndChat(safeResponse);
  let specSplit = parser.splitDocAndChat(safeResponse, "SPEC");
  let brdSplit = parser.splitDocAndChat(safeResponse, "BRD");
  let blueSplit = parser.splitDocAndChat(safeResponse, "BLUEPRINT");
  let apiSplit = parser.splitDocAndChat(safeResponse, "API");
  let flowsSplit = parser.splitDocAndChat(safeResponse, "FLOWS");
  let tasksSplit = parser.splitDocAndChat(safeResponse, "TASKS");
  let infraSplit = parser.splitDocAndChat(safeResponse, "INFRA");
  let archSplit = parser.splitDocAndChat(safeResponse, "ARCH");
  let useCasesSplit = parser.splitDocAndChat(safeResponse, "USECASES");
  let storiesSplit = parser.splitDocAndChat(safeResponse, "STORIES");

  let hasMdd = mddSplit !== null;
  let hasUx = uxSplit !== null;
  let hasDbga = dbgaSplit !== null;
  let hasSpec = specSplit !== null;
  let hasBrd = brdSplit !== null;
  let hasPhase0 = phase0Split !== null;
  let hasBlue = blueSplit !== null;
  let hasApi = apiSplit !== null;
  let hasFlows = flowsSplit !== null;
  let hasTasks = tasksSplit !== null;
  let hasInfra = infraSplit !== null;
  let hasArch = archSplit !== null;
  let hasUseCases = useCasesSplit !== null;
  let hasStories = storiesSplit !== null;

  let uxDocPart: string | undefined = hasUx ? uxSplit!.docPart : undefined;
  let dbgaDocPart: string | undefined = hasDbga ? dbgaSplit!.docPart : undefined;
  let phase0DocPart: string | undefined = hasPhase0 ? phase0Split!.docPart : undefined;

  let rawChat = safeResponse;
  if (hasMdd) rawChat = mddSplit!.chatPart;
  else if (hasUx) rawChat = uxSplit!.chatPart;
  else if (hasDbga) rawChat = dbgaSplit!.chatPart;
  else if (hasPhase0) rawChat = phase0Split!.chatPart;
  else if (hasSpec) rawChat = specSplit!.chatPart;
  else if (hasBrd) rawChat = brdSplit!.chatPart;
  else if (hasBlue) rawChat = blueSplit!.chatPart;
  else if (hasApi) rawChat = apiSplit!.chatPart;
  else if (hasFlows) rawChat = flowsSplit!.chatPart;
  else if (hasTasks) rawChat = tasksSplit!.chatPart;
  else if (hasInfra) rawChat = infraSplit!.chatPart;
  else if (hasArch) rawChat = archSplit!.chatPart;
  else if (hasUseCases) rawChat = useCasesSplit!.chatPart;
  else if (hasStories) rawChat = storiesSplit!.chatPart;

  const isUxTab = activeTab.trim() === "ux-ui-guide";
  const looksLikeUxGuide =
    safeResponse.length > 200 &&
    (/#\s*Guía\s*UX\/UI/i.test(safeResponse) ||
      /^#?\s*Guía\s*UX\/UI/im.test(safeResponse) ||
      /^---\s*\n/i.test(safeResponse.trim()) ||
      /^name:\s*["']?[A-Z]/i.test(safeResponse.trim()) ||
      /colors:\s*\n/i.test(safeResponse) ||
      /typography:\s*\n/i.test(safeResponse) ||
      /components:\s*\n/i.test(safeResponse));

  if (isUxTab && !hasUx && looksLikeUxGuide) {
    hasUx = true;
    const trimmed = safeResponse.trim();
    const docStartMatch = trimmed.match(/#\s*Guía\s*UX\/UI/i);
    const yamlStartMatch = trimmed.match(/^---\s*\n/);
    const yamlInlineStart =
      !docStartMatch && !yamlStartMatch && /^name:\s*["']?[A-Z]/i.test(trimmed);
    const docStartIdx = docStartMatch?.index ?? 0;
    const hasIntro = docStartIdx > 0 && trimmed.slice(0, docStartIdx).trim().length > 0;
    let docSection: string;
    const chatParts: string[] = [];

    if (docStartMatch) {
      docSection = docStartIdx > 0 ? trimmed.slice(docStartIdx) : trimmed;
      if (hasIntro) chatParts.push(trimmed.slice(0, docStartIdx).trim());
      const hrMatch = docSection.match(/\n\s*[-*_]{3,}\s*\n/);
      if (hrMatch && hrMatch.index != null) {
        uxDocPart = docSection.slice(0, hrMatch.index).trim();
        const afterHr = docSection.slice(hrMatch.index + hrMatch[0].length).trim();
        if (afterHr.length > 0) chatParts.push(afterHr);
      } else {
        uxDocPart = docSection.trim();
      }
    } else if (yamlStartMatch || yamlInlineStart) {
      uxDocPart = trimmed;
    } else {
      uxDocPart = trimmed;
    }
    rawChat =
      chatParts.length > 0
        ? chatParts.join("\n\n")
        : "Guía UX/UI generada. Revisa el panel del documento.";
    console.log(
      `[${logPrefix}] fallback (mejorado): uxUiGuideContent length:`,
      uxDocPart?.length ?? 0,
      "chat length:",
      rawChat.length,
      "match type:",
      docStartMatch ? "h1" : yamlStartMatch ? "yaml" : yamlInlineStart ? "yaml-inline" : "other",
    );
  }

  {
    const fbTab = activeTab.trim();
    const fbSplit = parser.detectDocFallback(safeResponse, fbTab);
    if (fbSplit) {
      switch (fbTab) {
        case "spec":
          specSplit = fbSplit;
          hasSpec = true;
          break;
        case "blueprint":
          blueSplit = fbSplit;
          hasBlue = true;
          break;
        case "api-contracts":
          apiSplit = fbSplit;
          hasApi = true;
          break;
        case "logic-flows":
          flowsSplit = fbSplit;
          hasFlows = true;
          break;
        case "tasks":
          tasksSplit = fbSplit;
          hasTasks = true;
          break;
        case "infra":
          infraSplit = fbSplit;
          hasInfra = true;
          break;
        case "architecture":
          archSplit = fbSplit;
          hasArch = true;
          break;
        case "use-cases":
          useCasesSplit = fbSplit;
          hasUseCases = true;
          break;
        case "user-stories":
          storiesSplit = fbSplit;
          hasStories = true;
          break;
        case "benchmark":
          dbgaSplit = fbSplit;
          hasDbga = true;
          dbgaDocPart = fbSplit.docPart;
          break;
        case "brd":
          brdSplit = fbSplit;
          hasBrd = true;
          break;
        case "phase0":
          phase0Split = fbSplit;
          hasPhase0 = true;
          phase0DocPart = fbSplit.docPart;
          break;
        case "mdd":
          if (mode === "sync") {
            mddSplit = { mddPart: fbSplit.docPart, chatPart: fbSplit.chatPart };
            hasMdd = true;
          }
          break;
      }

      const allowGenericFallback = mode === "sync" ? !hasUx : !hasMdd && !hasUx;
      if (allowGenericFallback) {
        let fbFound = false;
        if (mode === "sync" && hasMdd) {
          rawChat = mddSplit!.chatPart;
          fbFound = true;
        } else if (hasDbga && dbgaSplit) {
          rawChat = dbgaSplit.chatPart;
          fbFound = true;
        } else if (hasSpec) {
          rawChat = specSplit!.chatPart;
          fbFound = true;
        } else if (hasBrd) {
          rawChat = brdSplit!.chatPart;
          fbFound = true;
        } else if (hasBlue) {
          rawChat = blueSplit!.chatPart;
          fbFound = true;
        } else if (hasApi) {
          rawChat = apiSplit!.chatPart;
          fbFound = true;
        } else if (hasFlows) {
          rawChat = flowsSplit!.chatPart;
          fbFound = true;
        } else if (hasTasks) {
          rawChat = tasksSplit!.chatPart;
          fbFound = true;
        } else if (hasInfra) {
          rawChat = infraSplit!.chatPart;
          fbFound = true;
        } else if (hasArch) {
          rawChat = archSplit!.chatPart;
          fbFound = true;
        } else if (hasUseCases) {
          rawChat = useCasesSplit!.chatPart;
          fbFound = true;
        } else if (hasStories) {
          rawChat = storiesSplit!.chatPart;
          fbFound = true;
        }
        if (fbFound) {
          console.log(`[${logPrefix}] fallback genérico detectado para tab:`, fbTab);
        }
      }
    }
  }

  return {
    dualMdd,
    mddSplit,
    uxSplit,
    dbgaSplit,
    phase0Split,
    specSplit,
    brdSplit,
    blueSplit,
    apiSplit,
    flowsSplit,
    tasksSplit,
    infraSplit,
    archSplit,
    useCasesSplit,
    storiesSplit,
    hasMdd,
    hasUx,
    hasDbga,
    hasSpec,
    hasBrd,
    hasPhase0,
    hasBlue,
    hasApi,
    hasFlows,
    hasTasks,
    hasInfra,
    hasArch,
    hasUseCases,
    hasStories,
    uxDocPart,
    dbgaDocPart,
    phase0DocPart,
    rawChat,
  };
}
