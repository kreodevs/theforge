import { ComponentSourceError } from "./error.js";
import type { ComponentSourcePort } from "./port.js";
import type { McpToolResult } from "./types.js";

const UNAVAILABLE_TEXT = JSON.stringify({
  error: "component_source_unavailable",
  message: "No component source configured",
});

function unavailableResult<T>(): McpToolResult<T> {
  return { content: [{ type: "text", text: UNAVAILABLE_TEXT }] };
}

/**
 * No-op implementation used when no plugin is registered or MCP is not configured.
 */
export class NullComponentSource implements ComponentSourcePort {
  async searchModules(): Promise<McpToolResult<never[]>> {
    return unavailableResult();
  }

  async resolveComponents(): Promise<McpToolResult<{ results: never[] }>> {
    return unavailableResult();
  }

  async getComponent(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async getProps(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async getCompositionRecipe(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async listModules(): Promise<McpToolResult<never[]>> {
    return unavailableResult();
  }

  async catalogHealth(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async getStyleRules(): Promise<McpToolResult<never[]>> {
    return unavailableResult();
  }

  async getDesignSystem(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async getComponentPreview(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async getComponentPreviews(): Promise<McpToolResult<never>> {
    return unavailableResult();
  }

  async checkHealth(): Promise<{ ok: false; error: string }> {
    return { ok: false, error: "Component source not configured" };
  }
}

/** Throws if callers expect a real source instead of silent null behavior. */
export function assertComponentSourceConfigured(): never {
  throw new ComponentSourceError("Component source not configured");
}
