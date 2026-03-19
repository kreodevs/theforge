import { FalkorDB, Graph } from "falkordb";
import { MddStructured } from "../state/mdd-structured.schema.js";
import { validateSddReadQuery } from "./sdd-query-guard.js";
import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { LLMProvider, LLM_PROVIDER } from "../../ai/interfaces/llm-provider.interface.js";

@Injectable()
export class GraphMemoryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GraphMemoryService.name);
    private client: FalkorDB | null = null;
    private graph: Graph | null = null;
    private readonly graphName = "theforge_memory";

    constructor(
        @Inject(LLM_PROVIDER)
        private readonly aiProvider: LLMProvider,
    ) { }

    async onModuleInit() {
        const url =
            process.env.FALKORDB_SDD_URL ||
            process.env.FALKORDB_URL ||
            "redis://localhost:6379";
        try {
            this.client = await FalkorDB.connect({ url });
            this.graph = this.client.selectGraph(this.graphName);
            this.logger.log(`Conectado a FalkorDB en ${url}`);

            // Inicializar índices vectoriales
            await this.initializeIndices();
        } catch (err) {
            this.logger.error(`Error conectando a FalkorDB: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async initializeIndices() {
        if (!this.graph) return;
        try {
            // Dimensión: env evita llamar a la API en arranque (útil si hay 429 / cuota agotada)
            const envDim = process.env.OPENAI_EMBEDDING_DIM || process.env.EMBEDDING_DIM;
            let dim = envDim ? parseInt(envDim, 10) : 0;
            if (!dim || dim <= 0) {
                const dummy = await this.aiProvider.generateEmbedding("test");
                dim = dummy.length;
            }
            if (dim === 0) return;

            // Intentar crear índice para Proyectos (basado en título/contenido)
            try {
                await this.graph.query(`CALL db.idx.vector.create('Project', 'embedding', $dim, 'cosine')`, { params: { dim } });
                this.logger.log(`Índice vectorial creado para 'Project' con dimensión ${dim}`);
            } catch (e) {
                // Probablemente ya existe
            }

            // Índice vectorial para Decisiones (ADRs)
            try {
                await this.graph.query(`CALL db.idx.vector.create('Decision', 'embedding', $dim, 'cosine')`, { params: { dim } });
                this.logger.log(`Índice vectorial creado para 'Decision' con dimensión ${dim}`);
            } catch (e) {
                // Ya existe
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const isQuota = typeof (err as { code?: string })?.code === "string" && ((err as { code: string }).code === "insufficient_quota" || msg.includes("429") || msg.includes("quota"));
            if (isQuota) {
                this.logger.warn(
                    "OpenAI quota exceeded on startup; graph memory indices skipped. API will run but semantic search/ADRs may be limited. Check billing or use OPENAI_EMBEDDING_DIM to skip embedding call.",
                );
            } else {
                this.logger.warn(`No se pudieron inicializar índices vectoriales: ${msg}`);
            }
            // No rethrow: la API debe arrancar aunque FalkorDB/embeddings fallen
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            try {
                await this.client.close();
            } catch (err) {
                this.logger.error(`Error cerrando FalkorDB: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    /**
     * Registra un proyecto en el grafo con su embedding.
     */
    async ensureProject(projectId: string, title?: string) {
        if (!this.graph) return;
        const textToEmbed = title || projectId;
        const embedding = await this.aiProvider.generateEmbedding(textToEmbed);

        const query = `
      MERGE (p:Project {id: $id}) 
      SET p.title = $title, p.embedding = $embedding 
      RETURN p
    `;
        await this.graph.query(query, { params: { id: projectId, title: textToEmbed, embedding } });
    }

    /**
     * Reconstruye el subgrafo SDD de una etapa: Stage, MDD_Section, DB_Entity, API_Endpoint, CONSUMES, IMPLEMENTS.
     */
    async syncMddToGraph(projectId: string, stageId: string | undefined, structured: MddStructured) {
        if (!this.graph) return;
        const sid = (stageId ?? "").trim();
        if (!sid) {
            this.logger.warn(`[GraphMemory] syncMddToGraph sin stageId para proyecto ${projectId}, skip`);
            return;
        }
        this.logger.log(`[GraphMemory] Sincronizando MDD para proyecto ${projectId} stage ${sid}`);

        try {
            await this.clearStageSddSlice(projectId, sid);

            const contextSummary = structured.contextoAlcance || "";
            const textToEmbed = `${structured.title || projectId}\n${contextSummary}`.slice(0, 2000);
            const embedding = await this.aiProvider.generateEmbedding(textToEmbed);

            await this.graph.query(
                `
        MERGE (p:Project {id: $id})
        SET p.title = $title, p.embedding = $embedding
        RETURN p
      `,
                { params: { id: projectId, title: structured.title || projectId, embedding } },
            );

            await this.graph.query(
                `
        MERGE (st:Stage {id: $stageId})
        SET st.projectId = $projectId, st.updatedAt = $ts
        WITH st
        MATCH (p:Project {id: $projectId})
        MERGE (p)-[:HAS_STAGE]->(st)
        RETURN st
      `,
                { params: { stageId: sid, projectId, ts: Date.now() } },
            );

            const tableNames: string[] = [];
            if (structured.modeloDatos?.sql) {
                const tables = this.extractTablesFromSql(structured.modeloDatos.sql);
                for (const tableName of tables) {
                    tableNames.push(tableName);
                    await this.graph.query(
                        `
            MERGE (t:DB_Entity {name: $tableName, projectId: $projectId, stageId: $stageId})
            SET t.label = $tableName
            WITH t
            MATCH (st:Stage {id: $stageId})
            MERGE (st)-[:OWNS_ENTITY]->(t)
            RETURN t
          `,
                        { params: { tableName, projectId, stageId: sid } },
                    );
                }
            }

            if (structured.contratosApi?.endpoints) {
                for (const ep of structured.contratosApi.endpoints) {
                    const endpointName = `${ep.method} ${ep.path}`;
                    const eid = `${sid}:${endpointName}`;
                    await this.graph.query(
                        `
            MERGE (e:API_Endpoint {id: $id})
            SET e.projectId = $projectId, e.stageId = $stageId, e.method = $method, e.path = $path, e.description = $desc
            WITH e
            MATCH (st:Stage {id: $stageId})
            MERGE (st)-[:OWNS_ENDPOINT]->(e)
            RETURN e
          `,
                        {
                            params: {
                                id: eid,
                                method: ep.method,
                                path: ep.path,
                                desc: ep.description || "",
                                projectId,
                                stageId: sid,
                            },
                        },
                    );
                    for (const tbl of tableNames) {
                        const pathLower = (ep.path ?? "").toLowerCase();
                        const tblLower = tbl.toLowerCase();
                        if (tblLower.length < 2 || !pathLower.includes(tblLower)) continue;
                        await this.graph.query(
                            `
              MATCH (e:API_Endpoint {id: $eid})
              MATCH (t:DB_Entity {name: $tbl, projectId: $projectId, stageId: $stageId})
              MERGE (e)-[:CONSUMES]->(t)
            `,
                            { params: { eid, tbl, projectId, stageId: sid } },
                        );
                    }
                }
            }

            if (structured.seguridad) {
                for (const s of structured.seguridad) {
                    await this.graph.query(
                        `
            MERGE (r:SecurityRule {title: $title, projectId: $projectId, stageId: $stageId})
            SET r.content = $content
            WITH r
            MATCH (st:Stage {id: $stageId})
            MERGE (st)-[:GOVERNED_BY]->(r)
            RETURN r
          `,
                        {
                            params: {
                                title: s.title,
                                content: s.content.join("\n"),
                                projectId,
                                stageId: sid,
                            },
                        },
                    );
                }
            }
            await this.syncMddSectionNodes(projectId, sid, structured);
        } catch (err) {
            this.logger.error(`Error sincronizando MDD al grafo: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /** Elimina artefactos SDD previos de la etapa (reconstrucción total por ingest). */
    private async clearStageSddSlice(projectId: string, stageId: string) {
        if (!this.graph) return;
        const q = `
      MATCH (n)
      WHERE n.projectId = $projectId AND n.stageId = $stageId
        AND (n:DB_Entity OR n:API_Endpoint OR n:MDD_Section OR n:SecurityRule)
      DETACH DELETE n
    `;
        await this.graph.query(q, { params: { projectId, stageId } });
    }

    /**
     * Nodos canónicos MDD_Section bajo Stage; IMPLEMENTS conecta la etapa con cada sección.
     */
    private async syncMddSectionNodes(projectId: string, stageId: string, structured: MddStructured) {
        if (!this.graph) return;
        const slices: Array<{ sectionKey: string; title: string; summary: string }> = [];
        if (structured.contextoAlcance?.trim()) {
            slices.push({ sectionKey: "1", title: "1. Contexto", summary: structured.contextoAlcance.trim().slice(0, 4000) });
        }
        if (structured.arquitecturaStack?.trim()) {
            slices.push({ sectionKey: "2", title: "2. Arquitectura y Stack", summary: structured.arquitecturaStack.trim().slice(0, 4000) });
        }
        if (structured.modeloDatos?.sql) {
            slices.push({
                sectionKey: "3",
                title: "3. Modelo de Datos",
                summary: (structured.modeloDatos.sql + "\n" + (structured.modeloDatos.diagramaEr ?? "")).slice(0, 4000),
            });
        }
        if (structured.contratosApi?.endpoints?.length) {
            const epSummary = structured.contratosApi.endpoints.map((e) => `${e.method} ${e.path}`).join("\n");
            slices.push({ sectionKey: "4", title: "4. Contratos de API", summary: epSummary.slice(0, 4000) });
        }
        if (structured.logicaEdgeCases?.trim()) {
            slices.push({ sectionKey: "5", title: "5. Lógica y Edge Cases", summary: structured.logicaEdgeCases.trim().slice(0, 4000) });
        }
        if (structured.seguridad?.length) {
            slices.push({
                sectionKey: "6",
                title: "6. Seguridad",
                summary: structured.seguridad.map((s) => s.title + ": " + s.content.join(" ")).join("\n").slice(0, 4000),
            });
        }
        if (structured.integracion) {
            slices.push({ sectionKey: "7", title: "7. Infraestructura", summary: JSON.stringify(structured.integracion).slice(0, 4000) });
        }
        for (const s of slices) {
            const q = `
        MERGE (sec:MDD_Section {projectId: $projectId, stageId: $stageId, sectionKey: $sectionKey})
        SET sec.title = $title, sec.summary = $summary, sec.updatedAt = $ts
        WITH sec
        MATCH (st:Stage {id: $stageId})
        MERGE (st)-[:IMPLEMENTS]->(sec)
        RETURN sec
      `;
            await this.graph.query(q, {
                params: {
                    projectId,
                    stageId,
                    sectionKey: s.sectionKey,
                    title: s.title,
                    summary: s.summary,
                    ts: Date.now(),
                },
            });
        }
    }

    /**
     * Cypher de solo lectura sobre el grafo SDD (Agentic RAG).
     */
    async querySddGraphReadOnly(cypher: string, params?: Record<string, unknown>) {
        const trimmed = (cypher ?? "").trim();
        if (!trimmed) return { data: [] as unknown[] };
        validateSddReadQuery(trimmed, params);
        return this.queryKnowledge(trimmed, params as Record<string, unknown> | undefined);
    }

    /**
     * Búsqueda híbrida (GraphRAG):
     * 1. Vector Search para encontrar proyectos similares.
     * 2. Traversal para recuperar sus tablas y contratos.
     */
    async searchSimilarProjects(query: string, limit = 3) {
        if (!this.graph) return [];
        try {
            const embedding = await this.aiProvider.generateEmbedding(query);
            if (embedding.length === 0) return [];

            // Query híbrida: busca proyectos similares y trae sus artefactos
            const cypher = `
        CALL db.idx.vector.queryNodes('Project', 'embedding', $limit, $embedding)
        YIELD node AS project, score
        OPTIONAL MATCH (project)-[:HAS_STAGE]->(:Stage)-[:OWNS_ENTITY]->(t:DB_Entity)
        OPTIONAL MATCH (project)-[:HAS_STAGE]->(:Stage)-[:OWNS_ENDPOINT]->(e:API_Endpoint)
        RETURN project.id as id, project.title as title, score,
               collect(distinct t.name) as tables,
               collect(distinct e.path) as endpoints
        ORDER BY score DESC
      `;
            const result = await this.graph.query(cypher, { params: { embedding, limit } });
            return result.data;
        } catch (err) {
            this.logger.error(`Error en búsqueda similar: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }

    /**
     * Búsqueda híbrida (GraphRAG): busca por patrones en el grafo.
     */
    async queryKnowledge(cypher: string, params?: Record<string, any>) {
        if (!this.graph) return null;
        return await this.graph.query(cypher, { params });
    }

    /**
     * Registra una decisión arquitectónica (ADR) en el grafo.
     */
    async saveDecision(projectId: string, decision: { title: string, context: string, consequence: string, status?: string }) {
        if (!this.graph) return;
        this.logger.log(`[GraphMemory] Guardando decisión ADR: ${decision.title}`);

        try {
            const textToEmbed = `${decision.title}\n${decision.context}\n${decision.consequence}`.slice(0, 2000);
            const embedding = await this.aiProvider.generateEmbedding(textToEmbed);

            const query = `
        MATCH (p:Project {id: $projectId})
        MERGE (d:Decision {id: $id, projectId: $projectId})
        SET d.title = $title, 
            d.context = $context, 
            d.consequence = $consequence, 
            d.status = $status,
            d.embedding = $embedding
        MERGE (p)-[:MADE_DECISION]->(d)
        RETURN d
      `;
            await this.graph.query(query, {
                params: {
                    id: `${projectId}:${decision.title.replace(/\s+/g, "_").toLowerCase()}`,
                    projectId,
                    title: decision.title,
                    context: decision.context,
                    consequence: decision.consequence,
                    status: decision.status || "Accepted",
                    embedding
                }
            });
        } catch (err) {
            this.logger.error(`Error guardando decisión ADR: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Búsqueda híbrida de decisiones pasadas.
     */
    async searchSimilarDecisions(query: string, limit = 5) {
        if (!this.graph) return [];
        try {
            const embedding = await this.aiProvider.generateEmbedding(query);
            if (embedding.length === 0) return [];

            const cypher = `
        CALL db.idx.vector.queryNodes('Decision', 'embedding', $limit, $embedding)
        YIELD node AS decision, score
        MATCH (p:Project)-[:MADE_DECISION]->(decision)
        RETURN decision.title as title, 
               decision.context as context, 
               decision.consequence as consequence,
               decision.status as status,
               p.title as projectTitle,
               score
        ORDER BY score DESC
      `;
            const result = await this.graph.query(cypher, { params: { embedding, limit } });
            return result.data;
        } catch (err) {
            this.logger.error(`Error en búsqueda de decisiones: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }

    /**
     * Obtiene todas las decisiones (ADRs) asociadas a un proyecto específico.
     */
    async getDecisionsByProject(projectId: string) {
        if (!this.graph) return [];
        try {
            const cypher = `
                MATCH (p:Project {id: $projectId})-[:MADE_DECISION]->(d:Decision)
                RETURN d.title as title, 
                       d.context as context, 
                       d.consequence as consequence,
                       d.status as status,
                       p.title as projectTitle
                ORDER BY d.title ASC
            `;
            const result = await this.graph.query(cypher, { params: { projectId } });
            return result.data;
        } catch (err) {
            this.logger.error(`Error obteniendo decisiones del proyecto ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }

    /**
     * Helper simple para extraer nombres de tablas de un bloque SQL.
     */
    private extractTablesFromSql(sql: string): string[] {
        const tableNames: string[] = [];
        const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)/gi;
        let match;
        while ((match = regex.exec(sql)) !== null) {
            if (match[1]) {
                const clean = match[1].replace(/["']/g, "");
                tableNames.push(clean);
            }
        }
        return [...new Set(tableNames)];
    }
}
