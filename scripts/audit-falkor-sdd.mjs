#!/usr/bin/env node
/**
 * Audita conectividad Falkor SDD y compara grafo vs MDD (§3 tablas, §4 endpoints).
 * Uso: node scripts/audit-falkor-sdd.mjs [--project-id UUID] [--stage-id UUID] [--mdd-file path]
 */
import { readFileSync } from "node:fs";
import { FalkorDB } from "falkordb";

const GRAPH = "theforge_memory";
const url =
  process.env.FALKORDB_SDD_URL ||
  process.env.FALKORDB_URL ||
  "redis://localhost:6380";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { projectId: "", stageId: "", mddFile: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-id") out.projectId = args[++i] ?? "";
    if (args[i] === "--stage-id") out.stageId = args[++i] ?? "";
    if (args[i] === "--mdd-file") out.mddFile = args[++i] ?? "";
  }
  return out;
}

function extractTablesFromSql(sql) {
  const names = [];
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-zA-Z0-9_]+)/gi)) {
    names.push(m[1].toLowerCase());
  }
  return [...new Set(names)];
}

function extractEndpointsFromMdd(mdd) {
  const fromTable = [];
  for (const m of mdd.matchAll(/\|\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\|\s*`([^`]+)`/gi)) {
    fromTable.push({ method: m[1].toUpperCase(), path: m[2].trim() });
  }
  const fromLines = [];
  for (const m of mdd.matchAll(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s\n]+)/gim)) {
    fromLines.push({ method: m[1].toUpperCase(), path: m[2].trim() });
  }
  const merged = fromTable.length > 0 ? fromTable : fromLines;
  const seen = new Set();
  return merged.filter((e) => {
    const k = `${e.method} ${e.path}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function getSectionBody(draft, headingPattern) {
  const match = draft.match(headingPattern);
  if (!match) return null;
  const start = draft.indexOf(match[0]) + match[0].length;
  const rest = draft.slice(start).replace(/^\s*\n+/, "");
  const nextH2 = rest.search(/\n##\s+/);
  return nextH2 !== -1 ? rest.slice(0, nextH2).trim() : rest.trim();
}

function parseMddArtifacts(mdd) {
  const s3 = getSectionBody(mdd, /##\s*3\.\s*Modelo\s+(?:de\s+)?datos/i) ?? "";
  const sql = (s3.match(/```sql\s*([\s\S]*?)```/i)?.[1] ?? "").trim();
  const tables = extractTablesFromSql(sql);
  const endpoints = extractEndpointsFromMdd(mdd);
  return { tables, endpoints, sqlLen: sql.length };
}

async function queryGraph(graph, cypher, params) {
  const res = await graph.query(cypher, { params });
  return res?.data ?? [];
}

async function auditGraph(graph, projectId, stageId) {
  const params = { projectId, stageId };
  const [entities, endpoints, orphanEp, orphanEnt, legacyStages, projects] = await Promise.all([
    queryGraph(
      graph,
      `MATCH (t:DB_Entity) WHERE t.projectId = $projectId AND t.stageId = $stageId RETURN t.name AS name ORDER BY name`,
      params,
    ),
    queryGraph(
      graph,
      `MATCH (e:API_Endpoint) WHERE e.projectId = $projectId AND e.stageId = $stageId RETURN e.method AS method, e.path AS path ORDER BY path`,
      params,
    ),
    queryGraph(
      graph,
      `MATCH (e:API_Endpoint) WHERE e.projectId = $projectId AND e.stageId = $stageId AND NOT (e)-[:CONSUMES]->(:DB_Entity) RETURN e.method AS method, e.path AS path`,
      params,
    ),
    queryGraph(
      graph,
      `MATCH (t:DB_Entity) WHERE t.projectId = $projectId AND t.stageId = $stageId AND NOT (:API_Endpoint)-[:CONSUMES]->(t) RETURN t.name AS name`,
      params,
    ),
    queryGraph(
      graph,
      `MATCH (s:LegacyStage {stageId: $stageId}) OPTIONAL MATCH (s)-[:DERIVED_FROM]->(p:LegacyStage) RETURN s.name AS name, p.stageId AS parentStageId`,
      { stageId },
    ),
    queryGraph(graph, `MATCH (p:Project {id: $projectId}) RETURN p.title AS title`, { projectId }),
  ]);

  return {
    projectNode: projects[0] ?? null,
    entityNames: entities.map((r) => String(r.name ?? "").toLowerCase()).filter(Boolean),
    endpoints: endpoints.map((r) => ({
      method: String(r.method ?? "").toUpperCase(),
      path: String(r.path ?? ""),
    })),
    orphanEndpoints: orphanEp,
    orphanEntities: orphanEnt,
    legacyStage: legacyStages[0] ?? null,
  };
}

function diffSets(expected, actual, label) {
  const exp = new Set(expected);
  const act = new Set(actual);
  const missing = [...exp].filter((x) => !act.has(x));
  const extra = [...act].filter((x) => !exp.has(x));
  return { label, expected: exp.size, actual: act.size, missing: missing.slice(0, 15), extra: extra.slice(0, 15) };
}

async function main() {
  const { projectId, stageId, mddFile } = parseArgs();
  let mdd = "";
  if (mddFile) {
    const raw = readFileSync(mddFile, "utf8");
    try {
      const j = JSON.parse(raw);
      mdd = j.mddContent ?? raw;
      if (!projectId && j.id) console.log(`projectId from file: ${j.id}`);
      if (!stageId && j.activeStageId) console.log(`stageId from file: ${j.activeStageId}`);
    } catch {
      mdd = raw;
    }
  }

  const pid = projectId || process.env.AUDIT_PROJECT_ID || "";
  const sid = stageId || process.env.AUDIT_STAGE_ID || "";

  console.log("=== Falkor SDD audit ===");
  console.log(`FALKOR URL: ${url}`);
  console.log(`Graph: ${GRAPH}`);
  console.log(`Project: ${pid || "(none)"}`);
  console.log(`Stage: ${sid || "(none)"}`);

  let client;
  try {
    client = await FalkorDB.connect({ url });
    const graph = client.selectGraph(GRAPH);
    await graph.query("RETURN 1 AS ok");
    console.log("\n[OK] FalkorDB reachable");

    const stats = await queryGraph(
      graph,
      `MATCH (n) WHERE n.projectId IS NOT NULL RETURN labels(n)[0] AS label, count(*) AS c ORDER BY c DESC LIMIT 12`,
      {},
    );
    console.log("\nNodos con projectId (top labels):");
    for (const row of stats) console.log(`  ${row.label}: ${row.c}`);

    if (pid && sid) {
      const g = await auditGraph(graph, pid, sid);
      console.log("\n--- Grafo etapa ---");
      console.log(`Project node: ${g.projectNode?.title ?? "(missing)"}`);
      console.log(`DB_Entity: ${g.entityNames.length}`);
      console.log(`API_Endpoint: ${g.endpoints.length}`);
      console.log(`Huérfanos endpoint→entidad: ${g.orphanEndpoints.length}`);
      console.log(`Huérfanos entidad sin consumidor: ${g.orphanEntities.length}`);
      if (g.legacyStage) console.log(`LegacyStage: ${JSON.stringify(g.legacyStage)}`);

      if (mdd.length > 500) {
        const parsed = parseMddArtifacts(mdd);
        const epKeys = parsed.endpoints.map((e) => `${e.method} ${e.path}`);
        const graphEpKeys = g.endpoints.map((e) => `${e.method} ${e.path}`);
        const tableDiff = diffSets(parsed.tables, g.entityNames, "tablas §3");
        const epDiff = diffSets(epKeys, graphEpKeys, "endpoints §4");
        console.log("\n--- MDD vs Falkor ---");
        console.log(`MDD SQL len: ${parsed.sqlLen}, tablas parseadas: ${parsed.tables.length}, endpoints: ${parsed.endpoints.length}`);
        console.log(`Tablas: expected=${tableDiff.expected} graph=${tableDiff.actual} missing=${tableDiff.missing.length} extra=${tableDiff.extra.length}`);
        if (tableDiff.missing.length) console.log(`  missing sample: ${tableDiff.missing.join(", ")}`);
        if (tableDiff.extra.length) console.log(`  extra sample: ${tableDiff.extra.join(", ")}`);
        console.log(`Endpoints: expected=${epDiff.expected} graph=${epDiff.actual} missing=${epDiff.missing.length} extra=${epDiff.extra.length}`);
        if (epDiff.missing.length) console.log(`  missing sample: ${epDiff.missing.slice(0, 5).join(" | ")}`);
        if (epDiff.extra.length) console.log(`  extra sample: ${epDiff.extra.slice(0, 5).join(" | ")}`);

        const coherent =
          parsed.tables.length > 0 &&
          parsed.endpoints.length > 0 &&
          g.entityNames.length > 0 &&
          g.endpoints.length > 0 &&
          g.orphanEndpoints.length === 0 &&
          g.orphanEntities.length === 0;
        console.log(`\nSemáforo graph relief (heurística): ${coherent ? "sddDomainGraphOk=true" : "sddDomainGraphOk=false"}`);
        const stale =
          Math.abs(parsed.tables.length - g.entityNames.length) > 2 ||
          Math.abs(parsed.endpoints.length - g.endpoints.length) > 2;
        console.log(`Grafo desincronizado vs MDD: ${stale ? "SÍ (re-ingestar recomendado)" : "NO / tolerable"}`);
      } else if (!mddFile) {
        console.log("\n(Pasa --mdd-file con get_project JSON para comparar §3/§4)");
      }
    } else {
      console.log("\n(Pasa --project-id y --stage-id para auditar una etapa)");
    }
  } catch (err) {
    console.error(`\n[FAIL] FalkorDB: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    if (client) await client.close();
  }
}

main();
