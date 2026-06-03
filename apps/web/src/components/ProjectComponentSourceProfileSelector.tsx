import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Blocks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/utils/apiClient";
import {
  fetchComponentSourceProfiles,
  setProjectComponentSourceProfile,
} from "@/lib/component-source-profiles-api";
import {
  hasConfirmedCatalogMapping,
  type ComponentSourceProfileSummary,
} from "@/types/component-source-profiles";
import type { Project } from "@/store/workshopStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";

interface ProjectComponentSourceProfileSelectorProps {
  project: Project | null;
  onProjectUpdated: (project: Project) => void;
  /** Called after profile assignment that may trigger backend regeneration. */
  onProfileChangeCommitted?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Lets the project owner pick which saved MCP profile powers wireframes / design system import.
 * No default — empty selection shows guidance in the workshop.
 */
export function ProjectComponentSourceProfileSelector({
  project,
  onProjectUpdated,
  onProfileChangeCommitted,
  className,
  compact = false,
}: ProjectComponentSourceProfileSelectorProps) {
  const user = getStoredUser();
  const isOwner = Boolean(project?.userId && user?.id && project.userId === user.id);

  const [profiles, setProfiles] = useState<ComponentSourceProfileSummary[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const selectedId = project?.componentSourceProfileId ?? "";

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  const pendingProfile = useMemo(
    () => profiles.find((p) => p.id === pendingProfileId) ?? null,
    [profiles, pendingProfileId],
  );

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const list = await fetchComponentSourceProfiles();
      setProfiles(list);
    } catch {
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwner || !project?.id) return;
    void loadProfiles();
  }, [isOwner, project?.id, loadProfiles]);

  async function applyProfileChange(nextId: string) {
    if (!project?.id || !isOwner) return;
    const profileChanging = Boolean(nextId && nextId !== selectedId);
    if (profileChanging) {
      onProfileChangeCommitted?.();
    }
    setSaving(true);
    setError("");
    try {
      const assignment = await setProjectComponentSourceProfile(project.id, nextId || null);
      onProjectUpdated({
        ...project,
        componentSourceProfileId: assignment.profileId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar perfil MCP");
      if (selectRef.current) selectRef.current.value = selectedId;
    } finally {
      setSaving(false);
      setPendingProfileId(null);
    }
  }

  function handleSelectChange(nextId: string) {
    if (!project?.id || !isOwner || nextId === selectedId) return;

    if (!nextId) {
      void applyProfileChange("");
      return;
    }

    setPendingProfileId(nextId);
    setConfirmOpen(true);
  }

  function handleConfirmChange() {
    setConfirmOpen(false);
    if (pendingProfileId == null) return;
    void applyProfileChange(pendingProfileId);
  }

  function handleCancelChange() {
    setConfirmOpen(false);
    setPendingProfileId(null);
    if (selectRef.current) selectRef.current.value = selectedId;
  }

  if (!project || !isOwner) return null;

  const confirmProfileName = pendingProfile?.name ?? "el perfil seleccionado";

  return (
    <>
      <div className={cn("min-w-0", className)}>
        <label
          htmlFor="workshop-mcp-profile"
          className={cn(
            "flex items-center gap-1.5 text-[var(--foreground-muted)]",
            compact ? "sr-only" : "mb-1 text-xs font-medium",
          )}
        >
          <Blocks className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Perfil MCP de componentes
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <select
            ref={selectRef}
            id="workshop-mcp-profile"
            className={cn(
              "min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              compact ? "h-8 max-w-[14rem] px-2 text-xs" : "h-10 px-3 text-sm",
            )}
            value={selectedId}
            disabled={loadingProfiles || saving}
            onChange={(e) => handleSelectChange(e.target.value)}
          >
            <option value="">Selecciona perfil MCP…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {(loadingProfiles || saving) && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted-foreground)]" aria-hidden />
          )}
        </div>
        {!selectedId ? (
          <p className={cn("text-[var(--foreground-muted)]", compact ? "mt-1 text-[10px]" : "mt-1 text-xs")}>
            Sin perfil: wireframes y design system MCP quedan desactivados hasta que elijas uno en
            Ajustes → Componentes.
          </p>
        ) : selectedProfile && !selectedProfile.hasToken ? (
          <p className={cn("text-amber-700 dark:text-amber-300", compact ? "mt-1 text-[10px]" : "mt-1 text-xs")}>
            El perfil «{selectedProfile.name}» no tiene token configurado.
          </p>
        ) : selectedProfile && !hasConfirmedCatalogMapping(selectedProfile) ? (
          <p className={cn("text-amber-700 dark:text-amber-300", compact ? "mt-1 text-[10px]" : "mt-1 text-xs")}>
            El perfil «{selectedProfile.name}» aún no tiene mapeo confirmado — pruébalo en Ajustes →
            Componentes.
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && handleCancelChange()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar perfil MCP del proyecto?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-[var(--foreground-muted)]">
                <p>
                  Vas a asignar <strong className="text-[var(--foreground)]">{confirmProfileName}</strong>{" "}
                  a este proyecto.
                </p>
                <p>
                  El design system importado desde MCP y los wireframes existentes se regenerarán para
                  alinearlos con el nuevo catálogo de componentes. Este proceso puede tardar varios
                  minutos.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChange}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>Confirmar y regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Whether the project has a usable MCP profile selected (for gating design system actions). */
export function isProjectComponentSourceActive(
  project: Project | null,
  profiles: ComponentSourceProfileSummary[],
): boolean | null {
  if (!project) return null;
  const profileId = project.componentSourceProfileId?.trim();
  if (!profileId) return false;
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return false;
  return Boolean(profile.url.trim() && profile.hasToken);
}
