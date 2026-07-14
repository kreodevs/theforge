/**
 * API utilities for plugin artifact types and data.
 */

import type {
  ArtifactTypeDefinition,
  PluginSettingsPanelDefinition,
  PluginUserSettingsMap,
} from "@theforge/shared-types";
import { apiFetch, API_BASE } from "./apiClient";

let cachedArtifacts: ArtifactTypeDefinition[] | null = null;
let cachedSettingsPanels: PluginSettingsPanelDefinition[] | null = null;

export async function fetchPluginArtifacts(): Promise<ArtifactTypeDefinition[]> {
  if (cachedArtifacts) return cachedArtifacts;
  const res = await apiFetch(`${API_BASE}/plugins/artifacts`);
  if (!res.ok) return [];
  const data: ArtifactTypeDefinition[] = await res.json();
  cachedArtifacts = data;
  return data;
}

export async function fetchPluginSettingsPanels(): Promise<PluginSettingsPanelDefinition[]> {
  if (cachedSettingsPanels) return cachedSettingsPanels;
  const res = await apiFetch(`${API_BASE}/plugins/settings-panels`);
  if (!res.ok) return [];
  const data: PluginSettingsPanelDefinition[] = await res.json();
  cachedSettingsPanels = data;
  return data;
}

export function clearPluginArtifactsCache(): void {
  cachedArtifacts = null;
  cachedSettingsPanels = null;
}

export async function fetchPluginUserSettings(
  pluginId: string,
): Promise<Record<string, unknown>> {
  const encoded = encodeURIComponent(pluginId);
  const res = await apiFetch(`${API_BASE}/plugins/${encoded}/user-settings`);
  if (!res.ok) return {};
  return res.json();
}

export async function savePluginUserSettings(
  pluginId: string,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const encoded = encodeURIComponent(pluginId);
  const res = await apiFetch(`${API_BASE}/plugins/${encoded}/user-settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.message === "string" ? err.message : "No se pudieron guardar los ajustes del plugin",
    );
  }
  return res.json();
}

export async function fetchAllPluginUserSettings(): Promise<PluginUserSettingsMap> {
  const res = await apiFetch(`${API_BASE}/plugins/user-settings`);
  if (!res.ok) return {};
  return res.json();
}

export async function getPluginData(
  projectId: string,
  pluginId: string,
): Promise<unknown> {
  const res = await apiFetch(
    `${API_BASE}/plugins/projects/${projectId}/plugin-data/${pluginId}`,
  );
  if (!res.ok) return null;
  return res.json();
}

export async function setPluginData(
  projectId: string,
  pluginId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const res = await apiFetch(
    `${API_BASE}/plugins/projects/${projectId}/plugin-data/${pluginId}`,
    { method: "PUT", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } },
  );
  if (!res.ok) throw new Error("Failed to save plugin data");
  return res.json();
}