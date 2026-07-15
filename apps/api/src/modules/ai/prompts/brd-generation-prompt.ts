import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDocumentChangelogInstructions } from "./with-document-changelog-instructions.js";
const PROMPT_PATH = join(__dirname, "brd-generation-prompt.md");

function loadBrdGenerationSystemPrompt(): string {
  try {
    return withDocumentChangelogInstructions(readFileSync(PROMPT_PATH, "utf-8").trim());
  } catch {
    return withDocumentChangelogInstructions(
      "Eres Lead Product Manager senior. Genera BRD 100 % de negocio en markdown desde el documento fuente. " +
        "Prohibido HTTP, endpoints, JSON, tablas SQL e infraestructura. Traduce lo técnico a lenguaje corporativo. " +
        "Usa «No aplica» con motivo para herramientas internas; «Por validar» solo con entrada en decision log.",
    );
  }
}

export const BRD_GENERATION_SYSTEM = loadBrdGenerationSystemPrompt();

export type BrdGenerationMode = "greenfield-from-dbga" | "legacy-as-is" | "legacy-change";

export const BRD_CHAT_REFINE_BUSINESS_RULES =
  "**BRD 100 % negocio:** Prohibido métodos HTTP, rutas `/api/...`, payloads JSON, tipos SQL, nombres de tablas, tokens M2M/JWKS y detalle de infra. " +
  "Traduce lo técnico a lenguaje corporativo (procesos, políticas, entidades de negocio, UAT). " +
  "Estructura: Contexto → Usuarios → Capacidades → **Diagramas Mermaid (§4: ecosistema, ER de negocio, 2–3 flujos críticos)** → Alcance → Reglas → Experiencia → Riesgos. " +
  "§4: **exactamente** un fence ` ```mermaid … ``` ` por diagrama (mín. 4 bloques). **Prohibido** `flowchart`/`erDiagram`/`sequenceDiagram`/`stateDiagram-v2` como texto plano; **prohibido** aristas en listas `- A --> B` fuera del fence.";

/** Contrato de salida Mermaid — va en user prompt y en reintentos de generación. */
export const BRD_MERMAID_OUTPUT_CONTRACT = `# Contrato de salida Mermaid (§4) — OBLIGATORIO

El Workshop **solo renderiza** diagramas dentro de fences \`\`\`mermaid. Copia esta estructura literal en §4:

### 4.1 Arquitectura de integración (el ecosistema)

\`\`\`mermaid
flowchart LR
  subgraph ORIGEN["Sistemas Origen"]
    SRC["Sistema origen A"]
  end
  subgraph CORE["Capacidad central"]
    CAT["Servicio / catálogo core"]
  end
  SRC -->|"Sincronización de datos"| CAT
\`\`\`

### 4.2 Diagrama entidad-relación (estructura de datos de negocio)

\`\`\`mermaid
erDiagram
  ENTIDAD_A {
    string nombre
    decimal valor
  }
  ENTIDAD_B {
    string nombre
  }
  ENTIDAD_A }o--o{ ENTIDAD_B : "relacionada con"
\`\`\`

### 4.3 Flujos críticos

#### Flujo 1: [nombre]

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Procesando: evento
  Procesando --> Idle: fin
\`\`\`

**Anti-patrones PROHIBIDOS (rompen el render y serán rechazados):**
- \`flowchart LR\` o \`erDiagram\` **sin** fence \`\`\`mermaid
- Aristas como listas markdown: \`- SRC -->|"sync"| CAT\` **fuera** del bloque
- Partir un diagrama en dos fences o cerrar el fence antes de las aristas

**Listas markdown (-, *, numeradas)** solo en prosa de negocio (§1–§3, §5–§8), **nunca** para conexiones de diagrama.`;

