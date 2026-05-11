import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui";
import { Cable, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export function AriadneConfigCard() {
  const [url, setUrl] = useState("");
  const [initialUrl, setInitialUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/auth/ariadne-config");
      if (!res.ok) throw new Error("No se pudo obtener la configuración");
      const data: { url: string } = await res.json();
      setUrl(data.url ?? "");
      setInitialUrl(data.url ?? "");
    } catch {
      setError("Error al cargar configuración de Ariadne");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const hasChanges = url !== initialUrl;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.put("/api/auth/ariadne-config", { url: url || undefined });
      if (!res.ok) throw new Error("Error al guardar");
      setInitialUrl(url);
      setSuccess("URL guardada correctamente");
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
      // Obtener el mcpSecret del usuario para probar la conexión
      const secretRes = await api.get("/api/auth/mcp-secret");
      if (!secretRes.ok) throw new Error("No se pudo obtener el token MCP");
      const { mcpSecret } = await secretRes.json();

      const res = await api.post("/api/admin/ariadne-config/test", {
        url,
        token: mcpSecret,
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(data.error ?? "Conexión fallida");
      setSuccess("Conexión exitosa con Ariadne MCP");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al probar conexión");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/10">
            <Cable className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <CardTitle>Base de conocimientos Ariadne</CardTitle>
            <CardDescription>
              Configura la URL del MCP de Ariadne para importar proyectos
              existentes como base de conocimiento. El token se obtiene
              automáticamente de tu Secret MCP.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--foreground-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando configuración…
          </div>
        ) : (
          <div className="space-y-4">
            {success && (
              <div className="rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
                {success}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            )}

            {/* URL */}
            <div className="space-y-1.5">
              <label
                htmlFor="ariadne-url"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                URL del MCP
              </label>
              <input
                id="ariadne-url"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="https://ariadne.kreoint.mx/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={saving || !hasChanges}
              >
                {saving ? "Guardando…" : <Check className="h-4 w-4" />}
                {hasChanges ? "Guardar cambios" : "Guardado"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                loading={testing}
                disabled={testing || !url}
              >
                {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                Probar conexión
              </Button>
            </div>

            <p className="text-xs text-[var(--foreground-muted)]">
              La URL debe apuntar al MCP de AriadneSpecs. El token de
              autenticación se toma automáticamente de tu{" "}
              <strong>Secret MCP</strong> (panel superior). Sin esta URL, los
              proyectos de Ariadne no podrán importarse.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
