import { useCallback, useEffect, useState } from "react";
import { fetchEnabledProviderInstances } from "@/lib/provider-instances-api";
import {
  fetchUserAISettings,
  fetchUserProviderConfigs,
} from "@/lib/user-providers-api";
import { getStoredUser } from "@/utils/apiClient";
import {
  resolveEffectiveProvider,
  type EffectiveProviderInfo,
} from "@/utils/resolve-effective-provider";

interface ActiveProviderState {
  info: EffectiveProviderInfo;
  loading: boolean;
  error: string | null;
}

const EMPTY: EffectiveProviderInfo = {
  source: "none",
  instance: null,
  personalConfig: null,
};

export function useActiveProviderInfo() {
  const [state, setState] = useState<ActiveProviderState>({
    info: EMPTY,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [instances, settings, configs] = await Promise.all([
        fetchEnabledProviderInstances(),
        fetchUserAISettings(),
        fetchUserProviderConfigs(),
      ]);
      const info = resolveEffectiveProvider(
        instances,
        settings,
        configs,
        getStoredUser()?.id,
      );
      setState({ info, loading: false, error: null });
    } catch (e) {
      setState({
        info: EMPTY,
        loading: false,
        error: e instanceof Error ? e.message : "No se pudo cargar el proveedor",
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
