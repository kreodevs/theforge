import {
  appendWorkshopChatPair,
  ensureWorkshopChatSession,
} from "./phase0-assisted";
import {
  mddPipelineAssistantAck,
  mddPipelineUserLabel,
} from "./mdd-pipeline-chat.util";
import type { Session } from "../types";
import type { WorkshopState } from "../workshop-state.types";

type PersistMddPipelineChatStartOpts = {
  projectId: string;
  mode?: string;
  userContent?: string;
  fetchWelcome: WorkshopState["fetchWelcome"];
  getSession: () => Session | null;
  stageId: string | null | undefined;
  hasBenchmark: boolean;
  hasExistingMdd: boolean;
};

/** Persiste par user/assistant en tab MDD al encolar pipeline (sobrevive F5). */
export async function persistMddPipelineChatStart(
  opts: PersistMddPipelineChatStartOpts,
): Promise<Session | null> {
  const userContent =
    opts.userContent?.trim() ||
    mddPipelineUserLabel(opts.mode, {
      hasExistingMdd: opts.hasExistingMdd,
      hasBenchmark: opts.hasBenchmark,
    });
  const assistantContent = mddPipelineAssistantAck(opts.mode, opts.hasBenchmark);

  const session = await ensureWorkshopChatSession({
    projectId: opts.projectId,
    tab: "mdd",
    fetchWelcome: opts.fetchWelcome,
    getSession: opts.getSession,
  });
  return appendWorkshopChatPair({
    session,
    stageId: opts.stageId,
    tab: "mdd",
    userContent,
    assistantContent,
  });
}
