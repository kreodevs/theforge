/**
 * Plugin stub para validar el motor genérico (hooks + generateArtifact).
 * No contiene lógica comercial — solo para desarrollo/CI.
 */

export interface PluginContext {
  logger: { log: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}

export interface AfterDocumentRenderPayload {
  documentType: string;
  projectId: string;
  rawContent: string;
  parsedContent: unknown;
  originalContext: unknown;
}

export interface PluginArtifactContext {
  pluginId: string;
  artifactId: string;
  projectId: string;
  userId: string;
  deliverables: Record<string, string | null | undefined>;
  userSettings: Record<string, unknown>;
  timestamp: Date;
}

export default class StubTheForgePlugin {
  readonly id = "dev.theforge.stub-plugin";
  readonly version = "1.0.0";
  readonly name = "Stub Plugin";
  readonly description = "Motor de plugins — demo report + hook spec";

  async onPluginInit(ctx: PluginContext): Promise<void> {
    ctx.logger.log("Stub plugin initialized");
  }

  getArtifactTypes() {
    return [
      {
        id: "demo-report",
        label: "Demo Report",
        icon: "FileText",
        showInSidebar: true,
        generatable: true,
      },
    ];
  }

  async generateArtifact(ctx: PluginArtifactContext) {
    return {
      data: {
        artifactId: ctx.artifactId,
        projectId: ctx.projectId,
        generatedAt: ctx.timestamp.toISOString(),
        userId: ctx.userId,
        specPreview: (ctx.deliverables.specContent ?? "").slice(0, 240),
        message: "Generado por stub-plugin (motor genérico)",
      },
      metadata: {
        provider: "stub",
        model: "none",
      },
    };
  }

  afterDocumentRender(payload: AfterDocumentRenderPayload): AfterDocumentRenderPayload {
    if (payload.documentType !== "spec") return payload;
    const marker = "\n\n<!-- stub-plugin:afterDocumentRender -->";
    if (payload.rawContent.includes(marker)) return payload;
    return { ...payload, rawContent: `${payload.rawContent}${marker}` };
  }
}
