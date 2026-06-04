import type { ComponentSourcePort } from "@theforge/component-source";
import {
  unwrapMcpToolText,
  validateCatalogListText,
  type CatalogListValidation,
} from "../ai-analysis/utils/wireframes-mcp-resolve.util.js";

/** Calls catalog.list on a port and validates module ids are present. */
export async function probeCatalogList(
  port: ComponentSourcePort,
  userId: string,
): Promise<CatalogListValidation> {
  const result = await port.listModules(userId);
  const text = unwrapMcpToolText(result);
  return validateCatalogListText(text);
}
