import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Check,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Palette,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { Button, Input } from "./ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuthField = "url" | "token";

interface ComponentSourcePluginMeta {
  id: string;
  label: string;
  description?: string;
  authFields?: AuthField[];
}

interface ComponentSourceConfig {
  enabled: boolean;
  pluginId: string;
  url: string;
  hasToken: boolean;
  plugins: ComponentSourcePluginMeta[];
}

const DEFAULT_AUTH_FIELDS: AuthField[] = ["url", "token"];

const FEATURES = [
  {
    icon: Blocks,
    title: "Componentes UI",
    desc: "Catálogo de componentes del design system",
  },
  {
    icon: PlugZap,
    title: "MCP HTTPS",
    desc: "Protocolo estándar de herramientas",
  },
  {
    icon: Palette,
    title: "Design System",
    desc: "Tokens, variantes y documentación",
  },
] as const;

export function ComponentSourceConfigCard() {
  const [config, setConfig] = useState<ComponentSourceConfig>({
    enabled: false,
    pluginId: "",
    url: "",
    hasToken: false,
    plugins: [],
  });
  const [initial, setInitial] = useState<ComponentSourceConfig>({
    enabled: false,
    pluginId: "",
    url: "",
    hasToken: false,
    plugins: [],
  });
  const [tokenInput, setTokenInput] = useState("");
  const [tokenTouched, setTokenTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);

  const activePlugin = useMemo(() => {
    const id = config.pluginId.trim();
    if (!id) return null;
    return config.plugins.find((p) => p.id === id) ?? null;
  }, [config.pluginId, config.plugins]);

  const authFields = activePlugin?.authFields?.length
    ? activePlugin.authFields
    : DEFAULT_AUTH_FIELDS;

  const showUrlField = authFields.includes("url");
  const showTokenField = authFields.includes("token");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.get("/api/auth/component-source/config");
      if (!res.ok) throw new Error("No se pudo obtener la configuración");
      const data = (await res.json()) as ComponentSourceConfig;
      setConfig(data);
      setInitial(data);
      setTokenInput("");
      setTokenTouched(false);
    } catch {
      setError("Error al cargar configuración de la fuente de componentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const hasChanges =
    config.enabled !== initial.enabled ||
    config.pluginId !== initial.pluginId ||
    config.url !== initial.url ||
    tokenTouched;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = {
        enabled: config.enabled,
        pluginId: config.pluginId || undefined,
        url: config.url || undefined,
      };
      if (tokenTouched) body.token = tokenInput || undefined;
      const res = await api.put("/api/auth/component-source/config", body);
      if (!res.ok) throw new Error("Error al guardar");
      const data = (await res.json()) as ComponentSourceConfig;
      setConfig(data);
      setInitial(data);
      setTokenInput("");
      setTokenTouched(false);
      setSuccess("Configuración guardada");
      window.setTimeout(() => setSuccess(""), 3200);
    } catch {
      setError("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = {
        pluginId: config.pluginId.trim() || undefined,
        url: config.url.trim() || undefined,
      };
      if (tokenTouched) {
        if (tokenInput.trim()) body.token = tokenInput.trim();
      } else if (config.hasToken) {
        body.useSaved = true;
      } else if (tokenInput.trim()) {
        body.token = tokenInput.trim();
      }
      const res = await api.post("/api/admin/component-source/test", body);
      const data = (await res.json()) as { ok?: boolean; error?: string; service?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Conexión fallida");
      const serviceHint = data.service ? ` (${data.service})` : "";
      setSuccess(`Conexión exitosa con la fuente de componentes${serviceHint}`);
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al probar conexión");
    } finally {
      setTesting(false);
    }
  };

  const handlePluginChange = (pluginId: string) => {
    setConfig((c) => ({ ...c, pluginId }));
  };

  const canTestConnection =
    showUrlField && config.url.trim().length > 0 && (!showTokenField || config.hasToken || tokenInput.trim());

  return (
    <section className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
            Fuente de componentes
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
            Conecta TheForge con un servidor MCP de componentes para importar el catálogo de tu
            design system en la generación de wireframes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 gap-2 rounded-xl max-sm:w-full"
          disabled={loading}
          onClick={() => void fetchConfig()}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          Recargar
        </Button>
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
          Cargando configuración…
        </div>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          <div className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)]">
                <Blocks className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                  Conexión MCP
                </h3>
                <p className="mt-0.5 text-sm text-[var(--foreground-muted)]">
                  Plugin, URL y credenciales del servidor de componentes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--foreground)]">Activar</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.enabled}
                  aria-label="Activar fuente de componentes"
                  onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
                    config.enabled
                      ? "bg-[var(--primary)]"
                      : "bg-[color-mix(in_oklch,var(--muted-foreground)_25%,var(--border))]",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      config.enabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {config.plugins.length === 0 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                Ningún plugin registrado en el servidor. Puedes indicar un identificador manual
                hasta que el administrador registre plugins.
              </p>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="component-source-plugin"
                className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"
              >
                <Blocks className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                Plugin
              </label>
              {config.plugins.length > 0 ? (
                <select
                  id="component-source-plugin"
                  className="flex h-11 w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--input))] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  value={config.pluginId}
                  onChange={(e) => handlePluginChange(e.target.value)}
                >
                  <option value="">Selecciona un plugin…</option>
                  {!config.plugins.some((p) => p.id === config.pluginId) && config.pluginId ? (
                    <option value={config.pluginId}>{config.pluginId}</option>
                  ) : null}
                  {config.plugins.map((plugin) => (
                    <option key={plugin.id} value={plugin.id}>
                      {plugin.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="component-source-plugin"
                  className="h-11 rounded-xl border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--input))] text-sm"
                  placeholder="component-source-plugin-id"
                  value={config.pluginId}
                  onChange={(e) => handlePluginChange(e.target.value)}
                  autoComplete="off"
                />
              )}
              {activePlugin?.description ? (
                <p className="text-xs text-[var(--foreground-muted)]">{activePlugin.description}</p>
              ) : null}
            </div>

            {showUrlField ? (
              <div className="space-y-2">
                <label
                  htmlFor="component-source-url"
                  className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"
                >
                  <Globe className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                  URL del MCP
                </label>
                <Input
                  id="component-source-url"
                  className="h-11 rounded-xl border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--input))] font-mono text-sm"
                  placeholder="https://tu-mcp.ejemplo.com/mcp"
                  value={config.url}
                  onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                  autoComplete="url"
                />
              </div>
            ) : null}

            {showTokenField ? (
              <div className="space-y-2">
                <label
                  htmlFor="component-source-token"
                  className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"
                >
                  <KeyRound className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
                  Token
                </label>
                <div className="relative">
                  <Input
                    id="component-source-token"
                    type={tokenVisible ? "text" : "password"}
                    className="h-11 rounded-xl border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--input))] pr-11 font-mono text-sm"
                    placeholder={
                      config.hasToken && !tokenTouched ? "••••••••" : "token_de_acceso"
                    }
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setTokenTouched(true);
                    }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    onClick={() => setTokenVisible((v) => !v)}
                    aria-label={tokenVisible ? "Ocultar token" : "Mostrar token"}
                  >
                    {tokenVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                {config.hasToken && !tokenTouched ? (
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Token guardado. Déjalo en blanco para conservarlo o escribe uno nuevo para
                    rotarlo.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                size="sm"
                className="h-11 w-full gap-2 rounded-xl sm:w-auto"
                onClick={() => void handleSave()}
                loading={saving}
                disabled={saving || !hasChanges}
              >
                {!saving ? <Check className="h-4 w-4" aria-hidden /> : null}
                {hasChanges ? "Guardar cambios" : "Sin cambios"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 w-full gap-2 rounded-xl sm:w-auto"
                onClick={() => void handleTestConnection()}
                loading={testing}
                disabled={testing || !canTestConnection}
              >
                {!testing ? <PlugZap className="h-4 w-4" aria-hidden /> : null}
                Probar conexión
              </Button>
            </div>
          </div>
        </article>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] px-4 py-3.5 sm:px-5">
        <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
          <span className="font-medium text-[var(--foreground)]">Importante:</span> las credenciales
          son exclusivas del servidor MCP de componentes. No las compartas ni las reutilices en
          otros servicios.
        </p>
      </div>
    </section>
  );
}
