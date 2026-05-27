/**
 * Tras un PATCH, no sobrescribir el estado local del editor si el usuario siguió escribiendo.
 */
export function shouldApplyPersistedFieldContent(
  localNow: string,
  localAtSaveStart: string,
  savedPayload: string,
): boolean {
  if (localNow === localAtSaveStart) return true;
  if (localNow === savedPayload) return true;
  return false;
}
