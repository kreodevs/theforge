import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronRight,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Package,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  migrateGovernancePath,
  parseAgentGovernanceScaffold,
  type AgentGovernanceFile,
  type AgentGovernanceScaffold,
} from "@theforge/shared-types";
import MddViewer from "@/components/MddViewer";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: AgentGovernanceFile;
}

/** Rutas como en repo destino / ZIP aplanado (sin prefijo `agent-governance/`). */
function normalizeScaffoldForDisplay(scaffold: AgentGovernanceScaffold): AgentGovernanceScaffold {
  const byPath = new Map<string, AgentGovernanceFile>();
  for (const file of scaffold.files) {
    const path = migrateGovernancePath(file.path);
    if (!path || path === "MANIFEST.json") continue;
    byPath.set(path, { path, content: file.content });
  }
  const files = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  return {
    ...scaffold,
    manifest: { ...scaffold.manifest, files: files.map((f) => f.path) },
    files,
  };
}

function buildFileTree(files: AgentGovernanceFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = file.path.split("/").filter(Boolean);
    let level = root;
    let acc = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      acc = acc ? `${acc}/${segment}` : segment;
      let node = level.find((n) => n.name === segment && n.isDir === !isLast);
      if (!node) {
        node = {
          name: segment,
          path: acc,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        level.push(node);
      } else if (isLast) {
        node.file = file;
        node.isDir = false;
      }
      level = node.children;
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({ ...n, children: sortNodes(n.children) }));

  return sortNodes(root);
}

const COMO_USAR_PATH = "docs/agent-governance/COMO-USAR-GOBERNANZA-IA.md";
const INSTALACION_PATH = "docs/agent-governance/INSTALACION.md";

function fileIcon(path: string) {
  if (path.endsWith(".json")) return FileJson;
  if (path.endsWith(".mdc")) return FileCode;
  if (path.endsWith(".md")) return FileText;
  return FileText;
}

function fileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toUpperCase() : "FILE";
}

const TREE_ROW_BASE =
  "flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-md)] py-1.5 text-left text-xs transition-colors";

const TREE_ROW_SELECTED =
  "bg-[color-mix(in_oklch,var(--primary)_14%,var(--background))] text-[var(--foreground)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_28%,transparent)]";

const TREE_ROW_IDLE =
  "text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,var(--background))] hover:text-[var(--foreground)]";

function QuickLinkButton({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors",
        active ? TREE_ROW_SELECTED : TREE_ROW_IDLE,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] text-[var(--primary)]"
            : "bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] text-[var(--muted-foreground)]",
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-snug text-[var(--foreground)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-[10px] leading-snug text-[var(--muted-foreground)]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = !node.isDir && node.file && selectedPath === node.file.path;
  const Icon = node.isDir ? (open ? FolderOpen : Folder) : fileIcon(node.path);
  const indent = 8 + depth * 14;

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(TREE_ROW_BASE, "pr-2 font-medium text-[var(--foreground)]", TREE_ROW_IDLE)}
          style={{ paddingLeft: `${indent}px` }}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-150",
              open && "rotate-90",
            )}
            aria-hidden
          />
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              open ? "text-[color-mix(in_oklch,var(--primary)_72%,var(--foreground))]" : "text-[var(--muted-foreground)]",
            )}
            aria-hidden
          />
          <span className="truncate">{node.name}</span>
        </button>
        {open ? (
          <div className="relative">
            {node.children.length > 0 ? (
              <span
                className="pointer-events-none absolute bottom-1 border-l border-dotted border-[color-mix(in_oklch,var(--border)_85%,transparent)]"
                style={{ left: `${indent + 6}px`, top: "2px" }}
                aria-hidden
              />
            ) : null}
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => node.file && onSelect(node.file.path)}
      className={cn(TREE_ROW_BASE, "pr-2", isSelected ? TREE_ROW_SELECTED : TREE_ROW_IDLE)}
      style={{ paddingLeft: `${indent + 18}px` }}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
        )}
        aria-hidden
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function GovernanceFileHeader({ path }: { path: string }) {
  const segments = path.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] ?? path;
  const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : null;
  const Icon = fileIcon(path);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] text-[var(--muted-foreground)]"
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{fileName}</p>
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide">
            {fileExtension(path)}
          </Badge>
        </div>
        {parentPath ? (
          <p className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">{parentPath}/</p>
        ) : null}
      </div>
    </div>
  );
}

