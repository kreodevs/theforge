import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Loader2, Zap } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui";
import { getStoredUser } from "@/utils/apiClient";
import type { ProviderInstanceSummary, UserAISettings } from "@/types/user-providers";
import {
  fetchAllProviderInstances,
  fetchEnabledProviderInstances,
} from "@/lib/provider-instances-api";
import { fetchUserAISettings, updateUserAISettings } from "@/lib/user-providers-api";

function canPickInstances(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}

function auditorModelLabel(inst: ProviderInstanceSummary): string {
  const model = inst.auditorChatModel?.trim() || inst.chatModel;
  return `${inst.displayName} — ${model}`;
}

function fastTaskModelLabel(inst: ProviderInstanceSummary): string {
  const model = inst.fastTaskChatModel?.trim() || inst.chatModel;
  return `${inst.displayName} — ${model}`;
}

export function AgentsConfigCard() {
  const role = getStoredUser()?.role;
  const canPick = canPickInstances(role);
  const isDeveloper = role === "developer";

  const [instances, setInstances] = useState<ProviderInstanceSummary[]>([]);
  const [settings, setSettings] = useState<UserAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const auditorInstanceId = settings?.mddAuditorTenantInstanceId ?? "";
  const fastTaskInstanceId = settings?.mddFastTaskTenantInstanceId ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fetchInstances = canPick
        ? fetchAllProviderInstances
        : fetchEnabledProviderInstances;
      const [list, aiSettings] = await Promise.all([
        fetchInstances(),
        fetchUserAISettings(),
      ]);
      setInstances(list);
      setSettings(aiSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar agentes");
    } finally {
      setLoading(false);
    }
  }, [canPick]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAuditorChange(nextId: string) {
    if (!canPick) return;
    const value = nextId === "" ? null : nextId;
    if (value === (settings?.mddAuditorTenantInstanceId ?? null)) return;
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      const updated = await updateUserAISettings({
        mddAuditorTenantInstanceId: value,
      });
      setSettings(updated);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleFastTaskChange(nextId: string) {
    if (!canPick) return;
    const value = nextId === "" ? null : nextId;
    if (value === (settings?.mddFastTaskTenantInstanceId ?? null)) return;
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      const updated = await updateUserAISettings({
        mddFastTaskTenantInstanceId: value,
      });
      setSettings(updated);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const selectedAuditor = instances.find((i) => i.id === auditorInstanceId);
  const selectedAuditorModel =
    selectedAuditor?.auditorChatModel?.trim() || selectedAuditor?.chatModel;
  const selectedFastTask = instances.find((i) => i.id === fastTaskInstanceId);
  const selectedFastTaskModel =
    selectedFastTask?.fastTaskChatModel?.trim() || selectedFastTask?.chatModel;

  return (
    <Card variant="ghost">
      <CardHeader className="border-b-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/10">
            <Bot className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <CardTitle>Agentes MDD</CardTitle>
            <CardDescription>
              Modelos dedicados para roles específicos del grafo MDD. El resto
              de agentes usan el proveedor activo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : null}
        {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

        {!loading && isDeveloper ? (
          <p className="text-sm text-[var(--foreground-muted)]">
            Los developers usan el proveedor predeterminado del equipo para todos
            los agentes.
          </p>
        ) : null}

        {!loading && !isDeveloper ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--primary)]" />
                <label
                  htmlFor="mdd-auditor-instance"
                  className="text-sm font-medium text-[var(--foreground)]"
                >
                  Auditor (revisión final)
                </label>
              </div>
              <select
                id="mdd-auditor-instance"
                disabled={!canPick || saving || instances.length === 0}
                value={auditorInstanceId}
                onChange={(e) => void handleAuditorChange(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-50"
              >
                <option value="">
                  Mismo que proveedor activo (predeterminado)
                </option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {auditorModelLabel(inst)}
                  </option>
                ))}
              </select>
              {selectedAuditor ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  {selectedAuditor.providerType}/{selectedAuditor.slug} · {selectedAuditorModel}
                  {selectedAuditor.auditorChatModel?.trim() ? " (modelo de auditor)" : ""}
                  {selectedAuditor.apiKeyHint ? ` · ${selectedAuditor.apiKeyHint}` : ""}
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground-muted)]">
                  Sin override: el Auditor comparte el runtime del proveedor marcado
                  como Activa (o el default del equipo).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--primary)]" />
                <label
                  htmlFor="mdd-fast-task-instance"
                  className="text-sm font-medium text-[var(--foreground)]"
                >
                  Tareas rápidas (cross-consistency)
                </label>
              </div>
              <select
                id="mdd-fast-task-instance"
                disabled={!canPick || saving || instances.length === 0}
                value={fastTaskInstanceId}
                onChange={(e) => void handleFastTaskChange(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-50"
              >
                <option value="">
                  Mismo que proveedor activo (predeterminado)
                </option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {fastTaskModelLabel(inst)}
                  </option>
                ))}
              </select>
              {selectedFastTask ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  {selectedFastTask.providerType}/{selectedFastTask.slug} · {selectedFastTaskModel}
                  {selectedFastTask.fastTaskChatModel?.trim() ? " (modelo rápido)" : ""}
                  {selectedFastTask.apiKeyHint ? ` · ${selectedFastTask.apiKeyHint}` : ""}
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground-muted)]">
                  Sin override: las tareas rápidas comparten el runtime del
                  proveedor activo.
                </p>
              )}
            </div>
          </>
        ) : null}

        {!loading && !isDeveloper && instances.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">
            Crea al menos una instancia de proveedor arriba para asignar
            modelos dedicados a estos agentes.
          </p>
        ) : null}

        {canPick && !loading ? (
          <div className="flex flex-wrap items-center gap-2">
            {savedFlash ? (
              <Button type="button" size="sm" disabled>
                <Check className="mr-1 h-4 w-4" />
                Guardado
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Recargar
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-[var(--foreground-subtle)]">
          Útil para usar un modelo más capaz en revisión (Opus) y uno más rápido
          en inspecciones ligeras (Haiku), mientras los agentes principales usan
          el modelo de chat. Opcional: en el modal de la instancia puedes definir
          un «Modelo de auditor» o «Modelo rápido» distinto al de chat (misma API key).
        </p>
      </CardContent>
    </Card>
  );
}
