import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Flame,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import WorkshopView from "./views/WorkshopView";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

type Status = "ROJO" | "AMARILLO" | "VERDE";

interface Project {
  id: string;
  name: string;
  status: Status;
  precisionScore: number;
  hasUxTeam: boolean;
  createdAt: string;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [workshopProject, setWorkshopProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  async function loadProjects() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/projects`);
      const data = await r.json();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), hasUxTeam: false }),
      });
      setNewName("");
      await loadProjects();
    } finally {
      setLoading(false);
    }
  }

  function openDeleteConfirm(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    setProjectToDelete(p);
  }

  async function confirmDelete() {
    if (!projectToDelete) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/projects/${projectToDelete.id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Error al borrar");
      setProjectToDelete(null);
      await loadProjects();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!workshopProject) loadProjects();
  }, [workshopProject]);

  const statusColor: Record<Status, string> = {
    ROJO: "bg-red-500",
    AMARILLO: "bg-amber-500",
    VERDE: "bg-green-500",
  };

  if (workshopProject) {
    return (
      <WorkshopView
        projectId={workshopProject.id}
        projectName={workshopProject.name}
        onBack={() => setWorkshopProject(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-8">
      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={() => setProjectToDelete(null)}
        >
          <div
            className="bg-zinc-800 border border-zinc-600 rounded-xl p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-zinc-200 mb-2">
              Borrar proyecto
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              ¿Borrar &quot;{projectToDelete.name}&quot;? Se eliminarán sesiones y
              estimaciones. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {loading ? "Borrando…" : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="border-b border-zinc-700/80 pb-6">
          <h1 className="text-3xl font-bold text-amber-400 flex items-center gap-2">
            <Flame className="w-8 h-8" />
            The Forge
          </h1>
          <p className="text-zinc-400 mt-1">
            Software Factory — Entrevista proactiva → MDD → Semáforo →
            Estimación
          </p>
        </header>

        <section className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2 mb-4">
            <FolderPlus className="w-5 h-5 text-amber-400/80" />
            Nuevo proyecto
          </h2>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm text-zinc-400 mb-1 sr-only">
                Nombre del proyecto
              </label>
              <input
                ref={newProjectInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                placeholder="Nombre del proyecto"
                className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 w-64 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={createProject}
              disabled={loading || !newName.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-900 font-medium px-4 py-2 rounded inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Crear
            </button>
            <button
              onClick={loadProjects}
              disabled={loading}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refrescar
            </button>
          </div>
        </section>

        <section className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-amber-400/80" />
            Proyectos
          </h2>
          {projects.length === 0 && !loading && (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <FolderGit2 className="w-14 h-14 text-zinc-500 mb-3" />
              <p className="text-zinc-300 font-medium">Aún no hay proyectos</p>
              <p className="text-zinc-500 text-sm mt-1 max-w-xs">
                Crea uno arriba o usa Refrescar si ya existen en el backend.
              </p>
              <button
                type="button"
                onClick={() => newProjectInputRef.current?.focus()}
                className="mt-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-4 py-2 rounded text-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear primer proyecto
              </button>
            </div>
          )}
          {projects.length > 0 && (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-4 bg-zinc-800 rounded-lg px-4 py-3 border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors"
                  onClick={() => setWorkshopProject(p)}
                >
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${statusColor[p.status]}`}
                    title={p.status}
                  />
                  <span className="font-medium flex-1 min-w-0">{p.name}</span>
                  <span className="text-zinc-500 text-sm shrink-0">
                    Precisión {p.precisionScore}%
                  </span>
                  <span className="text-zinc-500 text-sm shrink-0">
                    {new Date(p.createdAt).toLocaleDateString("es-MX")}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => openDeleteConfirm(p, e)}
                    disabled={loading}
                    className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 shrink-0"
                    title="Borrar proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
