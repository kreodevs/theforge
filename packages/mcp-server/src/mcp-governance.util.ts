import { parseAgentGovernanceScaffold } from "@theforge/shared-types";

export function summarizeAgentGovernanceField(raw: unknown): {
  exists: boolean;
  wordCount: number;
  content: string | null;
} {
  const text = typeof raw === "string" ? raw : "";
  const scaffold = text.trim() ? parseAgentGovernanceScaffold(text) : null;
  if (scaffold) {
    const wordCount = scaffold.files.reduce(
      (acc, file) => acc + (file.content.trim() ? file.content.trim().split(/\s+/).length : 0),
      0,
    );
    return { exists: true, wordCount, content: text };
  }
  return {
    exists: text.trim().length > 0,
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    content: text.trim().length > 0 ? text : null,
  };
}

/**
 * Compacta agent-governance para clientes con timeout bajo (OpenHands/Hermes).
 * Reemplaza contenido de archivos por metadata ({path, charCount, sizeEstimate}).
 */
export function compactifyGovernanceResponse(raw: unknown, projectId: string): unknown {
  if (raw == null || typeof raw !== "object") return raw;

  const obj = raw as Record<string, unknown>;
  if (obj.queued) return raw;

  let scaffoldStr = "";
  if (typeof obj.content === "string") {
    scaffoldStr = obj.content;
  } else if (typeof obj.agentGovernanceContent === "string") {
    scaffoldStr = obj.agentGovernanceContent;
  } else {
    return raw;
  }

  let scaffold: Record<string, unknown>;
  try {
    scaffold = JSON.parse(scaffoldStr) as Record<string, unknown>;
  } catch {
    return raw;
  }

  const files = scaffold.files as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(files)) {
    const compactFiles = files.map((f) => {
      const content = typeof f.content === "string" ? f.content : "";
      return {
        path: f.path ?? "",
        charCount: content.length,
        sizeEstimate: `${Math.round(content.length / 1024)}KB`,
      };
    });

    scaffold.files = compactFiles;
    scaffold._compact = true;
    scaffold._note =
      "Contenido completo almacenado en el servidor. Usa get_agent_governance_export para obtener el ZIP completo, o get_project_deliverables con filePath para archivos individuales.";
    scaffold._fullContentTools = {
      export_zip: `get_agent_governance_export(projectId: "${projectId}")`,
      individual_file: `get_project_deliverables(projectId: "${projectId}", filePath: "<ruta del archivo>")`,
    };
  }

  return { ...obj, content: JSON.stringify(scaffold), agentGovernanceContent: undefined, _compact: true };
}
