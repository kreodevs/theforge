import { useCallback, useEffect, useMemo } from "react";

/**
 * Hook para contenido de panel de documento con auto-guardado y detección de cambios.
 *
 * Maneja:
 * 1. `isDirty` — true si el contenido local difiere del original persistido
 * 2. `handleBlur` — persiste al salir del textarea
 * 3. Auto-save — debounce de 1500ms cuando cambia el contenido.
 *    Tras el PATCH, `persistField` no pisa el store si el usuario siguió escribiendo;
 *    los paneles usan `WorkshopDocTextarea` para no re-sincronizar `value` con foco.
 */
export function useAutoSaveContent(
  content: string | null,
  original: string | null | undefined,
  persistFn: (value: string) => void,
  projectId: string | undefined,
) {
  const isDirty = useMemo(
    () => (content ?? "") !== (original ?? ""),
    [content, original],
  );

  const handleBlur = useCallback(() => {
    if (content != null) persistFn(content);
  }, [content, persistFn]);

  useEffect(() => {
    if (!projectId || (content ?? "") === (original ?? "")) return;
    const t = setTimeout(() => persistFn(content ?? ""), 1500);
    return () => clearTimeout(t);
  }, [content, original, projectId, persistFn]);

  return { handleBlur, isDirty };
}
