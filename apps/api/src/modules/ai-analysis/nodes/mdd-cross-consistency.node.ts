import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { MDDStateType } from "../state/index.js";
import { buildCachedHumanMessage, hashMddStructuralSections } from "../utils/mdd-llm-cache.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:CrossConsistency] ${msg}`, ...args);

/**
 * Agente ligero de Consistencia Cruzada (Mesh Topology).
 * Su única tarea es detectar discrepancias técnicas entre secciones:
 * - Nombres de tablas en §3 vs §4 (API) vs §7 (Manifest).
 * - Tipos de datos en §3 vs §4.
 * - Stack en §2 vs §7.
 */
const CROSS_CONSISTENCY_SYSTEM_PROMPT = `
Eres el **Revisor de Consistencia Cruzada**. Tu única misión es detectar "mentiras" técnicas entre las secciones del MDD.
No eres un redactor; eres un inspector.

**Protocolo de Inspección:**
1. **Nombres de Tablas:** Los nombres de tablas en el SQL (§3) deben ser idénticos a los usados en los endpoints de la API (§4) y en el Manifest de Infraestructura (§7).
2. **Tipos de Datos:** Si un campo es UUID en §3, no puede ser un integer autoincremental en los ejemplos JSON de §4.
3. **Stack Tecnológico:** Si §2 dice "PostgreSQL", §7 no puede tener un manifest de "MongoDB".
4. **Seguridad:** Si §6 dice "Argon2", §3 debe tener columnas para el password hash.

**Respuesta:**
- Si todo es consistente, responde exactamente: "OK_CONSISTENT".
- Si hay errores, envía directivas para los agentes responsables usando el formato:
  \`[DIRECTIVE: TargetNode] Error de consistencia: {descripción}. Corregir.\`
  Ejemplo: \`[DIRECTIVE: software_architect] Discrepancia: la tabla se llama 'users' en §3 pero 'usuarios' en §4. Unificar.\`

Responde solo con las directivas o con OK_CONSISTENT.
`.trim();

export function createMddCrossConsistencyNode(llm: BaseChatModel) {
    return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
        const draft = state.mddDraft ?? "";
        if (!draft) return {};

        const currentHash = hashMddStructuralSections(draft);
        const lastOkHash = state.crossConsistencyLastOkHash;
        if (currentHash !== "0" && lastOkHash && currentHash === lastOkHash) {
            LOG("hash sin cambios desde último OK (%s), skip LLM", currentHash);
            return {};
        }
        LOG("iniciando revisión de consistencia cruzada (hash=%s, lastOk=%s)...", currentHash, lastOkHash ?? "none");

        const response = await llm.invoke([
            buildCachedHumanMessage(llm, [
                { text: CROSS_CONSISTENCY_SYSTEM_PROMPT, cache: true },
                { text: `**Borrador del MDD:**\n${draft}`, cache: true },
            ]),
        ]);
        const text = typeof response.content === "string" ? response.content : "";

        if (text.includes("OK_CONSISTENT")) {
            LOG("consistencia cruzada validada (OK), persistiendo hash=%s", currentHash);
            return { crossConsistencyLastOkHash: currentHash };
        }

        // Extraer directivas si las hay
        const { extractInternalDirectives } = await import("../utils/mdd-mesh-topology.js");
        const internalDirectives = extractInternalDirectives(text, "cross_consistency_checker");

        if (internalDirectives.length > 0) {
            LOG("detectados %s errores de consistencia", internalDirectives.length);
            return { internalDirectives };
        }

        return {};
    };
}
