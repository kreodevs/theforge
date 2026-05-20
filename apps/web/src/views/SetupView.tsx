import { useEffect, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { API_BASE, setAccessToken } from "@/utils/apiClient";

interface SetupViewProps {
  onComplete: () => void;
}

export default function SetupView({ onComplete }: SetupViewProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [createdMcpSecret, setCreatedMcpSecret] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Verificar que realmente no hay usuarios; si los hay, notificar
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/has-users`)
      .then((r) => r.json())
      .then((data: { hasUsers?: boolean }) => {
        if (cancelled) return;
        if (data.hasUsers !== false) {
          onComplete();
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Si falla, asumir que no hay users y mostrar el setup
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email requerido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/auth/register-first-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      const data = (await r.json()) as {
        created?: boolean;
        message?: string;
        mcpSecret?: string;
      };
      if (data?.created) {
        setCreatedMcpSecret(data.mcpSecret ?? null);
        setDone(true);
      } else {
        setError(data?.message || "Error al crear administrador");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <p className="text-sm text-[var(--foreground-muted)]">Verificando estado del sistema...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg border-[var(--border)]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl flex items-center gap-2 text-[var(--primary)]">
              <Flame className="w-7 h-7" />
              ¡Listo! 🎉
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--foreground-muted)]">
              Administrador <strong>{email}</strong> creado exitosamente.
            </p>
            <p className="text-sm text-[var(--foreground-muted)]">
              Puedes entrar <strong>sin correo</strong> con este secret MCP (guárdalo en un lugar
              seguro):
            </p>
            {createdMcpSecret ? (
              <pre className="max-h-24 overflow-auto rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-xs font-mono break-all">
                {createdMcpSecret}
              </pre>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={async () => {
                if (!createdMcpSecret) {
                  onComplete();
                  return;
                }
                try {
                  const r = await fetch(`${API_BASE}/auth/mcp-login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ secret: createdMcpSecret }),
                  });
                  const data = (await r.json()) as { accessToken?: string };
                  if (data.accessToken) {
                    setAccessToken(data.accessToken);
                    window.location.reload();
                    return;
                  }
                } catch {
                  /* fallback */
                }
                onComplete();
              }}
            >
              Entrar con secret MCP
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onComplete}>
              Ir a iniciar sesión (correo)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg border-[var(--border)]">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl flex items-center gap-2 text-[var(--primary)]">
            <Flame className="w-7 h-7" />
            Configuración inicial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-amber-500 font-medium">
              ⚙️ No hay usuarios registrados. Crea el primer administrador.
            </p>
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                El primer usuario se creará con rol de <strong>administrador</strong>.
                No se necesita configuración SMTP para este paso.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="setup-email" className="text-sm text-[var(--foreground-muted)]">
                Email
              </label>
              <Input
                id="setup-email"
                type="email"
                placeholder="admin@ejemplo.com"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="setup-name" className="text-sm text-[var(--foreground-muted)]">
                Nombre (opcional)
              </label>
              <Input
                id="setup-name"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creando administrador...
                </>
              ) : (
                "Crear administrador"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
