import { useCallback, useEffect, useState, type ReactElement } from "react";
import { FileText } from "lucide-react";
import type { ArtifactTypeDefinition } from "@theforge/shared-types";
import { getPluginDocPanelHeader, parsePluginPanelId } from "../utils/workshopDocNav";
import { getPluginData, setPluginData } from "../utils/pluginApi";
import { StandardDocPanel } from "./StandardDocPanel";

interface PluginDocPanelProps {
  panel: string;
  projectId: string;
  artifactTypes: ArtifactTypeDefinition[];
}

export function PluginDocPanel({
  panel,
  projectId,
  artifactTypes,
}: PluginDocPanelProps): ReactElement | null {
  const parsed = parsePluginPanelId(panel);
  const artifact = artifactTypes.find((a) => a.id === parsed?.artifactId);
  const header = getPluginDocPanelHeader(panel, artifactTypes);

  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parsed) return;
    setLoading(true);
    getPluginData(projectId, parsed.artifactId)
      .then((data) => {
        setContent(data ? JSON.stringify(data, null, 2) : "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, parsed?.artifactId]);

  const handleSave = useCallback(async () => {
    if (!parsed) return;
    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(content);
    } catch {
      parsedData = { raw: content };
    }
    await setPluginData(projectId, parsed.artifactId, parsedData);
  }, [content, projectId, parsed]);

  if (!parsed || !artifact) return null;

  return (
    <StandardDocPanel
      icon={FileText}
      title={header.title}
      description={`Plugin: ${artifact.label}`}
      content={content}
      onContentChange={(v) => setContent(v ?? "")}
      onSave={handleSave}
      isDirty={false}
      viewMode="source"
      isLoading={loading}
      canGenerate={false}
      onGenerate={() => {}}
      placeholder={`# ${artifact.label}\n\nContenido generado por el plugin...`}
    />
  );
}