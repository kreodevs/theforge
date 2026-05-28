import { useCallback, useEffect, useMemo } from "react";
import { useActiveProviderInfo } from "./useActiveProviderInfo";
import { resolveSttModelFromEffective } from "@/utils/resolve-effective-provider";

/**
 * STT y visión de la instancia activa (misma lógica que el API: activeTenantInstanceId → default → BYOK).
 * Recarga al volver del foco (p. ej. tras marcar otra instancia en Ajustes).
 */
export function useRuntimeMediaConfig() {
  const { vision, info, catalog, loading, reload } = useActiveProviderInfo();

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const visionModel = vision.supportsVision ? vision.model : null;
  const sttModel = useMemo(
    () => resolveSttModelFromEffective(info, catalog),
    [info, catalog],
  );

  const activeInstanceId = info.instance?.id ?? null;

  const reloadMediaConfig = useCallback(() => {
    void reload();
  }, [reload]);

  return {
    visionModel,
    sttModel,
    supportsVision: vision.supportsVision,
    supportsStt: !!sttModel,
    activeInstanceId,
    loading,
    reload: reloadMediaConfig,
  };
}
