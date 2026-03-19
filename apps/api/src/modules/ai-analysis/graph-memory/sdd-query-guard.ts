/**
 * Validación de consultas Cypher de solo lectura acotadas a un proyecto (Grafo SDD).
 * El MCP de TheForge y el acceso HTTP a TheForge son ajenos: esto aplica solo a FalkorDB local (TheForge).
 */

const FORBIDDEN = [
  "CREATE ",
  "DELETE ",
  "MERGE ",
  "SET ",
  "REMOVE ",
  "DROP ",
  "DETACH ",
  "LOAD CSV",
] as const;

export function validateSddReadQuery(cypher: string, params?: Record<string, unknown>): void {
  const trimmed = (cypher ?? "").trim();
  if (!trimmed) throw new Error("Cypher vacío");
  const upper = trimmed.toUpperCase();
  for (const f of FORBIDDEN) {
    if (upper.includes(f)) {
      throw new Error(`Consulta no permitida (solo lectura): contiene «${f.trim()}»`);
    }
  }
  const pid = params?.projectId;
  const sid = params?.stageId;
  const hasProject = typeof pid === "string" && !!pid.trim();
  const hasStage = typeof sid === "string" && !!sid.trim();
  if (!hasProject && !hasStage) {
    throw new Error(
      "La consulta SDD requiere params.projectId o params.stageId para acotar el grafo documental.",
    );
  }
}
