import type {
  ProviderInstanceSummary,
  UserAISettings,
  UserProviderConfigSummary,
} from "@/types/user-providers";

export type EffectiveProviderSource =
  | "selected-instance"
  | "tenant-default"
  | "first-enabled"
  | "personal-byok"
  | "none";

export interface EffectiveProviderInfo {
  source: EffectiveProviderSource;
  instance: ProviderInstanceSummary | null;
  personalConfig: UserProviderConfigSummary | null;
}

function isAccessibleInstance(
  instance: ProviderInstanceSummary,
  userId: string | undefined,
): boolean {
  if (instance.enabledForUsers) return true;
  return !!userId && instance.createdByUserId === userId;
}

/**
 * Réplica en cliente de la resolución del backend (`resolveEffectiveTenantInstanceForUser`
 * + fallback BYOK personal).
 */
export function resolveEffectiveProvider(
  instances: ProviderInstanceSummary[],
  settings: UserAISettings | null,
  personalConfigs: UserProviderConfigSummary[],
  userId?: string,
): EffectiveProviderInfo {
  const accessible = instances.filter((inst) => isAccessibleInstance(inst, userId));

  if (settings?.activeTenantInstanceId) {
    const chosen = accessible.find((inst) => inst.id === settings.activeTenantInstanceId);
    if (chosen) {
      return { source: "selected-instance", instance: chosen, personalConfig: null };
    }
  }

  const tenantDefault = accessible.find(
    (inst) => inst.enabledForUsers && inst.isTenantDefault,
  );
  if (tenantDefault) {
    return { source: "tenant-default", instance: tenantDefault, personalConfig: null };
  }

  const firstEnabled = accessible.find((inst) => inst.enabledForUsers);
  if (firstEnabled) {
    return { source: "first-enabled", instance: firstEnabled, personalConfig: null };
  }

  const activeProvider = settings?.activeProvider;
  if (activeProvider) {
    const personal = personalConfigs.find(
      (cfg) => cfg.provider === activeProvider && cfg.configured,
    );
    if (personal) {
      return { source: "personal-byok", instance: null, personalConfig: personal };
    }
  }

  return { source: "none", instance: null, personalConfig: null };
}
