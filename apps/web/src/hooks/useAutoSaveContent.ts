import { useCallback, useEffect, useMemo } from "react";
import { workshopDocumentBodiesEqual } from "../utils/workshop-document-content.util";

/**
 * Hook para contenido de panel de documento con auto-guardado y detección de cambios.
 *
 * Maneja:
 * 1. `isDirty` — true si el contenido local difiere del original persistido (ignora stamp API)
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
    () => !workshopDocumentBodiesEqual(content, original),
    [content, original],
  );

  const handleBlur = useCallback(() => {
    if (content != null && isDirty) persistFn(content);
  }, [content, isDirty, persistFn]);

  useEffect(() => {
    if (!projectId || !isDirty) return;
    const t = setTimeout(() => persistFn(content ?? ""), 1500);
    return () => clearTimeout(t);
  }, [content, original, projectId, persistFn, isDirty]);

  return { handleBlur, isDirty };
}
