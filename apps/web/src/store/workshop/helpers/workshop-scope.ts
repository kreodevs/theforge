import type { WorkshopState } from "../workshop-state.types";

export function workshopScopeProjectId(get: () => WorkshopState): string {
  return (get().projectId ?? get().project?.id ?? "").trim();
}

export function shouldApplyWorkshopUpdate(get: () => WorkshopState, requestedProjectId: string): boolean {
  const id = requestedProjectId.trim();
  if (!id) return false;
  return workshopScopeProjectId(get) === id;
}
