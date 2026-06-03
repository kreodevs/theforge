import { useCallback, useEffect, useState } from "react";
import {
  Blocks,
  CheckCircle2,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";
import { CapabilityStatusBox } from "@/components/CapabilityStatusBox";
import { ComponentSourceProfileModal } from "@/components/ComponentSourceProfileModal";
import {
  confirmComponentSourceProfileMapping,
  deleteComponentSourceProfile,
  fetchComponentSourceProfiles,
  formatProfileInUseError,
  testComponentSourceProfile,
} from "@/lib/component-source-profiles-api";
import type {
  ComponentSourceProfileSummary,
  ComponentSourceProfileTestResult,
  ComponentSourceProposedToolMapping,
} from "@/types/component-source-profiles";
import { formatProposedMappingSummary } from "@/types/component-source-profiles";

const FEATURES = [
  {
    icon: Blocks,
    title: "Componentes UI",
    desc: "Catálogo del design system vía MCP",
  },
  {
    icon: PlugZap,
    title: "Perfiles reutilizables",
    desc: "Varias conexiones MCP por usuario",
  },
  {
    icon: Blocks,
    title: "Por proyecto",
    desc: "El owner elige el perfil en el taller",
  },
] as const;

interface PendingMappingState {
  proposedMapping: ComponentSourceProposedToolMapping;
  capabilities?: ComponentSourceProfileSummary["capabilities"];
}

export function ComponentSourceConfigCard() {
  const [profiles, setProfiles] = useState<ComponentSourceProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComponentSourceProfileSummary | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingMappings, setPendingMappings] = useState<Record<string, PendingMappingState>>({});
  const [healthOkId, setHealthOkId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const list = await fetchComponentSourceProfiles();
      setProfiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar perfiles MCP");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function clearProfileFeedback(profileId: string) {
    setPendingMappings((prev) => {
      if (!prev[profileId]) return prev;
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
    if (healthOkId === profileId) setHealthOkId(null);
  }

  async function handleTest(profile: ComponentSourceProfileSummary) {
    setTestingId(profile.id);
    setError("");
    setSuccess("");
    clearProfileFeedback(profile.id);
    try {
      const result: ComponentSourceProfileTestResult = await testComponentSourceProfile(profile.id, {
        useSaved: true,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      if (result.mode === "mapping") {
        setPendingMappings((prev) => ({
          ...prev,
          [profile.id]: {
            proposedMapping: result.proposedMapping,
            capabilities: result.capabilities,
          },
        }));
        setSuccess(
          `Conexión OK. Revisa el mapeo propuesto para «${profile.name}» y confírmalo para activar wireframes.`,
        );
      } else {
        setHealthOkId(profile.id);
        const hint = result.service ? ` (${result.service})` : "";
        setSuccess(`Conexión OK con «${profile.name}»${hint}`);
        window.setTimeout(() => setHealthOkId((id) => (id === profile.id ? null : id)), 5000);
      }
      window.setTimeout(() => setSuccess(""), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al probar conexión");
    } finally {
      setTestingId(null);
    }
  }

  async function handleConfirmMapping(profile: ComponentSourceProfileSummary) {
    const pending = pendingMappings[profile.id];
    if (!pending) return;
    setConfirmingId(profile.id);
    setError("");
    setSuccess("");
    try {
      await confirmComponentSourceProfileMapping(profile.id, {
        toolMapping: pending.proposedMapping,
      });
      setSuccess(`Mapeo confirmado para «${profile.name}». Capacidades actualizadas.`);
      clearProfileFeedback(profile.id);
      window.setTimeout(() => setSuccess(""), 5000);
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar el mapeo");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDelete(profile: ComponentSourceProfileSummary) {
    if (!window.confirm(`¿Eliminar el perfil «${profile.name}»?`)) return;
    setDeletingId(profile.id);
    setError("");
    setSuccess("");
    try {
      await deleteComponentSourceProfile(profile.id);
      clearProfileFeedback(profile.id);
      setSuccess("Perfil eliminado");
      window.setTimeout(() => setSuccess(""), 3200);
      await loadProfiles();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo eliminar";
      setError(formatProfileInUseError(msg));
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(profile: ComponentSourceProfileSummary) {
    setEditing(profile);
    setModalOpen(true);
  }

  return (
    <section className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
            Perfiles MCP de componentes
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Guarda conexiones al design system MCP (nombre, URL, token). En el taller, el owner del
            proyecto elige qué perfil usar — no hay perfil predeterminado.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl max-sm:w-full"
            disabled={loading}
            onClick={() => void loadProfiles()}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            Recargar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 gap-2 rounded-xl max-sm:w-full"
            disabled={loading}
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo perfil
          </Button>
        </div>
      </div>

      {!loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 sm:rounded-xl"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)]">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[var(--foreground)]">{title}</span>
                <span className="block text-[11px] leading-snug text-[var(--foreground-muted)]">
                  {desc}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-2xl border border-[var(--success)]/30 bg-[color-mix(in_oklch,var(--success)_12%,var(--card))] px-4 py-3 text-sm text-[color-mix(in_oklch,var(--success)_88%,var(--foreground))]">
          {success}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-14 text-sm text-[var(--foreground-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando perfiles…
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] px-6 py-10 text-center">
          <p className="text-sm text-[var(--foreground-muted)]">
            No hay perfiles MCP. Crea uno para conectar el design system y selecciónalo en el taller.
          </p>
          <Button type="button" className="mt-4 gap-2 rounded-xl" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo perfil
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {profiles.map((profile) => {
            const pending = pendingMappings[profile.id];
            const mappingRows = pending ? formatProposedMappingSummary(pending.proposedMapping) : [];
            const mappingPending = !profile.mappingConfirmedAt;

            return (
              <li
                key={profile.id}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
              >
                <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{profile.name}</h3>
                    <p className="mt-0.5 truncate font-mono text-xs text-[var(--foreground-muted)]">
                      {profile.url}
                    </p>
                    {typeof profile.projectCount === "number" && profile.projectCount > 0 ? (
                      <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                        En uso en {profile.projectCount} proyecto
                        {profile.projectCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl"
                      loading={testingId === profile.id}
                      disabled={testingId === profile.id || !profile.url.trim()}
                      onClick={() => void handleTest(profile)}
                    >
                      <PlugZap className="h-3.5 w-3.5" aria-hidden />
                      Probar conexión
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl"
                      onClick={() => openEdit(profile)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                      loading={deletingId === profile.id}
                      disabled={deletingId === profile.id}
                      onClick={() => void handleDelete(profile)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Eliminar
                    </Button>
                  </div>
                </div>

                {healthOkId === profile.id && !pending ? (
                  <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--success)_10%,var(--card))] px-4 py-2.5 text-sm text-[color-mix(in_oklch,var(--success)_85%,var(--foreground))] sm:px-5">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    Conexión OK — el servidor MCP respondió correctamente.
                  </div>
                ) : null}

                {pending ? (
                  <div className="space-y-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--amber-500)_8%,var(--card))] px-4 py-4 sm:px-5">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Mapeo propuesto de herramientas
                      </p>
                      <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                        Revisa cómo se mapean los roles internos a las herramientas del MCP remoto.
                        Confirma para persistir capacidades y habilitar wireframes en proyectos que usen
                        este perfil.
                      </p>
                    </div>
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
                      {mappingRows.map((row) => (
                        <li
                          key={row.role}
                          className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-medium text-[var(--foreground)]">{row.role}</span>
                          <span className="font-mono text-[var(--foreground-muted)]">{row.toolName}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl"
                      loading={confirmingId === profile.id}
                      disabled={confirmingId === profile.id}
                      onClick={() => void handleConfirmMapping(profile)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Confirmar mapeo
                    </Button>
                  </div>
                ) : null}

                <div className="p-4 sm:p-5">
                  <CapabilityStatusBox
                    capabilities={pending?.capabilities ?? profile.capabilities}
                    mappingPending={mappingPending && !pending}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] px-4 py-3.5 sm:px-5">
        <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
          <span className="font-medium text-[var(--foreground)]">Importante:</span> las credenciales
          son exclusivas del servidor MCP de componentes. No las compartas ni las reutilices en otros
          servicios.
        </p>
      </div>

      <ComponentSourceProfileModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        onSaved={() => void loadProfiles()}
      />
    </section>
  );
}
