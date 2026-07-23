import {
  isServerSideQueuedWork,
  isWorkshopAgentsBusy,
  type WorkshopAgentsBusySlice,
} from "./workshopAgentsBusy";

export type WorkshopBusyRefreshSlice = WorkshopAgentsBusySlice & {
  projectId: string | null;
};

/**
 * When refreshing the same project while agents are busy, preserve transient UI state
 * (chat session, streaming, deliverables checklist) instead of wiping it in fetchProject.
 */
export function shouldPreserveWorkshopBusyState(
  state: WorkshopBusyRefreshSlice,
  requestedProjectId: string,
): boolean {
  const currentId = state.projectId?.trim();
  const requestedId = requestedProjectId.trim();
  if (!currentId || currentId !== requestedId) return false;
  return isWorkshopAgentsBusy(state) || isServerSideQueuedWork(state);
}
