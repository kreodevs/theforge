import type { MddStructured } from "../state/mdd-structured.schema.js";
import { markdownToMddStructured } from "../utils/mdd-markdown-to-structured.js";
import { extractTableRefsFromSql } from "./sdd-consumes-link.util.js";

export type MddGraphExpectations = {
  expectedEntities: number;
  expectedEndpoints: number;
  structured: MddStructured;
};

/** Artefactos §3/§4 indexables que el grafo SDD debería reflejar. */
export function parseMddGraphExpectations(mddMarkdown: string): MddGraphExpectations {
  const structured = markdownToMddStructured(mddMarkdown ?? "");
  const tables = extractTableRefsFromSql(structured.modeloDatos?.sql ?? "");
  const endpoints = structured.contratosApi?.endpoints ?? [];
  return {
    expectedEntities: tables.length,
    expectedEndpoints: endpoints.length,
    structured,
  };
}
