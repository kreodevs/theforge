import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  PlugZap,
  Power,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge, Button, Input } from "./ui";
import { getStoredUser } from "@/utils/apiClient";
import { cn } from "@/lib/utils";
import type { UiMcpInstanceSummary } from "@/types/ui-mcp";
import {
  activateUiMcpInstance,
  createUiMcpInstance,
  deleteUiMcpInstance,
  detectUiMcpInstance,
  fetchUiMcpInstances,
  updateUiMcpInstance,
} from "@/lib/ui-mcp-api";

function canManage(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}

interface DraftForm {
  id: string | null;
  displayName: string;
  url: string;
  token: string;
}

const EMPTY_DRAFT: DraftForm = { id: null, displayName: "", url: "", token: "" };

/** Sección de Ajustes "MCP gráfico": instancias team-wide de MCPs de componentes UI. */
export function UiMcpInstancesCard() {
  const role = getStoredUser()?.role;
  const manage = canManage(role);

  const [instances, setInstances] = useState<UiMcpInstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInstances(await fetchUiMcpInstances());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar instancias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(""), 3500);
  };

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (inst: UiMcpInstanceSummary) => {
    setDraft({ id: inst.id, displayName: inst.displayName, url: inst.url, token: "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        displayName: draft.displayName.trim(),
        url: draft.url.trim(),
        token: draft.token.trim() || undefined,
      };
      if (draft.id) {
        await updateUiMcpInstance(draft.id, body);
        flashSuccess("Instancia actualizada");
      } else {
        await createUiMcpInstance(body);
        flashSuccess("Instancia creada");
      }
      setFormOpen(false);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la instancia");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (inst: UiMcpInstanceSummary) => {
    setBusyId(inst.id);
    setError("");
    try {
      await activateUiMcpInstance(inst.id, !inst.isActive);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la activación");
    } finally {
      setBusyId(null);
    }
  };

  const handleDetect = async (inst: UiMcpInstanceSummary) => {
    setBusyId(inst.id);
    setError("");
    try {
      const res = await detectUiMcpInstance(inst.id);
      if (res.detection.compatible) {
        flashSuccess(
          `Compatible: ${res.libraryName ?? "librería"} ${res.libraryVersion ?? ""} (contrato ${res.contractVersion ?? "?"})`,
        );
      } else {
        setError(
          res.detection.error
            ? `No compatible: ${res.detection.error}`
            : res.detection.missingTools.length
              ? `No compatible: faltan tools ${res.detection.missingTools.join(", ")}`
              : "No compatible: el contrato no fue reconocido",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo detectar compatibilidad");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (inst: UiMcpInstanceSummary) => {
    if (!window.confirm(`¿Eliminar la instancia "${inst.displayName}"?`)) return;
    setBusyId(inst.id);
    setError("");
    try {
      await deleteUiMcpInstance(inst.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  if (!manage) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
          MCP gráfico
        </h2>
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] px-6 py-10 text-center text-sm text-[var(--foreground-muted)]">
          Solo administradores pueden configurar el MCP gráfico de componentes UI.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
            MCP gráfico
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Conecta MCPs de componentes UI. The Forge detecta si son compatibles con su contrato y,
            cuando activas uno compatible, lo usa para reemplazar componentes genéricos por reales en
            las secciones UI/UX y habilitar el deliverable "Pantallas". Sin MCP compatible activo, se
            mantiene la generación heurística actual.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 max-sm:w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl max-sm:flex-1"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            Recargar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 gap-2 rounded-xl max-sm:flex-1"
            disabled={loading}
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar
          </Button>
        </div>
      </div>

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

      {formOpen ? (
        <article className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {draft.id ? "Editar instancia" : "Nueva instancia"}
          </h3>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Nombre</label>
            <Input
              className="h-11 rounded-xl"
              placeholder="Design System UI MCP"
              value={draft.displayName}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <Globe className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
              URL del MCP
            </label>
            <Input
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="https://tu-mcp.ejemplo.com/mcp"
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              autoComplete="url"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <KeyRound className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
              Token M2M (opcional)
            </label>
            <Input
              type="password"
              className="h-11 rounded-xl font-mono text-sm"
              placeholder={draft.id ? "Dejar vacío para conservar el actual" : "opcional"}
              value={draft.token}
              onChange={(e) => setDraft((d) => ({ ...d, token: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="h-11 gap-2 rounded-xl sm:w-auto"
              loading={saving}
              disabled={saving || !draft.displayName.trim() || !draft.url.trim()}
              onClick={() => void handleSave()}
            >
              {!saving ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 rounded-xl sm:w-auto"
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                setDraft(EMPTY_DRAFT);
              }}
            >
              Cancelar
            </Button>
          </div>
        </article>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--foreground-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando instancias…
        </div>
      ) : instances.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] px-6 py-10 text-center">
          <p className="text-sm text-[var(--foreground-muted)]">
            No hay instancias de MCP gráfico. Agrega la primera con el botón de arriba.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {instances.map((inst) => {
            const busy = busyId === inst.id;
            return (
              <li
                key={inst.id}
                className={cn(
                  "rounded-2xl border bg-[var(--card)] p-4 sm:p-5",
                  inst.isActive
                    ? "border-[color-mix(in_oklch,var(--primary)_45%,var(--border))]"
                    : "border-[var(--border)]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {inst.displayName}
                      </span>
                      {inst.isActive ? (
                        <Badge variant="default" className="gap-1">
                          <Power className="h-3 w-3" aria-hidden />
                          Activa
                        </Badge>
                      ) : null}
                      {inst.compatible ? (
                        <Badge variant="secondary" className="gap-1 text-[var(--success)]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Compatible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[var(--foreground-muted)]">
                          <XCircle className="h-3 w-3" aria-hidden />
                          No compatible
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-[var(--foreground-muted)]">
                      {inst.url}
                    </p>
                    {inst.compatible && inst.libraryName ? (
                      <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                        {inst.libraryName} {inst.libraryVersion ?? ""} · contrato{" "}
                        {inst.contractVersion ?? "?"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg"
                      disabled={busy}
                      onClick={() => void handleDetect(inst)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <PlugZap className="h-4 w-4" aria-hidden />
                      )}
                      Detectar
                    </Button>
                    <Button
                      type="button"
                      variant={inst.isActive ? "outline" : "default"}
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg"
                      disabled={busy || (!inst.compatible && !inst.isActive)}
                      title={
                        !inst.compatible && !inst.isActive
                          ? "Solo puedes activar instancias compatibles"
                          : undefined
                      }
                      onClick={() => void handleActivate(inst)}
                    >
                      <Power className="h-4 w-4" aria-hidden />
                      {inst.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 rounded-lg p-0"
                      disabled={busy}
                      aria-label="Editar"
                      onClick={() => openEdit(inst)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 rounded-lg p-0 text-[var(--destructive)]"
                      disabled={busy}
                      aria-label="Eliminar"
                      onClick={() => void handleDelete(inst)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
