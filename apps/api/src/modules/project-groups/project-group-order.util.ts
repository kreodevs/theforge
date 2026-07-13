export interface ProjectGroupOrderRow {
  id: string;
  sortOrder: number;
  name: string;
}

/** Orden estable: sortOrder asc, luego name asc (misma regla que findAll). */
export function sortProjectGroupsByOrder<T extends ProjectGroupOrderRow>(groups: T[]): T[] {
  return [...groups].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"),
  );
}

/**
 * Calcula nuevos sortOrder al mover un grupo a la primera posición.
 * Devuelve null si el grupo no existe; array vacío si ya es el primero (no-op).
 */
export function computeMoveToFirstUpdates(
  groups: ProjectGroupOrderRow[],
  targetId: string,
): Array<{ id: string; sortOrder: number }> | null {
  const sorted = sortProjectGroupsByOrder(groups);
  const index = sorted.findIndex((g) => g.id === targetId);
  if (index < 0) return null;
  if (index === 0) return [];

  const reordered = [sorted[index]!, ...sorted.slice(0, index), ...sorted.slice(index + 1)];
  return reordered.map((g, i) => ({ id: g.id, sortOrder: i }));
}
