import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "./ui";
import type { ComponentSourceProfileSummary } from "@/types/component-source-profiles";
import {
  createComponentSourceProfile,
  updateComponentSourceProfile,
} from "@/lib/component-source-profiles-api";

interface ComponentSourceProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ComponentSourceProfileSummary | null;
  onSaved: () => void | Promise<void>;
}

export function ComponentSourceProfileModal({
  open,
  onOpenChange,
  editing,
  onSaved,
}: ComponentSourceProfileModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenTouched, setTokenTouched] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setUrl(editing?.url ?? "");
    setTokenInput("");
    setTokenTouched(false);
    setTokenVisible(false);
    setError("");
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!trimmedUrl) {
      setError("La URL del MCP es obligatoria");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body: { name: string; url: string; token?: string } = {
        name: trimmedName,
        url: trimmedUrl,
      };
      if (tokenTouched && tokenInput.trim()) {
        body.token = tokenInput.trim();
      } else if (!editing && tokenInput.trim()) {
        body.token = tokenInput.trim();
      }

      if (editing) {
        await updateComponentSourceProfile(editing.id, body);
      } else {
        await createComponentSourceProfile(body);
      }
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar perfil MCP" : "Nuevo perfil MCP"}</DialogTitle>
          <DialogDescription>
            Design system MCP genérico (Streamable HTTP). Sin selector de plugin: el servidor usa
            el adaptador MCP estándar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="csp-name" className="text-sm font-medium text-[var(--foreground)]">
              Nombre
            </label>
            <Input
              id="csp-name"
              className="h-11 rounded-xl"
              placeholder="Producción IMJ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="csp-url" className="text-sm font-medium text-[var(--foreground)]">
              URL del MCP
            </label>
            <Input
              id="csp-url"
              className="h-11 rounded-xl font-mono text-sm"
              placeholder="https://tu-mcp.ejemplo.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="url"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="csp-token"
              className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"
            >
              <KeyRound className="h-4 w-4 text-[var(--foreground-muted)]" aria-hidden />
              Token
            </label>
            <div className="relative">
              <Input
                id="csp-token"
                type={tokenVisible ? "text" : "password"}
                className="h-11 rounded-xl pr-11 font-mono text-sm"
                placeholder={
                  editing?.hasToken && !tokenTouched ? "••••••••" : "token_de_acceso"
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
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--muted)]"
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
            {editing?.hasToken && !tokenTouched ? (
              <p className="text-xs text-[var(--foreground-muted)]">
                Token guardado. Déjalo en blanco para conservarlo.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {editing ? "Guardar cambios" : "Crear perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