export function buildBrdGenerationRetryReminder(opts: {
  delimiterRetry?: boolean;
  mermaidRetry?: boolean;
  mermaidHint?: string;
}): string {
  const parts: string[] = [];
  if (opts.delimiterRetry) {
    parts.push(
      "**IMPORTANTE — delimitadores:** Responde ÚNICAMENTE con:\n<<<BRD>>>\n(markdown BRD completo)\n<<<END_BRD>>>\nSin texto antes ni después.",
    );
  }
  if (opts.mermaidRetry) {
    parts.push(
      "**IMPORTANTE — diagramas §4:** La salida anterior no cumplió el contrato Mermaid. " +
        "Incluye **al menos 4** bloques ` ```mermaid ` (§4.1 ecosistema, §4.2 ER, §4.3 dos o tres flujos). " +
        "Todas las aristas, relaciones, participantes y transiciones **dentro** del fence, **sin** listas `- A --> B` fuera del bloque. " +
        "No emitas `flowchart`/`erDiagram`/`sequenceDiagram`/`stateDiagram-v2` como texto plano.",
    );
    if (opts.mermaidHint?.trim()) {
      parts.push(`Problemas detectados: ${opts.mermaidHint.trim()}`);
    }
    parts.push(BRD_MERMAID_OUTPUT_CONTRACT);
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

const BRD_DELIMITERS =
  "Responde **solo** con este formato exacto (delimitadores literales):\n" +
  "<<<BRD>>>\n(markdown BRD completo)\n<<<END_BRD>>>\n";

/** Plantilla de secciones — BRD orientado a negocio; sin detalle técnico. */
export const BRD_SECTION_OUTLINE = `## Estructura obligatoria del BRD (usa estos títulos en español)

# BRD — [nombre del producto o iniciativa]

## 1. Contexto y Objetivos

### Problema de negocio
Qué dolor resuelve la iniciativa; quién lo sufre; frecuencia e impacto. Tabla opcional: | Dolor | Quién lo siente | Impacto | Workaround actual |

### Objetivos comerciales
Qué debe lograr el producto en términos de negocio (KPIs, eficiencia comercial, control de márgenes, etc.).

### Impacto financiero — Costo de la inacción
Estimado mensual/anual de pérdida o ineficiencia si no se construye; si no hay dato, supuesto numerado + «Por validar» en decision log.

### Validación de demanda
Señales de mercado o **No aplica — [motivo]** si es desarrollo interno.

## 2. Usuarios y Casos de Uso

### Roles de negocio
Perfiles (comercial, trade, gerencia, operaciones, finanzas, admin); tamaño de organización; concurrencia estimada en lenguaje de negocio (usuarios simultáneos por rol).

### Casos de uso clave
2–4 personas; 1–3 casos por capacidad crítica: **Actor → Necesidad → Resultado de negocio** (sin mencionar pantallas técnicas salvo que el fuente lo exija como flujo comercial).

## 3. Capacidades Funcionales del Producto

Describir **qué puede hacer el sistema** como **procesos de negocio** (cotizar, calcular precio, solicitar autorización, sincronizar costos desde ERP, auditar decisiones). Subsecciones ### por capacidad. **Prohibido** nombrar módulos de software, endpoints o tablas.

## 4. Diagramas de referencia (Mermaid)

Diagramas **obligatorios** en lenguaje de negocio (sin HTTP, tablas SQL ni payloads). El documento se renderiza con Mermaid.

### 4.1 Arquitectura de integración (el ecosistema)
Un bloque \`\`\`mermaid con \`flowchart LR\` o \`flowchart TB\`: sistemas externos (ERP, legacy, servicios corporativos), actores de negocio y flujos de datos entre ellos. Etiquetas corporativas en las aristas.

### 4.2 Diagrama entidad-relación (estructura de datos de negocio)
Un bloque \`\`\`mermaid con \`erDiagram\`: entidades de negocio clave (las mismas que desarrollarás en §6) y relaciones (1:N, N:M). Solo nombres corporativos, no tablas físicas.

### 4.3 Flujos críticos (2–3 diagramas)
Elige los **2–3 procesos más importantes** del producto. Una subsección \`#### Flujo N: [nombre]\` por flujo, cada una con **un** bloque \`\`\`mermaid … \`\`\` (\`stateDiagram-v2\` preferido para ciclos de vida; \`flowchart\` para decisiones; \`sequenceDiagram\` para interacción entre actores/sistemas). **Copia la estructura del contrato Mermaid del mensaje** (fence + cuerpo, aristas dentro, sin listas markdown).

## 5. Límites del Alcance (In / Out of Scope)

### Dentro del alcance (MVP)
Lista de capacidades comerciales incluidas.

### Fuera de alcance
Explícito: qué NO se construye en esta fase (evita scope creep).

## 6. Reglas de Negocio, Políticas y Fórmulas

### Reglas de operación y políticas comerciales
Jerarquías de precios, lógicas de márgenes, niveles de aprobación, quién autoriza qué, qué queda bloqueado hasta resolución.

### Definición de entidades de negocio
Glosario corporativo: define las entidades del **proyecto actual** (según el fuente) — **sin** nombres de tablas ni campos.

### Fórmulas y umbrales
Fórmulas conceptuales del dominio (ej. total = base × factor); variables, unidades y excepciones comerciales.

### Matriz de permisos
Tabla: | Capacidad de negocio | [roles] | Nivel de acceso | Notas de confidencialidad |

### Flujos de negocio críticos
Resumen en prosa de los flujos ya diagramados en §4.3: Origen → Estados comerciales → Notificaciones → Resolución → Efecto en operación (sin HTTP ni webhooks). No repitas el diagrama aquí; complementa con reglas y excepciones.

### Criterios de aceptación de negocio (UAT)
Escenarios verificables por negocio antes de dar por cerrada la funcionalidad (formato: Dado / Cuando / Entonces en lenguaje comercial).

## 7. Requisitos de Experiencia y Operación

Reglas de visualización financiera (máscaras, separadores, confirmaciones ante variaciones), reportería para roles comerciales, trazabilidad de auditoría (quién tomó qué decisión comercial y cuándo). Accesibilidad si aplica.

## 8. Riesgos de Negocio y Métricas de Éxito

### Riesgos
Riesgos comerciales, operativos y de adopción (no riesgos técnicos de infraestructura).

### Métricas de éxito
Cómo medir que el producto cumple objetivos comerciales.

## Supuestos y dependencias
Dependencias de negocio (ERP, políticas corporativas, datos maestros); sin detalle de integración técnica.

## Pendientes de validación (decision log)
| Tema | Estado | Dueño sugerido | Impacto | Plazo sugerido |

## Registro de cambios del documento
Tabla | Versión | Fecha | Descripción del cambio | — fila 1.0 en creación; filas incrementales en cada revisión material.`;

export type BuildBrdUserPromptParams = {
  mode: BrdGenerationMode;
  sourceLabel: string;
  sourceDocument: string;
  baselineBrdBlock?: string;
};

function modePreamble(mode: BrdGenerationMode): string {
  switch (mode) {
    case "greenfield-from-dbga":
      return (
        "A partir del **Domain Benchmark / guía de dominio (DBGA)** siguiente, genera **solo el BRD de negocio**.\n\n" +
        "Extrae capacidades, roles, reglas comerciales, integraciones y políticas del DBGA. **Traduce** todo detalle técnico (APIs, tablas, crons, webhooks) a lenguaje corporativo según las reglas del system prompt. " +
        "El contexto y objetivos deben reflejar los hallazgos críticos del discovery (dolores, gaps, validaciones comerciales).\n\n"
      );
    case "legacy-as-is":
      return (
        "A partir del **MDD inicial / documentación del codebase** siguiente, genera el **BRD del sistema actual** (no es documento de cambio).\n\n" +
        "**PROHIBIDO** en §1 u objetivos: lenguaje de modificación («modificar el sistema», «incorporar funcionalidades del MVP/BRD», «implementar lo pendiente», delta de cambio). " +
        "Describe capacidades y procesos **en uso hoy**; las brechas van en «Pendientes de validación» o riesgos, no como propósito de la iniciativa.\n\n" +
        "**Cobertura exhaustiva (obligatorio):** cada entidad, servicio de negocio y capacidad listada en el inventario o documento fuente debe reflejarse en §3 Capacidades Funcionales, §5 Reglas/UAT o glosario §5 — **sin omitir dominios** por resumir. " +
        "Si el fuente documenta decenas de módulos (p. ej. campañas, medios, facturación), el BRD debe tener subsecciones ### por dominio, no un párrafo genérico.\n\n" +
        "Refleja fielmente las capacidades de negocio documentadas: usuarios, procesos, integraciones en términos comerciales. " +
        "Pain Points: dolores que el sistema resuelve y los que aún persisten. **No copies** endpoints ni esquemas del MDD al BRD.\n\n"
      );
    case "legacy-change":
      return (
        "A partir del documento siguiente (evidencia del codebase), genera el **BRD de cambio** (solo lo que cambia en negocio).\n\n" +
        "No redescribas el sistema completo. Centra el delta comercial; cita procesos o capacidades afectadas, no rutas de código.\n\n"
      );
  }
}

/**
 * Mensaje de usuario para `suggest-brd-from-dbga` y `suggest-brd-from-codebase-doc`.
 */
export function buildBrdUserPrompt(params: BuildBrdUserPromptParams): string {
  const baseline = params.baselineBrdBlock?.trim() ? `${params.baselineBrdBlock.trim()}\n\n` : "";
  return (
    modePreamble(params.mode) +
    BRD_SECTION_OUTLINE +
    "\n\n" +
    BRD_MERMAID_OUTPUT_CONTRACT +
    "\n\n" +
    baseline +
    BRD_DELIMITERS +
    "\n\n" +
    `--- ${params.sourceLabel} ---\n\n` +
    params.sourceDocument
  );
}