export function AgentGovernancePanel({
  scaffold: scaffoldProp,
  rawContent,
  viewMode,
  loading = false,
}: {
  /** Scaffold reconciliado (export API); preferido sobre `rawContent`. */
  scaffold?: AgentGovernanceScaffold | null;
  rawContent?: string | null;
  viewMode: "preview" | "source";
  loading?: boolean;
}) {
  const scaffold = useMemo(() => {
    const base = scaffoldProp ?? parseAgentGovernanceScaffold(rawContent);
    if (!base) return null;
    return normalizeScaffoldForDisplay(base);
  }, [scaffoldProp, rawContent]);
  const tree = useMemo(() => (scaffold ? buildFileTree(scaffold.files) : []), [scaffold]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const hasComoUsar = useMemo(
    () => scaffold?.files.some((f) => f.path === COMO_USAR_PATH) ?? false,
    [scaffold],
  );
  const hasInstalacion = useMemo(
    () => scaffold?.files.some((f) => f.path === INSTALACION_PATH) ?? false,
    [scaffold],
  );
  const suggestions = scaffold?.manifest.suggestions;
  const suggestionCount =
    suggestions?.entries?.length ??
    (suggestions?.rationale?.length ? suggestions.rationale.length : 0);

  useEffect(() => {
    if (!scaffold) return;
    if (scaffold.files.some((f) => f.path === COMO_USAR_PATH)) {
      setSelectedPath(COMO_USAR_PATH);
    }
  }, [scaffold]);

  const selectedFile = useMemo(() => {
    if (!scaffold) return null;
    const defaultPath = scaffold.files.some((f) => f.path === COMO_USAR_PATH)
      ? COMO_USAR_PATH
      : (scaffold.files[0]?.path ?? null);
    const path = selectedPath ?? defaultPath;
    if (!path) return null;
    return scaffold.files.find((f) => f.path === path) ?? scaffold.files[0] ?? null;
  }, [scaffold, selectedPath]);

  if (loading) {
    return (
      <div className="flex min-h-[min(320px,50vh)] flex-1 items-center justify-center p-6">
        <p className="text-sm text-[var(--muted-foreground)]">Cargando paquete reconciliado…</p>
      </div>
    );
  }

  if (!scaffold) return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
      <aside
        className="flex max-h-[min(44vh,18rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--background))] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)] lg:max-h-none lg:w-60 xl:w-72"
        aria-label="Árbol del paquete handoff en raíz del repo"
      >
        <div className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_40%,var(--background))] px-3 py-3">
          <div className="flex items-start gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_14%,var(--card))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_24%,transparent)]"
              aria-hidden
            >
              <Package className="h-4 w-4 text-[var(--primary)]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <p className="text-xs font-semibold tracking-tight text-[var(--foreground)]">Paquete handoff</p>
                <p className="text-[10px] leading-snug text-[var(--muted-foreground)]">
                  Raíz del repo · gobernanza + SDD
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="outline"
                  className="border-[color-mix(in_oklch,var(--primary)_22%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_6%,var(--background))] px-1.5 py-0 text-[9px] font-medium text-[var(--foreground)]"
                >
                  v{scaffold.manifest.templateVersion}
                </Badge>
                <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-medium">
                  {scaffold.files.length} archivos
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {(hasComoUsar || hasInstalacion || (suggestions && suggestionCount > 0)) && (
          <div className="shrink-0 space-y-2 border-b border-[var(--border)] px-2 py-2.5">
            {(hasComoUsar || hasInstalacion) && (
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  Inicio rápido
                </p>
                {hasComoUsar ? (
                  <QuickLinkButton
                    icon={BookOpen}
                    label="Cómo usar la gobernanza"
                    description="COMO-USAR-GOBERNANZA-IA.md"
                    active={selectedFile?.path === COMO_USAR_PATH}
                    onClick={() => setSelectedPath(COMO_USAR_PATH)}
                  />
                ) : null}
                {hasInstalacion ? (
                  <QuickLinkButton
                    icon={Wrench}
                    label="Instalación en el repo"
                    description="INSTALACION.md"
                    active={selectedFile?.path === INSTALACION_PATH}
                    onClick={() => setSelectedPath(INSTALACION_PATH)}
                  />
                ) : null}
              </div>
            )}

            {suggestions && suggestionCount > 0 ? (
              <div
                className="rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--primary)_16%,var(--border))] bg-[color-mix(in_oklch,var(--muted)_38%,var(--background))] px-2.5 py-2"
                title={suggestions.rationale?.join("\n")}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--foreground)]">
                  <Sparkles className="h-3 w-3 shrink-0 text-[var(--primary)]" aria-hidden />
                  <span>Sugeridos por el proyecto</span>
                  {suggestions.entries?.length ? (
                    <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[9px]">
                      {suggestions.entries.length}
                    </Badge>
                  ) : null}
                </div>
                {suggestions.archetypes?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {suggestions.archetypes.map((archetype) => (
                      <Badge
                        key={archetype}
                        variant="outline"
                        className="max-w-full truncate px-1.5 py-0 text-[9px] font-normal"
                      >
                        {archetype}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <p className="shrink-0 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Explorador
          </p>
          <nav
            className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
            aria-label="Archivos del paquete"
          >
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedFile?.path ?? null}
                onSelect={setSelectedPath}
              />
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        {selectedFile ? (
          <>
            <div className="shrink-0 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_35%,var(--background))] px-4 py-2.5 sm:px-5">
              <GovernanceFileHeader path={selectedFile.path} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-6 sm:py-5 [scrollbar-gutter:stable]">
              {viewMode === "preview" ? (
                <MddViewer content={selectedFile.content} />
              ) : (
                <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--foreground)]">
                  {selectedFile.content}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Bot className="h-10 w-10 text-[var(--muted-foreground)] opacity-40" strokeWidth={1.5} aria-hidden />
            <p className="text-sm text-[var(--muted-foreground)]">Selecciona un archivo del explorador.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function agentGovernanceScaffoldFromContent(
  raw: string | null | undefined,
): AgentGovernanceScaffold | null {
  return parseAgentGovernanceScaffold(raw);
}
