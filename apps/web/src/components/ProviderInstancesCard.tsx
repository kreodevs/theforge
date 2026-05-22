import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui";
import { ListAddButton } from "./ListAddButton";
import { ListRowIconButton } from "./ListRowIconButton";
import { getProviderIcon } from "@/constants/provider-icons";
import { getStoredUser } from "@/utils/apiClient";
import type { ProviderInstanceSummary, UserAISettings } from "@/types/user-providers";
import {
  deleteProviderInstance,
  fetchAllProviderInstances,
  fetchEnabledProviderInstances,
  updateProviderInstance,
} from "@/lib/provider-instances-api";
import { fetchUserAISettings, updateUserAISettings } from "@/lib/user-providers-api";
import { ProviderInstanceModal } from "./ProviderInstanceModal";
import { cn } from "@/lib/utils";

function canManageInstances(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}

export function ProviderInstancesCard() {
  const user = getStoredUser();
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isDeveloper = role === "developer";
  const canManage = canManageInstances(role);

  const [instances, setInstances] = useState<ProviderInstanceSummary[]>([]);
  const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderInstanceSummary | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const activeInstanceId = userSettings?.activeTenantInstanceId ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const settingsPromise = fetchUserAISettings();
      const fetchInstances = canManage
        ? fetchAllProviderInstances
        : fetchEnabledProviderInstances;
      const [list, settings] = await Promise.all([fetchInstances(), settingsPromise]);
      setInstances(list);
      setUserSettings(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar instancias");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleVisibleForTeam(inst: ProviderInstanceSummary) {
    if (!isSuperAdmin) return;
    const next = !inst.enabledForUsers;
    setTogglingId(inst.id);
    setError("");
    setInstances((prev) =>
      prev.map((i) => (i.id === inst.id ? { ...i, enabledForUsers: next } : i)),
    );
    try {
      const updated = await updateProviderInstance(inst.id, {
        providerType: inst.providerType,
        slug: inst.slug,
        displayName: inst.displayName,
        chatModel: inst.chatModel,
        chatModelFallbacks: inst.chatModelFallbacks,
        auditorChatModel: inst.auditorChatModel,
        embeddingModel: inst.embeddingModel,
        embeddingDimension: inst.embeddingDimension,
        sttModel: inst.sttModel,
        visionModel: inst.visionModel,
        baseUrl: inst.baseUrl,
        extras: inst.extras ?? null,
        enabledForUsers: next,
        isTenantDefault: next ? inst.isTenantDefault : false,
      });
      setInstances((prev) => prev.map((i) => (i.id === inst.id ? updated : i)));
    } catch (e) {
      setInstances((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, enabledForUsers: !next } : i)),
      );
      setError(e instanceof Error ? e.message : "No se pudo actualizar la visibilidad");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSetActive(inst: ProviderInstanceSummary) {
    setActivatingId(inst.id);
    setError("");
    try {
      const settings = await updateUserAISettings({ activeTenantInstanceId: inst.id });
      setUserSettings(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como activa");
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta instancia de proveedor?")) return;
    try {
      await deleteProviderInstance(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  const description = canManage
    ? isSuperAdmin
      ? "Crea proveedores para el equipo (visibles con el interruptor) o personales. Los administradores ven los del equipo y pueden crear los suyos."
      : "Proveedores del equipo (solo lectura) y los personales que crees. Marca cualquiera como Activa (Usar); el default del equipo solo aplica si no eliges ninguno."
    : isDeveloper
      ? "Usas el proveedor predeterminado del equipo configurado por el super_admin. No puedes cambiarlo aquí."
      : "Marca uno como Activa (Usar). Si no eliges ninguno, se usa el predeterminado del equipo.";

  function canMutateInstance(inst: ProviderInstanceSummary) {
    if (!canManage) return false;
    if (isSuperAdmin) return true;
    return inst.createdByUserId === user?.id;
  }

  function openCreateModal() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <>
      <Card variant="ghost">
        <CardHeader className="border-b-0">
          <CardTitle>Gestionar instancias</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-0 flex-1 space-y-4 py-2">
            {canManage ? (
              <ListAddButton
                icon={Plus}
                label="Agregar instancia"
                onClick={openCreateModal}
                disabled={loading}
              />
            ) : null}

            {error ? (
              <p className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                {error}
              </p>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[var(--foreground-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando instancias…
              </div>
            ) : instances.length === 0 ? (
              <p className="py-2 text-sm text-[var(--foreground-muted)]">
                {canManage
                  ? "No hay instancias. Crea la primera con el botón de arriba."
                  : "No hay instancias disponibles. Pide a un administrador que configure una."}
              </p>
            ) : (
              instances.map((inst) => {
                const Icon = getProviderIcon(inst.providerType);
                const isActive = activeInstanceId === inst.id;
                return (
                  <div
                    key={inst.id}
                    className={cn(
                      "rounded-lg border border-[var(--border)]",
                      isActive && "border-[var(--primary)]/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {inst.displayName}
                          </p>
                          <p className="truncate text-xs text-[var(--foreground-muted)]">
                            {inst.chatModel}
                          </p>
                          {isSuperAdmin && canManage ? (
                            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground-muted)]">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={inst.enabledForUsers}
                                aria-label="Visible para el equipo"
                                disabled={togglingId === inst.id}
                                onClick={() => void handleToggleVisibleForTeam(inst)}
                                className={cn(
                                  "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50",
                                  inst.enabledForUsers
                                    ? "bg-[var(--primary)]"
                                    : "bg-[color-mix(in_oklch,var(--muted-foreground)_25%,var(--border))]",
                                )}
                              >
                                <span
                                  className={cn(
                                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                                    inst.enabledForUsers ? "translate-x-4" : "translate-x-0",
                                  )}
                                />
                              </button>
                              <span className="select-none">Visible para el equipo</span>
                              {togglingId === inst.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                              ) : null}
                            </label>
                          ) : null}
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {!isDeveloper ? (
                          <Button
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            disabled={isActive || activatingId === inst.id}
                            onClick={() => void handleSetActive(inst)}
                          >
                            {activatingId === inst.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4" />
                            )}
                            {isActive ? "Activa" : "Usar"}
                          </Button>
                        ) : isActive ? (
                          <span className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 text-sm font-medium text-[var(--foreground)]">
                            Predeterminado
                          </span>
                        ) : null}
                        {canMutateInstance(inst) ? (
                          <>
                            <ListRowIconButton
                              aria-label="Editar"
                              onClick={() => {
                                setEditing(inst);
                                setModalOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </ListRowIconButton>
                            <ListRowIconButton
                              aria-label="Eliminar"
                              onClick={() => void handleDelete(inst.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ListRowIconButton>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
      {canManage ? (
        <ProviderInstanceModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editing={editing}
          existingInstances={instances}
          isSuperAdmin={isSuperAdmin}
          activeInstanceId={activeInstanceId}
          userSettings={userSettings}
          onSaved={() => void load()}
        />
      ) : null}
    </>
  );
}
