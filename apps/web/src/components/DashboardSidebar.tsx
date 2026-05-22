/**
 * @fileoverview Left navigation: brand, collapsible rail, project search, nav,
 * theme controls, and user footer. Collapse state is controlled by parent (persisted).
 * With an open workshop project, shows deliverables under the project name and syncs
 * the active document tab via `useWorkshopStore`.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type MouseEvent,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  FolderOpen,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  X,
} from "lucide-react";
import { Input } from "./ui/Input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui";
import type { TheForgeUser } from "@/utils/apiClient";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import { useWorkshopStore } from "../store/workshopStore";
import { buildWorkshopDocNavItems, workshopTabDocHasContent } from "../utils/workshopDocNav";
import { SIDEBAR_RAIL_ICON_BTN_IDLE, SIDEBAR_RAIL_ICON_BTN_OUTLINED } from "@/constants/workshopDocToolbar";
import { WorkshopRailIconButton } from "@/components/WorkshopButtons";

/** Esquinas del rail — redondeo suave (no círculo); el tema compacto sigue en `rounded-full`. */
const sidebarRailButtonClass = "rounded-xl";

const sidebarRailIconClass = "h-3.5 w-3.5 shrink-0";

/** Separación vertical entre iconos del rail colapsado (opciones de navegación). */
const sidebarRailStackGapClass = "gap-2";

/** Separación vertical entre fases del flujo en el rail colapsado. */
const sidebarRailPhaseStackGapClass = "gap-1";

/** Línea divisoria entre opciones de navegación y fases en el rail colapsado. */
const sidebarRailSeparatorClass =
  "mx-auto h-px w-6 shrink-0 bg-[color-mix(in_oklch,var(--sidebar-border)_75%,var(--sidebar))]";

/** Marca TheForge en el rail colapsado — borde visible, sin relleno. */
function SidebarRailBrandMark() {
  return (
    <div
      className={cn(
        SIDEBAR_RAIL_ICON_BTN_OUTLINED,
        sidebarRailButtonClass,
        "pointer-events-none mx-auto",
      )}
      aria-hidden
    >
      <Flame className={cn(sidebarRailIconClass, "text-[var(--primary)]")} />
    </div>
  );
}

export interface DashboardSidebarProps {
  projectSearchQuery: string;
  onProjectSearchChange: (value: string) => void;
  user: TheForgeUser | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenUsers: () => void;
  canManageUsers: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** When set, sidebar shows the workshop project tree instead of the dashboard “Proyectos” shortcut. */
  workshopProject?: { id: string; name: string } | null;
  /** Leave workshop and return to the project dashboard. */
  onExitWorkshop?: () => void;
  /** Runs before scrolling to the projects grid (e.g. close admin Users view). */
  onBeforeNavigateToProjects?: () => void;
  /** Runs before switching workshop doc tab (e.g. close Settings / Users overlay). */
  onBeforeNavigateToWorkshopDoc?: () => void;
}

function getDisplayName(user: TheForgeUser | null): string {
  const n = user?.name?.trim();
  if (n) return n;
  const local = user?.email?.split("@")[0]?.trim();
  if (local) return local;
  return "Usuario";
}

