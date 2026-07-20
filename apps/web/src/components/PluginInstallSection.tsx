import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Package,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { PluginInstalledListResponse } from "@theforge/shared-types";
import { getStoredUser } from "@/utils/apiClient";
import {
  clearPluginArtifactsCache,
  fetchInstalledPlugins,
  installPluginFromFile,
  installPluginFromLicense,
  reloadPlugins,
  uninstallPlugin,
} from "@/utils/pluginApi";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";

function canManagePlugins(role: string | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** Instalación y estado de plugins (.tfplugin) — solo administradores gestionan. */
export function PluginInstallSection() {
  const role = getStoredUser()?.role;
  const isManager = canManagePlugins(role);

  const [status, setStatus] = useState<PluginInstalledListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [pluginId, setPluginId] = useState("com.kreodevs.evd");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchInstalledPlugins();
      setStatus(data);
    } catch {
      setError("No se pudo cargar el estado de plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(""), 4000);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !isManager) return;
    setBusy(true);
    setError("");
    try {
      const result = await installPluginFromFile(file);
      clearPluginArtifactsCache();
      await refresh();
      flashSuccess(`${result.name} v${result.version} instalado`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al instalar");
    } finally {
      setBusy(false);
    }
  };

  const handleLicenseInstall = async () => {
    if (!isManager || !licenseKey.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await installPluginFromLicense(licenseKey.trim(), pluginId.trim() || undefined);
      clearPluginArtifactsCache();
      await refresh();
      flashSuccess(`${result.name} instalado desde licencia`);
      setLicenseKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error con la licencia");
    } finally {
      setBusy(false);
    }
  };

  const handleReload = async () => {
    if (!isManager) return;
    setBusy(true);
    setError("");
    try {
      await reloadPlugins();
      clearPluginArtifactsCache();
      await refresh();
      flashSuccess("Plugins recargados");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al recargar");
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!isManager) return;
    if (!window.confirm(`¿Desinstalar ${id}?`)) return;
    setBusy(true);
    setError("");
    try {
      await uninstallPlugin(id);
      clearPluginArtifactsCache();
      await refresh();
      flashSuccess("Plugin desinstalado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desinstalar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-[var(--border)] bg-[var(--card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-[var(--primary)]" />
          Instalación de plugins
        </CardTitle>
        <CardDescription>
          Paquetes <code className="text-xs">.tfplugin</code> (ZIP + manifest). Core{" "}
          {status?.coreVersion ?? "…"} — directorio{" "}
          <span className="font-mono text-xs">{status?.pluginsDirectory ?? "…"}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando estado…
          </div>
        ) : null}

        {status ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
            <p>
              <strong>{status.health.loaded}</strong> plugin(s) cargado(s) ·{" "}
              <strong>{status.installed.length}</strong> instalado(s) en disco ·{" "}
              <strong>{status.health.artifactCount}</strong> artifact(s)
            </p>
          </div>
        ) : null}

        {status?.installed.length ? (
          <ul className="space-y-2">
            {status.installed.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {p.loaded ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="font-mono text-xs text-[var(--foreground-muted)]">
                      {p.id} · v{p.version}
                      {p.loaded ? " · cargado" : " · en disco, no cargado"}
                    </p>
                  </div>
                </div>
                {isManager ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleUninstall(p.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Quitar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--foreground-muted)]">
            No hay plugins instalados en el servidor. Sube un paquete .tfplugin o activa con licencia
            (p. ej. EVD).
          </p>
        )}

        {isManager ? (
          <div className="space-y-4 border-t border-[var(--border)] pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="plugin-tfplugin-upload"
                type="file"
                accept=".tfplugin,.zip,application/zip"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void handleFile(f);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => document.getElementById("plugin-tfplugin-upload")?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir .tfplugin
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void handleReload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recargar
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Instalar con licencia (portal)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Plugin id (ej. com.kreodevs.evd)"
                  value={pluginId}
                  onChange={(e) => setPluginId(e.target.value)}
                  className="font-mono text-xs sm:flex-1"
                />
                <Input
                  type="password"
                  placeholder="Clave de licencia (tk_…)"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="font-mono text-xs sm:flex-[2]"
                />
                <Button
                  type="button"
                  disabled={busy || !licenseKey.trim()}
                  onClick={() => void handleLicenseInstall()}
                >
                  Instalar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-muted)]">
            Solo administradores pueden instalar o desinstalar plugins.
          </p>
        )}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
      </CardContent>
    </Card>
  );
}
