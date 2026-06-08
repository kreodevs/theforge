/** Rechaza persistir un documento que borra la mayor parte del contenido actual (fragmento sin merge). */
export function wouldShrinkDocDangerously(
  current: string,
  next: string,
  minRatio = 0.55,
): boolean {
  const c = current.trim();
  const n = next.trim();
  if (!c || c.length < 400) return false;
  if (!n) return true;
  if (n.length >= c.length * minRatio) return false;
  if (/^#\s/m.test(n) && n.length >= Math.min(c.length * 0.85, 2500)) return false;
  return true;
}
