import { useEffect, useState, useCallback } from "react";
import { Loader2, UserPlus, Trash2, X } from "lucide-react";
import { apiFetch, API_BASE } from "@/utils/apiClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface UserRow {
  id: string;
  email: string;
  role: "admin" | "developer";
  name: string | null;
  hasMcpSecret: boolean;
  createdAt: string;
}

declare module "react" {
  interface ButtonHTMLAttributes<T> extends React.HTMLAttributes<T> {
    loading?: boolean;
  }
}

export function UsersList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "developer">("developer");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/users`);
      if (r.ok) {
        const data = (await r.json()) as UserRow[];
        setUsers(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, role: "admin" | "developer") => {
    const r = await apiFetch(`${API_BASE}/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (r.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim() || undefined,
          role: newRole,
        }),
      });
      if (r.ok) {
        setShowCreate(false);
        setNewEmail("");
        setNewName("");
        await loadUsers();
      } else {
        const data = await r.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? "Error al crear usuario");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return;
    const r = await apiFetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
    if (r.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  };

  return (
    <div className="space-y-4 overflow-y-auto flex-1 min-h-0 py-2">
      {/* Create user form */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="rounded-lg border border-[var(--border)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nuevo usuario</span>
            <button type="button" onClick={() => { setShowCreate(false); setError(null); }} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="text-sm"
          />
          <Input
            placeholder="Nombre (opcional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-sm"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "developer")}
            className="w-full text-sm rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
          >
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={creating || !newEmail.trim()}>
              {creating ? "Creando..." : "Crear"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setError(null); }}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo usuario
        </button>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[var(--foreground-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando usuarios…
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)] py-2">No hay usuarios registrados.</p>
      ) : (
        users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{u.email}</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {u.hasMcpSecret ? "Token MCP configurado" : "Sin token MCP"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value as "admin" | "developer")}
                className="text-sm rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
              </select>
              <button
                onClick={() => handleDelete(u.id, u.email)}
                className="p-1 text-[var(--foreground-muted)] hover:text-[var(--destructive)] transition-colors"
                title="Eliminar usuario"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
