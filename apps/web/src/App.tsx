import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Flame,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
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
  projectType?: "NEW" | "LEGACY";
  theforgeProjectId?: string | null;
  createdAt: string;
}

interface TheForgeProjectRoot {
  id: string;
  name?: string;
  branch?: string;
}

interface TheForgeProject {
  id: string;
  name: string;
  roots?: TheForgeProjectRoot[];
  rootPath?: string;
  branch?: string;
}

/** Repo individual (root); puede usarse como base de conocimientos igual que un proyecto. */
interface TheForgeRepository {
  id: string;
  name: string;
  branch?: string;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [workshopProject, setWorkshopProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showTheForgeModal, setShowTheForgeModal] = useState(false);
  const [theforgeModalTab, setTheForgeModalTab] = useState<"projects" | "repos">("projects");
  const [theforgeProjects, setTheForgeProjects] = useState<TheForgeProject[]>([]);
  const [theforgeAvailable, setTheForgeAvailable] = useState(false);
  const [theforgeLoading, setTheForgeLoading] = useState(false);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  /** Repositorios únicos derivados de projects (roots); proyectos sin roots se tratan como repo único. */
  const theforgeRepositories = useMemo((): TheForgeRepository[] => {
    const byId = new Map<string, TheForgeRepository>();
    for (const p of theforgeProjects) {
      if (p.roots?.length) {
        for (const r of p.roots) {
          if (!byId.has(r.id))
            byId.set(r.id, { id: r.id, name: r.name ?? r.id, branch: r.branch });
        }
      } else {
        byId.set(p.id, { id: p.id, name: p.name, branch: p.branch });
      }
    }
    return Array.from(byId.values());
  }, [theforgeProjects]);

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
      const r = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), hasUxTeam: false, projectType: "NEW" }),
      });
      if (!r.ok) throw new Error("Error al crear proyecto");
      const created = (await r.json()) as Project;
      setNewName("");
      await loadProjects();
      setWorkshopProject(created);
    } finally {
      setLoading(false);
    }
  }

  async function loadTheForgeProjects() {
    setTheForgeLoading(true);
    try {
      const r = await fetch(`${API_BASE}/theforge/projects`);
      const data = (await r.json()) as { projects: TheForgeProject[]; theforgeAvailable: boolean };
      setTheForgeProjects(data.projects ?? []);
      setTheForgeAvailable(data.theforgeAvailable ?? false);
    } finally {
      setTheForgeLoading(false);
    }
  }

  function openTheForgeModal(tab: "projects" | "repos" = "projects") {
    setTheForgeModalTab(tab);
    setShowTheForgeModal(true);
    loadTheForgeProjects();
  }

  /** Crea proyecto legacy desde un proyecto TheForge (multi-repo) o un repositorio individual (id + name). */
  async function createLegacyProject(source: { id: string; name: string }) {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name,
          hasUxTeam: false,
          projectType: "LEGACY",
          theforgeProjectId: source.id,
        }),
      });
      if (!r.ok) throw new Error("Error al crear proyecto legacy");
      const created = (await r.json()) as Project;
      setShowTheForgeModal(false);
      await loadProjects();
      setWorkshopProject(created);
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
            TheForge
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
          <div className="flex flex-wrap gap-4 items-end">
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
              Crear (proyecto nuevo)
            </button>
            <button
              type="button"
              onClick={() => openTheForgeModal("projects")}
              disabled={loading}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 font-medium px-4 py-2 rounded inline-flex items-center gap-2 border border-zinc-600"
            >
              Proyecto existente (TheForge)
            </button>
            <button
              type="button"
              onClick={() => openTheForgeModal("repos")}
              disabled={loading}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 font-medium px-4 py-2 rounded inline-flex items-center gap-2 border border-zinc-600"
            >
              Repositorio existente (TheForge)
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

        {showTheForgeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="theforge-dialog-title"
            onClick={() => setShowTheForgeModal(false)}
          >
            <div
              className="bg-zinc-800 border border-zinc-600 rounded-xl p-6 shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="theforge-dialog-title" className="text-lg font-semibold text-zinc-200">
                  Base de conocimientos (TheForge)
                </h2>
                <button
                  type="button"
                  onClick={() => setShowTheForgeModal(false)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-zinc-500 text-sm mb-3">
                Elige un proyecto (varios repos) o un repositorio individual como base.
              </p>
              {!theforgeAvailable && !theforgeLoading && (
                <p className="text-zinc-400 text-sm">
                  TheForge no está configurado o no está disponible. Configura THEFORGE_MCP_URL y THEFORGE_M2M_TOKEN en el backend.
                </p>
              )}
              {theforgeLoading && (
                <div className="flex items-center gap-2 text-zinc-400 py-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando proyectos y repositorios…
                </div>
              )}
              {theforgeAvailable && !theforgeLoading && (
                <>
                  <div className="flex gap-2 mb-3 border-b border-zinc-600 pb-2">
                    <button
                      type="button"
                      onClick={() => setTheForgeModalTab("projects")}
                      className={`px-3 py-1.5 rounded text-sm font-medium ${theforgeModalTab === "projects" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-zinc-400 hover:text-zinc-200 border border-transparent"}`}
                    >
                      Proyectos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheForgeModalTab("repos")}
                      className={`px-3 py-1.5 rounded text-sm font-medium ${theforgeModalTab === "repos" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-zinc-400 hover:text-zinc-200 border border-transparent"}`}
                    >
                      Repositorios
                    </button>
                  </div>
                  {theforgeModalTab === "projects" && (
                    <>
                      {theforgeProjects.length === 0 ? (
                        <p className="text-zinc-400 text-sm">No hay proyectos indexados en TheForge.</p>
                      ) : (
                        <ul className="space-y-2 overflow-y-auto flex-1 min-h-0">
                          {theforgeProjects.map((rp) => (
                            <li key={rp.id}>
                              <button
                                type="button"
                                onClick={() => createLegacyProject(rp)}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-700/80 hover:bg-zinc-700 border border-zinc-600 hover:border-amber-500/50 text-zinc-200 disabled:opacity-50 flex flex-col gap-1"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <FolderGit2 className="w-4 h-4 shrink-0 text-amber-400/80" />
                                  <span className="font-medium truncate">{rp.name}</span>
                                  {rp.roots?.length != null && rp.roots.length > 0 && (
                                    <span className="shrink-0 text-xs text-zinc-500">{rp.roots.length} repo(s)</span>
                                  )}
                                  {rp.branch != null && rp.branch !== "" && !rp.roots?.length && (
                                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                      rama: {rp.branch}
                                    </span>
                                  )}
                                </div>
                                {rp.rootPath && (
                                  <span className="text-zinc-500 text-xs truncate pl-6">{rp.rootPath}</span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {theforgeModalTab === "repos" && (
                    <>
                      {theforgeRepositories.length === 0 ? (
                        <p className="text-zinc-400 text-sm">No hay repositorios (derivados de los proyectos indexados).</p>
                      ) : (
                        <ul className="space-y-2 overflow-y-auto flex-1 min-h-0">
                          {theforgeRepositories.map((repo) => (
                            <li key={repo.id}>
                              <button
                                type="button"
                                onClick={() => createLegacyProject(repo)}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-700/80 hover:bg-zinc-700 border border-zinc-600 hover:border-amber-500/50 text-zinc-200 disabled:opacity-50 flex flex-col gap-1"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <GitBranch className="w-4 h-4 shrink-0 text-amber-400/80" />
                                  <span className="font-medium truncate">{repo.name}</span>
                                  {repo.branch != null && repo.branch !== "" && (
                                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                      rama: {repo.branch}
                                    </span>
                                  )}
                                </div>
                                <span className="text-zinc-500 text-xs truncate pl-6 font-mono">{repo.id}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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
