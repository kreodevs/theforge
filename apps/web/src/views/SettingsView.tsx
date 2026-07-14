import { useEffect, useMemo, useState } from "react";
import { BookOpen, Cable, LayoutTemplate, Puzzle, Settings, Shield, Sparkles } from "lucide-react";
import { ProviderInstancesCard } from "@/components/ProviderInstancesCard";
import { AccountConfigCard } from "@/components/AccountConfigCard";
import { AriadneConfigCard } from "@/components/AriadneConfigCard";
import { TechDocsConfigCard } from "@/components/TechDocsConfigCard";
import { UiMcpInstancesCard } from "@/components/UiMcpInstancesCard";
import { PluginSettingsSection } from "@/components/PluginSettingsSection";
import { UnderlineTabs, type UnderlineTabItem } from "@/components/ui/UnderlineTabs";
import { getStoredUser } from "@/utils/apiClient";

type SettingsTab = "providers" | "plugins" | "ariadne" | "tech-docs" | "ui-mcp" | "account";

const BASE_SETTINGS_TABS: UnderlineTabItem<SettingsTab>[] = [
  { id: "providers", label: "Proveedores de IA", shortLabel: "Proveedores", icon: Sparkles },
  { id: "plugins", label: "Plugins", shortLabel: "Plugins", icon: Puzzle },
  { id: "ariadne", label: "Ariadne", shortLabel: "Ariadne", icon: Cable },
  { id: "tech-docs", label: "Docs técnicas", shortLabel: "Docs", icon: BookOpen },
  { id: "ui-mcp", label: "MCP gráfico", shortLabel: "MCP gráfico", icon: LayoutTemplate },
  { id: "account", label: "Cuenta", shortLabel: "Cuenta", icon: Shield },
];

interface SettingsViewProps {
  showIaCost: boolean;
  onToggleIaCost: () => void;
}

/** Vista de ajustes (proveedores IA, Ariadne, cuenta). Renderizada dentro del layout con sidebar (`App.tsx`). */
export default function SettingsView({ showIaCost, onToggleIaCost }: SettingsViewProps) {
  const isDeveloper = getStoredUser()?.role === "developer";
  const visibleTabs = useMemo(() => {
    if (isDeveloper) {
      return BASE_SETTINGS_TABS.filter((tab) => tab.id === "account");
    }
    return BASE_SETTINGS_TABS;
  }, [isDeveloper]);
  const [activeTab, setActiveTab] = useState<SettingsTab>(isDeveloper ? "account" : "providers");

  useEffect(() => {
    if (isDeveloper && activeTab !== "account") {
      setActiveTab("account");
    }
  }, [activeTab, isDeveloper]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-[min(100%,88rem)] shrink-0 px-4 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-4xl space-y-4 pb-4 sm:space-y-6 sm:pb-6">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--primary)] sm:text-3xl">
              <Settings className="h-8 w-8 shrink-0" />
              Ajustes
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)] sm:text-base">
              {isDeveloper
                ? "Token MCP y preferencias de tu cuenta"
                : "Proveedores de IA, Ariadne, documentación técnica y cuenta"}
            </p>
          </div>

          {visibleTabs.length > 1 ? (
            <UnderlineTabs
              tabs={visibleTabs}
              value={activeTab}
              onValueChange={setActiveTab}
              ariaLabel="Secciones de ajustes"
              idPrefix="settings"
            />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[min(100%,88rem)] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-4xl space-y-6">
            <div
              id="settings-panel-providers"
              role="tabpanel"
              aria-labelledby="settings-tab-providers"
              hidden={activeTab !== "providers"}
              className={activeTab === "providers" ? "space-y-6" : undefined}
            >
              {activeTab === "providers" ? <ProviderInstancesCard /> : null}
            </div>

            <div
              id="settings-panel-plugins"
              role="tabpanel"
              aria-labelledby="settings-tab-plugins"
              hidden={activeTab !== "plugins"}
              className={activeTab === "plugins" ? "space-y-6" : undefined}
            >
              {activeTab === "plugins" ? <PluginSettingsSection /> : null}
            </div>

            <div
              id="settings-panel-ariadne"
              role="tabpanel"
              aria-labelledby="settings-tab-ariadne"
              hidden={activeTab !== "ariadne"}
              className={activeTab === "ariadne" ? "space-y-6" : undefined}
            >
              {activeTab === "ariadne" ? <AriadneConfigCard /> : null}
            </div>

            <div
              id="settings-panel-tech-docs"
              role="tabpanel"
              aria-labelledby="settings-tab-tech-docs"
              hidden={activeTab !== "tech-docs"}
              className={activeTab === "tech-docs" ? "space-y-6" : undefined}
            >
              {activeTab === "tech-docs" ? <TechDocsConfigCard /> : null}
            </div>

            <div
              id="settings-panel-ui-mcp"
              role="tabpanel"
              aria-labelledby="settings-tab-ui-mcp"
              hidden={activeTab !== "ui-mcp"}
              className={activeTab === "ui-mcp" ? "space-y-6" : undefined}
            >
              {activeTab === "ui-mcp" ? <UiMcpInstancesCard /> : null}
            </div>

            <div
              id="settings-panel-account"
              role="tabpanel"
              aria-labelledby="settings-tab-account"
              hidden={activeTab !== "account"}
              className={activeTab === "account" ? "space-y-6" : undefined}
            >
              {activeTab === "account" ? (
                <AccountConfigCard
                  showIaCost={showIaCost}
                  onToggleIaCost={onToggleIaCost}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