function getUserInitials(user: TheForgeUser | null): string {
  const n = user?.name?.trim() ?? "";
  if (n.length >= 2) return n.slice(0, 2).toUpperCase();
  if (n.length === 1) return (n + (user?.email?.[0] ?? "?")).slice(0, 2).toUpperCase();
  if (!user?.email) return "?";
  const local = user.email.split("@")[0] ?? "";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function closeDetailsFromEvent(e: MouseEvent<HTMLElement>) {
  const root = e.currentTarget.closest("details");
  if (root) (root as HTMLDetailsElement).open = false;
}

/**
 * Tooltip for collapsed rail: native `title` is easy to miss and can behave poorly with nested overflow.
 */
function CollapsedRailHint({
  rail,
  label,
  children,
}: {
  rail: boolean;
  label: string;
  children: ReactElement;
}) {
  if (!rail) return children;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const sidebarInsetButtonBaseClass =
  "inline-flex shrink-0 items-center justify-center border border-transparent font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)]";

function sidebarInsetShellClass(compact: boolean) {
  return cn(
    "w-fit bg-[color-mix(in_oklch,var(--sidebar-foreground)_6%,var(--sidebar))] p-0.5 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--sidebar-foreground)_8%,transparent)]",
    compact ? "rounded-full" : "rounded-[var(--radius-lg)]",
  );
}

const sidebarInsetButtonIdleClass =
  "bg-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]";

const sidebarAccountButtonClass = cn(
  sidebarInsetButtonBaseClass,
  SIDEBAR_RAIL_ICON_BTN_IDLE,
  sidebarRailButtonClass,
  "text-xs font-semibold text-[var(--primary)] hover:bg-[var(--sidebar-accent)]",
  "group-open/account:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] group-open/account:bg-[color-mix(in_oklch,var(--primary)_12%,var(--sidebar))] group-open/account:shadow-sm",
);

const sidebarInsetButtonSelectedClass =
  "border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm";

const SidebarInsetToggleButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { selected?: boolean; compact?: boolean }
>(({ selected, compact, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      sidebarInsetButtonBaseClass,
      compact ? "h-8 w-8 rounded-full" : "min-h-8 flex-1 flex-col gap-0.5 rounded-[var(--radius-md)] py-1.5 text-[10px]",
      selected ? sidebarInsetButtonSelectedClass : sidebarInsetButtonIdleClass,
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
SidebarInsetToggleButton.displayName = "SidebarInsetToggleButton";

function ThemeModeToggle({ compact }: { compact: boolean }) {
  const { preference, setPreference } = useTheme();

  const item = (value: ThemePreference, label: string, icon: ReactNode) => {
    const button = (
      <SidebarInsetToggleButton
        selected={preference === value}
        compact={compact}
        onClick={() => setPreference(value)}
        title={label}
        aria-label={label}
        aria-pressed={preference === value}
      >
        <span className={cn("flex items-center justify-center", !compact && "flex-col gap-0.5")}>
          <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          {!compact ? <span className="leading-none">{label}</span> : null}
        </span>
      </SidebarInsetToggleButton>
    );
    if (!compact) return button;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div
      className={cn(
        sidebarInsetShellClass(compact),
        "mb-2",
        compact ? "mx-auto flex flex-col gap-0.5" : "w-full max-w-none",
      )}
      role="group"
      aria-label="Tema de la interfaz"
    >
      <div className={cn(compact ? "flex flex-col gap-0.5" : "flex w-full gap-0.5")}>
        {item("light", "Claro", <Sun className="h-4 w-4" />)}
        {item("system", "Sistema", <Monitor className="h-4 w-4" />)}
        {item("dark", "Oscuro", <Moon className="h-4 w-4" />)}
      </div>
    </div>
  );
}

export function DashboardSidebar({
  projectSearchQuery,
  onProjectSearchChange,
  user,
  onLogout,
  onOpenSettings,
  onOpenUsers,
  canManageUsers,
  collapsed,
  onToggleCollapsed,
  workshopProject = null,
  onExitWorkshop,
  onBeforeNavigateToProjects,
  onBeforeNavigateToWorkshopDoc,
}: DashboardSidebarProps) {
  const rail = collapsed;
  /** Drawer navigation below lg; fixed sidebar column from lg. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const projectSearchInputRef = useRef<HTMLInputElement | null>(null);
  /** Expanded/collapsed list under the workshop project name (header toggles this). */
  const [workshopStepsExpanded, setWorkshopStepsExpanded] = useState(true);

  useEffect(() => {
    setWorkshopStepsExpanded(true);
  }, [workshopProject?.id]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return;
    const mq = globalThis.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) setMobileNavOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleOpenMobileSearch = useCallback(() => {
    setMobileNavOpen(true);
    requestAnimationFrame(() => {
      projectSearchInputRef.current?.focus();
    });
  }, []);

  const handleScrollToProjects = useCallback(() => {
    onBeforeNavigateToProjects?.();
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      document.getElementById("dashboard-projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [onBeforeNavigateToProjects]);

  const storeProject = useWorkshopStore((s) => s.project);
  const workshopStages = useWorkshopStore((s) => s.workshopStages);
  const activeStageId = useWorkshopStore((s) => s.activeStageId);
  const activeDocPanel = useWorkshopStore((s) => s.workshopActiveDocPanel);
  const setWorkshopActiveDocPanel = useWorkshopStore((s) => s.setWorkshopActiveDocPanel);
  const mddContent = useWorkshopStore((s) => s.mddContent);
  const dbgaContent = useWorkshopStore((s) => s.dbgaContent);
  const phase0SummaryContent = useWorkshopStore((s) => s.phase0SummaryContent);
  const specContent = useWorkshopStore((s) => s.specContent);
  const architectureContent = useWorkshopStore((s) => s.architectureContent);
  const useCasesContent = useWorkshopStore((s) => s.useCasesContent);
  const userStoriesContent = useWorkshopStore((s) => s.userStoriesContent);
  const blueprintContent = useWorkshopStore((s) => s.blueprintContent);
  const uxUiGuideContent = useWorkshopStore((s) => s.uxUiGuideContent);
  const aemContent = useWorkshopStore((s) => s.aemContent);
  const apiContractsContent = useWorkshopStore((s) => s.apiContractsContent);
  const logicFlowsContent = useWorkshopStore((s) => s.logicFlowsContent);
  const tasksContent = useWorkshopStore((s) => s.tasksContent);
  const infraContent = useWorkshopStore((s) => s.infraContent);
  const adrs = useWorkshopStore((s) => s.adrs);

  const activeWorkshopStageForNav = useMemo(() => {
    const stages = workshopStages.length > 0 ? workshopStages : (storeProject?.stages ?? []);
    return stages.find((s) => s.id === activeStageId) ?? null;
  }, [workshopStages, storeProject?.stages, activeStageId]);

  const activeLegacyStateForNav = useMemo(() => {
    if (!storeProject) return null;
    if (storeProject.projectType === "LEGACY" && activeWorkshopStageForNav?.legacyChangeState) {
      return activeWorkshopStageForNav.legacyChangeState;
    }
    return storeProject.legacyFlowState ?? null;
  }, [storeProject, activeWorkshopStageForNav?.legacyChangeState]);

  const isLegacyProject = storeProject?.projectType === "LEGACY";
  const complexity = storeProject?.complexity ?? "HIGH";
  const effectiveMddTrimmed = useMemo(
    () => (mddContent ?? "").trim() || (storeProject?.mddContent ?? "").trim(),
    [mddContent, storeProject?.mddContent],
  );
  const isReverseEngineering =
    !!isLegacyProject &&
    !!((activeLegacyStateForNav?.codebaseDoc ?? "").trim()) &&
    !effectiveMddTrimmed;
  const effectiveComplexityForTabs = isReverseEngineering ? "HIGH" : complexity;

  const workshopDeliverables = useMemo(() => {
    if (!workshopProject || !storeProject || storeProject.id !== workshopProject.id) return [];
    return buildWorkshopDocNavItems({
      isLegacyProject: !!isLegacyProject,
      effectiveComplexityForTabs,
      activeLegacyState: activeLegacyStateForNav,
      phase0SummaryContent,
      dbgaContent,
      activeWorkshopStage: activeWorkshopStageForNav,
      mddContent,
      specContent,
      architectureContent,
      useCasesContent,
      userStoriesContent,
      blueprintContent,
      uxUiGuideContent,
      aemContent,
      apiContractsContent,
      logicFlowsContent,
      tasksContent,
      adrs,
      infraContent,
    });
  }, [
    workshopProject,
    storeProject,
    isLegacyProject,
    effectiveComplexityForTabs,
    activeLegacyStateForNav,
    phase0SummaryContent,
    dbgaContent,
    activeWorkshopStageForNav,
    mddContent,
    specContent,
    architectureContent,
    useCasesContent,
    userStoriesContent,
    blueprintContent,
    uxUiGuideContent,
    aemContent,
    apiContractsContent,
    logicFlowsContent,
    tasksContent,
    adrs,
    infraContent,
  ]);

  const inWorkshop = !!workshopProject && typeof onExitWorkshop === "function";

  const handleExitWorkshopNav = useCallback(() => {
    closeMobileNav();
    onExitWorkshop?.();
  }, [closeMobileNav, onExitWorkshop]);

  return (
    <div className="relative flex w-full shrink-0 flex-col lg:z-40 lg:h-full lg:min-h-0 lg:w-auto lg:shrink-0">
      <header
        className="sticky top-0 z-40 flex w-full items-center justify-between gap-2 border-b border-[color-mix(in_oklch,var(--sidebar-border)_90%,var(--sidebar))] bg-[var(--sidebar)] px-3 py-2.5 text-[var(--sidebar-foreground)] lg:hidden"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color-mix(in_oklch,var(--sidebar-foreground)_7%,var(--sidebar))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--sidebar-foreground)_10%,transparent)]">
            <Flame className="h-5 w-5 text-[var(--primary)]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--sidebar-foreground)]">TheForge</p>
            <p className="truncate text-[11px] text-[var(--muted-foreground)]">Software Factory</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!inWorkshop ? (
            <button
              type="button"
              onClick={handleOpenMobileSearch}
              title="Buscar proyectos"
              aria-label="Buscar proyectos"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)]"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            title={mobileNavOpen ? "Cerrar menú" : "Abrir menú"}
            aria-label={mobileNavOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            aria-expanded={mobileNavOpen}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--sidebar-border)_70%,var(--sidebar))] bg-[color-mix(in_oklch,var(--sidebar-foreground)_6%,var(--sidebar))] text-[var(--sidebar-foreground)] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--sidebar-foreground)_8%,transparent)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)] active:scale-[0.97]"
          >
            {mobileNavOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-[color-mix(in_oklch,var(--background)_40%,black)] lg:hidden"
          onClick={closeMobileNav}
        />
      ) : null}

      <TooltipProvider delayDuration={280}>
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] lg:border-b-0 lg:border-r lg:min-h-0 lg:self-stretch lg:sticky lg:top-0 lg:transition-[width] lg:duration-200 lg:ease-out",
        // Mobile: slide-over drawer; desktop: unchanged width and sticky column.
        "max-lg:absolute max-lg:left-0 max-lg:top-0 max-lg:z-50 max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:w-[min(19rem,92vw)] max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:border-r max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-out max-lg:[-webkit-overflow-scrolling:touch]",
        mobileNavOpen
          ? "max-lg:translate-x-0 max-lg:pointer-events-auto"
          : "max-lg:-translate-x-full max-lg:pointer-events-none",
        !inWorkshop && "lg:h-full lg:max-h-[100dvh] lg:min-h-0",
        inWorkshop &&
          cn(
            "min-h-0 lg:h-full lg:max-h-[min(100dvh,100svh)] lg:min-h-0",
            rail ? "overflow-hidden lg:overflow-visible" : "overflow-hidden",
          ),
        // Expanded: 16rem / 256px (common nav width); rail stays 4rem.
        rail ? "lg:w-16 lg:min-w-[4rem]" : "lg:w-64 lg:min-w-64",
      )}
      aria-label="Navegación principal"
    >
      <div
        className={cn(
          "flex flex-col min-h-0",
          inWorkshop
            ? cn("min-h-0 flex-1 overflow-hidden", rail ? "gap-0" : "gap-4")
            : cn("min-h-0 lg:flex-1 lg:overflow-hidden", rail ? sidebarRailStackGapClass : "gap-4"),
          rail ? "p-3 lg:px-2 lg:py-3" : "px-3 py-3 lg:px-3 lg:py-3",
        )}
      >
        <div
          className={cn(
            "flex w-full gap-2 max-lg:hidden",
            rail ? cn("lg:flex-col lg:items-center", sidebarRailStackGapClass) : "items-center justify-between",
            rail && "lg:hidden",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-2.5",
              rail ? "lg:flex-none lg:justify-center" : "flex-1",
            )}
          >
            {rail ? (
              <SidebarRailBrandMark />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color-mix(in_oklch,var(--sidebar-foreground)_7%,var(--sidebar))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--sidebar-foreground)_10%,transparent)]">
                <Flame className="h-5 w-5 text-[var(--primary)]" aria-hidden />
              </div>
            )}
            <div className={cn("min-w-0", rail && "lg:hidden")}>
              <p className="truncate text-base font-semibold tracking-tight text-[var(--sidebar-foreground)]">
                TheForge
              </p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">Software Factory</p>
            </div>
          </div>
          <CollapsedRailHint rail={rail} label="Expandir barra lateral">
            {rail ? (
              <WorkshopRailIconButton
                outlined
                onClick={onToggleCollapsed}
                title={rail ? "Expandir barra lateral" : "Contraer barra lateral"}
                aria-expanded={!rail}
                className={sidebarRailButtonClass}
              >
                <ChevronLeft className={cn(sidebarRailIconClass, rail && "hidden")} aria-hidden />
                <ChevronRight className={cn(sidebarRailIconClass, "hidden", rail && "block")} aria-hidden />
              </WorkshopRailIconButton>
            ) : (
              <WorkshopRailIconButton
                outlined
                onClick={onToggleCollapsed}
                title="Contraer barra lateral"
                aria-expanded={!rail}
                size="default"
                className={cn("hidden lg:inline-flex", sidebarRailButtonClass)}
              >
                <ChevronLeft className={sidebarRailIconClass} aria-hidden />
              </WorkshopRailIconButton>
            )}
          </CollapsedRailHint>
        </div>

        {!inWorkshop && rail ? (
          <div className={cn("hidden lg:flex lg:flex-col lg:items-center", sidebarRailStackGapClass)}>
            <SidebarRailBrandMark />
            <CollapsedRailHint rail={rail} label="Expandir barra lateral">
              <WorkshopRailIconButton
                outlined
                onClick={onToggleCollapsed}
                title="Expandir barra lateral"
                aria-expanded={false}
                className={sidebarRailButtonClass}
              >
                <ChevronRight className={sidebarRailIconClass} aria-hidden />
              </WorkshopRailIconButton>
            </CollapsedRailHint>
            <CollapsedRailHint rail={rail} label="Buscar proyectos — expandir barra lateral">
              <WorkshopRailIconButton
                title="Expandir barra para buscar"
                aria-label="Expandir barra lateral para buscar proyectos"
                onClick={onToggleCollapsed}
                className={sidebarRailButtonClass}
              >
                <Search className={sidebarRailIconClass} aria-hidden />
              </WorkshopRailIconButton>
            </CollapsedRailHint>
            <CollapsedRailHint rail={rail} label="Proyectos">
              <WorkshopRailIconButton
                onClick={handleScrollToProjects}
                title="Proyectos"
                aria-label="Proyectos"
                aria-current="page"
                className={sidebarRailButtonClass}
              >
                <FolderOpen className={cn(sidebarRailIconClass, "text-[var(--primary)]")} aria-hidden />
              </WorkshopRailIconButton>
            </CollapsedRailHint>
          </div>
        ) : null}

        {!inWorkshop ? (
          <div className={cn("group/project-search relative", rail && "lg:hidden")}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)] transition-colors duration-[var(--transition-base)] group-hover/project-search:text-[var(--primary)] group-focus-within/project-search:text-[var(--primary)]"
              aria-hidden
            />
            <Input
              ref={projectSearchInputRef}
              type="search"
              value={projectSearchQuery}
              onChange={(e) => onProjectSearchChange(e.target.value)}
              placeholder="Buscar proyectos…"
              className="w-full min-h-10 rounded-[var(--radius-lg)] border border-[color-mix(in_oklch,var(--sidebar-border)_65%,var(--sidebar))] bg-[color-mix(in_oklch,var(--sidebar-foreground)_5%,var(--sidebar))] pl-9 pr-3 text-sm text-[var(--sidebar-foreground)] placeholder:text-[color-mix(in_oklch,var(--sidebar-foreground)_55%,var(--sidebar))]"
              aria-label="Buscar en la lista de proyectos"
            />
          </div>
        ) : null}

        <nav
          className={cn(
            "flex min-w-0 flex-col gap-1",
            inWorkshop && "min-h-0 flex-1 overflow-hidden",
          )}
          aria-label="Secciones"
        >
          <p
            className={cn(
              "px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]",
              rail && "lg:hidden",
            )}
          >
            {inWorkshop ? "Taller" : "Menú"}
          </p>

          {inWorkshop ? (
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                rail ? cn(sidebarRailStackGapClass, "items-center") : "gap-2",
              )}
            >
              {rail ? (
                <>
                  <SidebarRailBrandMark />
                  <CollapsedRailHint rail={rail} label="Expandir barra lateral">
                    <WorkshopRailIconButton
                      outlined
                      onClick={onToggleCollapsed}
                      title="Expandir barra lateral"
                      aria-expanded={false}
                      className={cn("mx-auto", sidebarRailButtonClass)}
                    >
                      <ChevronRight className={sidebarRailIconClass} aria-hidden />
                    </WorkshopRailIconButton>
                  </CollapsedRailHint>
                  <CollapsedRailHint rail={rail} label="Buscar proyectos — expandir barra lateral">
                    <WorkshopRailIconButton
                      title="Expandir barra para buscar"
                      aria-label="Expandir barra lateral para buscar proyectos"
                      onClick={onToggleCollapsed}
                      className={cn("mx-auto", sidebarRailButtonClass)}
                    >
                      <Search className={sidebarRailIconClass} aria-hidden />
                    </WorkshopRailIconButton>
                  </CollapsedRailHint>
                </>
              ) : null}
              <CollapsedRailHint rail={rail} label="Volver al panel de proyectos">
                {rail ? (
                  <WorkshopRailIconButton
                    onClick={handleExitWorkshopNav}
                    title="Volver al panel de proyectos"
                    aria-label="Volver al panel de proyectos"
                    className={cn("mx-auto", sidebarRailButtonClass)}
                  >
                    <ArrowLeft className={sidebarRailIconClass} aria-hidden />
                  </WorkshopRailIconButton>
                ) : (
                  <button
                    type="button"
                    onClick={handleExitWorkshopNav}
                    title="Volver al panel de proyectos"
                    className="flex w-full shrink-0 items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-left text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">Panel de proyectos</span>
                  </button>
                )}
              </CollapsedRailHint>

              {/* Not <details>: flex + min-h-0 height math stays reliable; collapse is explicit state on the header button. */}
              <div
                className="group/ws flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                role="group"
                aria-label={`Proyecto ${workshopProject.name}`}
              >
                {rail ? (
                  <div className="flex shrink-0 justify-center">
                    <CollapsedRailHint rail={rail} label={`Proyecto: ${workshopProject.name}`}>
                      <div
                        className={cn(SIDEBAR_RAIL_ICON_BTN_IDLE, sidebarRailButtonClass, "pointer-events-none hover:bg-transparent")}
                        aria-hidden
                      >
                        <FolderOpen className={sidebarRailIconClass} />
                      </div>
                    </CollapsedRailHint>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-expanded={workshopStepsExpanded}
                    aria-controls="workshop-deliverables-panel"
                    title={workshopProject.name}
                    onClick={() => setWorkshopStepsExpanded((open) => !open)}
                    className={cn(
                      "flex w-full shrink-0 items-center gap-2 rounded-[var(--radius-lg)] px-2 py-2 text-left",
                      "bg-[color-mix(in_oklch,var(--primary)_14%,var(--sidebar))] text-[var(--sidebar-foreground)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_28%,transparent)]",
                      "outline-none transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_20%,var(--sidebar))] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)]",
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{workshopProject.name}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200",
                        workshopStepsExpanded ? "rotate-180" : "rotate-0",
                      )}
                      aria-hidden
                    />
                  </button>
                )}
                {rail ? (
                  <div className={cn(sidebarRailSeparatorClass, "my-1")} role="separator" aria-hidden />
                ) : null}
                {(rail || workshopStepsExpanded) ? (
                <div
                  id="workshop-deliverables-panel"
                  className={cn(
                    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                    !rail && "mt-2 px-1",
                    rail && "px-0",
                  )}
                >
                  <p
                    className={cn(
                      "mb-1.5 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]",
                      rail && "lg:hidden",
                    )}
                  >
                    Pasos del flujo
                  </p>
                  <div
                    className={cn(
                      "relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
                      rail ? "sidebar-rail-phase-scroll pb-0.5" : "px-0.5 pb-1",
                    )}
                    role="list"
                    aria-label="Pasos del workshop"
                  >
                    {!storeProject || storeProject.id !== workshopProject.id ? (
                      <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">Cargando entregables…</p>
                    ) : (
                      <div className="relative">
                        {!rail ? (
                          <span
                            className="pointer-events-none absolute bottom-1 left-[0.8125rem] top-1 w-px bg-[color-mix(in_oklch,var(--sidebar-border)_92%,transparent)]"
                            aria-hidden
                          />
                        ) : null}
                        <ul
                          className={cn(
                            "relative m-0 list-none p-0 py-0.5",
                            rail ? cn("flex flex-col items-center", sidebarRailPhaseStackGapClass) : "space-y-0.5",
                          )}
                        >
                          {workshopDeliverables.map((item) => {
                            const done = workshopTabDocHasContent(item.id, item.content);
                            const Icon = item.Icon;
                            const isCurrent = activeDocPanel === item.id;
                            return (
                              <li
                                key={item.id}
                                className={cn(
                                  "relative",
                                  !rail && "pl-5 lg:pl-6",
                                  rail && "flex justify-center py-0",
                                )}
                              >
                                {!rail && isCurrent ? (
                                  <span
                                    className="absolute left-[0.8125rem] top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sidebar)] bg-[var(--primary)] shadow-sm"
                                    aria-hidden
                                  />
                                ) : null}
                                <CollapsedRailHint
                                  rail={rail}
                                  label={
                                    done ? `${item.label} · Con contenido · ${item.title}` : `${item.label} · ${item.title}`
                                  }
                                >
                                  {rail ? (
                                    <WorkshopRailIconButton
                                      selected={isCurrent}
                                      role="listitem"
                                      title={`${item.title}${done ? " — con contenido" : ""}`}
                                      aria-current={isCurrent ? "page" : undefined}
                                      onClick={() => {
                                        closeMobileNav();
                                        onBeforeNavigateToWorkshopDoc?.();
                                        setWorkshopActiveDocPanel(item.id);
                                      }}
                                      className={cn("mx-auto", sidebarRailButtonClass)}
                                    >
                                      <span className="relative flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {done ? (
                                          <span
                                            className={cn(
                                              "pointer-events-none absolute -bottom-[3px] -right-[3px] flex h-[9px] w-[9px] items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-foreground)]",
                                              isCurrent
                                                ? "ring-1 ring-[var(--primary-foreground)]"
                                                : "ring-1 ring-[var(--sidebar)]",
                                            )}
                                            aria-hidden
                                          >
                                            <Check className="h-[5px] w-[5px]" strokeWidth={3} />
                                          </span>
                                        ) : null}
                                      </span>
                                    </WorkshopRailIconButton>
                                  ) : (
                                    <button
                                      type="button"
                                      role="listitem"
                                      title={`${item.title}${done ? " — con contenido" : ""}`}
                                      aria-current={isCurrent ? "page" : undefined}
                                      onClick={() => {
                                        closeMobileNav();
                                        onBeforeNavigateToWorkshopDoc?.();
                                        setWorkshopActiveDocPanel(item.id);
                                      }}
                                      className={cn(
                                        "mb-px flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors last:mb-0",
                                        isCurrent
                                          ? "bg-[color-mix(in_oklch,var(--sidebar-accent)_100%,transparent)] text-[var(--sidebar-accent-foreground)]"
                                          : "text-[color-mix(in_oklch,var(--muted-foreground)_96%,var(--sidebar-foreground))] hover:bg-[color-mix(in_oklch,var(--sidebar-accent)_72%,transparent)]",
                                      )}
                                    >
                                      <Icon
                                        className={cn(
                                          "h-4 w-4 shrink-0 opacity-90",
                                          isCurrent
                                            ? "text-[var(--primary)]"
                                            : "text-[color-mix(in_oklch,var(--muted-foreground)_92%,var(--sidebar-foreground))]",
                                        )}
                                        aria-hidden
                                      />
                                      <span className="min-w-0 flex-1 text-left leading-snug">{item.label}</span>
                                      {done ? (
                                        <CheckCircle2
                                          className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--success)_78%,var(--sidebar-foreground))] opacity-90"
                                          aria-hidden
                                        />
                                      ) : null}
                                    </button>
                                  )}
                                </CollapsedRailHint>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                ) : null}
              </div>
            </div>
          ) : (
            <CollapsedRailHint rail={rail} label="Proyectos">
              {rail ? (
                <WorkshopRailIconButton
                  onClick={handleScrollToProjects}
                  title="Proyectos"
                  aria-label="Proyectos"
                  aria-current="page"
                  className={cn("mx-auto lg:hidden", sidebarRailButtonClass)}
                >
                  <FolderOpen className={cn(sidebarRailIconClass, "text-[var(--primary)]")} aria-hidden />
                </WorkshopRailIconButton>
              ) : (
                <button
                  type="button"
                  onClick={handleScrollToProjects}
                  title="Proyectos"
                  className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[color-mix(in_oklch,var(--primary)_14%,var(--sidebar))] px-3 py-2.5 text-left text-sm font-medium text-[var(--sidebar-foreground)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_28%,transparent)] transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_20%,var(--sidebar))]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
                  <span>Proyectos</span>
                </button>
              )}
            </CollapsedRailHint>
          )}
        </nav>
      </div>

      <div
        className={cn(
          "mt-auto shrink-0 border-t border-[color-mix(in_oklch,var(--sidebar-border)_75%,var(--sidebar))] p-2",
          rail && cn("lg:relative lg:z-[1] lg:flex lg:flex-col lg:items-center lg:px-1.5", sidebarRailStackGapClass),
        )}
      >
        <ThemeModeToggle compact={rail} />
        <details className={cn("group/account relative", rail && "lg:w-fit")}>
          <summary
            aria-label={
              rail
                ? `Cuenta: ${getDisplayName(user)}, ${user?.email ?? ""}. Abrir menú`
                : undefined
            }
            className={cn(
              "flex cursor-pointer list-none items-center gap-3 rounded-[var(--radius-lg)] px-2 py-2 marker:content-none [&::-webkit-details-marker]:hidden",
              !rail && "hover:bg-[var(--sidebar-accent)]",
              rail && "lg:inline-flex lg:justify-center lg:p-0",
            )}
          >
            {rail ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className={sidebarAccountButtonClass}>{getUserInitials(user)}</span>
                </TooltipTrigger>
                <TooltipContent side="right" align="end" sideOffset={10} className="max-w-[14rem]">
                  <span className="block font-medium text-[var(--popover-foreground)]">{getDisplayName(user)}</span>
                  {user?.email ? (
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted-foreground)]">
                      {user.email}
                    </span>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent bg-transparent text-xs font-semibold text-[var(--primary)]"
                  aria-hidden
                >
                  {getUserInitials(user)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-[var(--sidebar-foreground)]">
                    {getDisplayName(user)}
                  </p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{user?.email || ""}</p>
                </div>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-open/account:rotate-180"
                  aria-hidden
                />
              </>
            )}
          </summary>
          <div
            className={cn(
              "absolute z-[var(--z-popover)] min-w-[10.5rem] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] py-1 text-[var(--popover-foreground)] shadow-lg",
              rail
                ? "bottom-0 left-full right-auto mb-0 ml-2 max-lg:bottom-full max-lg:left-2 max-lg:right-2 max-lg:mb-1 max-lg:ml-0"
                : "bottom-full left-2 right-2 mb-1",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--popover-foreground)] hover:bg-[var(--muted)]"
              onClick={(e) => {
                closeDetailsFromEvent(e);
                closeMobileNav();
                onOpenSettings();
              }}
            >
              <Settings className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
              Ajustes
            </button>
            {canManageUsers ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--popover-foreground)] hover:bg-[var(--muted)]"
                onClick={(e) => {
                  closeDetailsFromEvent(e);
                  closeMobileNav();
                  onOpenUsers();
                }}
              >
                <Shield className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                Usuarios
              </button>
            ) : null}
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--popover-foreground)] hover:bg-[var(--muted)]"
              onClick={(e) => {
                closeDetailsFromEvent(e);
                closeMobileNav();
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>
    </aside>
    </TooltipProvider>
    </div>
  );
}
