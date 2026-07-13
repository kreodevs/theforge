/**
 * API utilities for plugin artifact types and data.
 */

import type { ArtifactTypeDefinition } from "@theforge/shared-types";
import { apiFetch, API_BASE } from "./apiClient";

let cachedArtifacts: ArtifactTypeDefinition[] | null = null;

export async function fetchPluginArtifacts(): Promise<ArtifactTypeDefinition[]> {
  if (cachedArtifacts) return cachedArtifacts;
  const res = await apiFetch(`${API_BASE}/plugins/artifacts`);
  if (!res.ok) return [];
  const data: ArtifactTypeDefinition[] = await res.json();
  cachedArtifacts = data;
  return data;
}

export function clearPluginArtifactsCache(): void {
  cachedArtifacts = null;
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