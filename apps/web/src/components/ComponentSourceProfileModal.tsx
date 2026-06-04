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
import type {
  ComponentSourceProfileSummary,
  ComponentSourceTransportType,
} from "@/types/component-source-profiles";
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

function parseArgsText(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatArgsForInput(args: string[] | null | undefined): string {
  if (!args?.length) return "";
  return args.join("\n");
}

export function ComponentSourceProfileModal({
  open,
  onOpenChange,
  editing,
  onSaved,
}: ComponentSourceProfileModalProps) {
  const [name, setName] = useState("");
  const [transportType, setTransportType] = useState<ComponentSourceTransportType>("http");
  const [url, setUrl] = useState("");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [cwd, setCwd] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenTouched, setTokenTouched] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const isStdio = editing?.transportType === "stdio";
    setName(editing?.name ?? "");
    setTransportType(isStdio ? "stdio" : "http");
    setUrl(editing?.url ?? "");
    setCommand(editing?.command ?? "");
    setArgsText(formatArgsForInput(Array.isArray(editing?.args) ? editing.args : null));
    setCwd(editing?.cwd ?? "");
    setTokenInput("");
    setTokenTouched(false);
    setTokenVisible(false);
    setError("");
  }, [open, editing]);

  function applyShadcnPreset() {
    setTransportType("stdio");
    setCommand("npx");
    setArgsText("shadcn@latest\nmcp");
    setUrl("");
    setCwd("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }

    if (transportType === "http" && !url.trim()) {
      setError("La URL del MCP es obligatoria");
      return;
    }
    if (transportType === "stdio" && !command.trim()) {
      setError("El command es obligatorio para MCP stdio");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body: Parameters<typeof createComponentSourceProfile>[0] = {
        name: trimmedName,
        transportType,
      };

      if (transportType === "http") {
        body.url = url.trim();
        if (tokenTouched && tokenInput.trim()) {
          body.token = tokenInput.trim();
        } else if (!editing && tokenInput.trim()) {
          body.token = tokenInput.trim();
        }
      } else {
        body.command = command.trim();
        body.args = parseArgsText(argsText);
        if (cwd.trim()) body.cwd = cwd.trim();
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
            Conecta un design system vía HTTP remoto o MCP stdio local (p. ej. shadcn/ui).
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
            <span className="text-sm font-medium text-[var(--foreground)]">Transporte</span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={transportType === "http" ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setTransportType("http")}
              >
                HTTP (URL)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={transportType === "stdio" ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setTransportType("stdio")}
              >
                Stdio (local)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={applyShadcnPreset}
              >
                Preset shadcn
              </Button>
            </div>
          </div>

          {transportType === "http" ? (
            <>
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
                  Token{" "}
                  <span className="font-normal text-[var(--foreground-muted)]">(opcional)</span>
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
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="csp-command" className="text-sm font-medium text-[var(--foreground)]">
                  Command
                </label>
                <Input
                  id="csp-command"
                  className="h-11 rounded-xl font-mono text-sm"
                  placeholder="npx"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="csp-args" className="text-sm font-medium text-[var(--foreground)]">
                  Args (uno por línea)
                </label>
                <textarea
                  id="csp-args"
                  className="min-h-[88px] w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
                  placeholder={"shadcn@latest\nmcp"}
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="csp-cwd" className="text-sm font-medium text-[var(--foreground)]">
                  Working directory (opcional)
                </label>
                <Input
                  id="csp-cwd"
                  className="h-11 rounded-xl font-mono text-sm"
                  placeholder="/ruta/al/proyecto"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </>
          )}

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
