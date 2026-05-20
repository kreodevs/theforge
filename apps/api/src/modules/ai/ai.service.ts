     1|import { Injectable, Inject } from "@nestjs/common";
     2|import type {
     3|  LLMProvider,
     4|  GenerateResponseOptions,
     5|  ChatMessage as LlmChatMessage,
     6|} from "./interfaces/llm-provider.interface.js";
     7|import { LLM_PROVIDER } from "./interfaces/llm-provider.interface.js";
     8|import type { ChatImagePart } from "@theforge/shared-types";
     9|import { MASTER_PROMPT } from "./prompts/master-prompt.js";
    10|
    11|/** System corto solo para bienvenidas: evita ~6k+ chars de MASTER en cada `POST …/welcome`. */
    12|const WELCOME_BRIEF_SYSTEM_PROMPT = `Eres el asistente del Workshop **The Forge** (especificación: MDD, BRD por etapa, Manual To-Be, Spec, Benchmark, etc.).
    13|- Responde en **español**, tono profesional y **breve**.
    14|- No inventes requisitos que contradigan el texto del **mensaje de usuario** (puede traer fragmentos de Benchmark, BRD u otros documentos).
    15|- Si el mensaje pide **un solo** mensaje de bienvenida u orientación inicial, cumple sin divagar ni copiar el enunciado entero.`;
    16|import { UX_UI_GUIDE_PROMPT } from "./prompts/ux-ui-guide-prompt.js";
    17|import { BENCHMARK_REFINE_PROMPT } from "./prompts/phase0-benchmark-refine-prompt.js";
    18|import { BLUEPRINT_PROMPT } from "./prompts/blueprint-prompt.js";
    19|import { API_CONTRACTS_PROMPT } from "./prompts/api-contracts-prompt.js";
    20|import { LOGIC_FLOWS_PROMPT } from "./prompts/logic-flows-prompt.js";
    21|import { INFRA_PROMPT } from "./prompts/infra-prompt.js";
    22|import { SPEC_PROMPT } from "./prompts/spec-prompt.js";
    23|import { ARCHITECTURE_PROMPT } from "./prompts/architecture-prompt.js";
    24|import { USE_CASES_PROMPT } from "./prompts/use-cases-prompt.js";
    25|import { USER_STORIES_PROMPT } from "./prompts/user-stories-prompt.js";
    26|import { TASKS_PROMPT } from "./prompts/tasks-prompt.js";
    27|import { VERIFY_DELIVERABLE_PROMPT } from "./prompts/verify-deliverable-prompt.js";
    28|import { CONFORMANCE_CHECK_PROMPT } from "./prompts/conformance-check-prompt.js";
    29|
    30|/** Instrucción fija para que ningún documento generado use "militar" (se añade al system prompt en generación de docs). */
    31|const NO_MILITAR_INSTRUCTION =
    32|  "\n\n**Regla obligatoria:** En toda tu respuesta no uses nunca las palabras \"militar\", \"grado militar\" ni variantes; usa \"alta criticidad\", \"misión crítica\" o \"robustez industrial\" en su lugar.";
    33|
    34|/** Opciones para generación legacy: contexto TheForge para priorizar conocimiento del codebase. */
    35|export interface LegacyGenerateOptions {
    36|  /** Contexto del codebase (TheForge). Cuando está presente, se inyecta al inicio del prompt y se instruye a priorizarlo. */
    37|  theforgeContext?: string;
    38|  /** Contratos de API reales obtenidos vía get_contract_specs del MCP de Ariadne. Props/firmas reales de componentes para alinear endpoints. */
    39|  contractSpecs?: string;
    40|}
    41|
    42|/** Instrucción fija para toda documentación legacy: complementar sin inventar. */
    43|const LEGACY_NO_INVENTAR =
    44|  "**Regla obligatoria (legacy):** Cumple estrictamente con lo que especifican los documentos. No inventes funcionalidades nuevas ni cambies el alcance. Sin embargo, puedes y debes complementar con lo necesario para que lo especificado funcione correctamente: validaciones, manejo de errores, estados de UI, casos edge obvios, autenticación donde aplique, migraciones de DB requeridas, y cualquier boilerplate indispensable. Si algo es ambiguo o hay múltiples formas válidas de implementarlo, pregunta.";
    45|
    46|function trimTheForgeContextBlock(theforgeContext: string): string {
    47|  const max = parseInt(process.env.THEFORGE_CONTEXT_PREPEND_MAX_CHARS ?? "16000", 10);
    48|  const cap = Number.isFinite(max) && max > 2000 ? max : 16000;
    49|  return (theforgeContext ?? "").trim().slice(0, cap);
    50|}
    51|
    52|function prependTheForgePrompt(prompt: string, theforgeContext: string): string {
    53|  const block = trimTheForgeContextBlock(theforgeContext);
    54|  if (!block) return prompt;
    55|  return (
    56|    "**Contexto del codebase (índice vía TheForge MCP) — priorizar y usar en su totalidad antes de elaborar el documento:**\n" +
    57|    "**Nota:** «TheForge» aquí es la herramienta de indexado, **no** el nombre del producto ni del sistema que documentas (ese nombre sale del MDD).\n---\n" +
    58|    block +
    59|    "\n---\n\n" +
    60|    LEGACY_NO_INVENTAR +
    61|    "\n\n**Instrucción:** Usa TODO el conocimiento anterior para alinear el documento con lo que ya existe en el proyecto. A continuación, el MDD u otros insumos.\n\n" +
    62|    prompt
    63|  );
    64|}
    65|
    66|@Injectable()
    67|export class AiService {
    68|  constructor(
    69|    @Inject(LLM_PROVIDER)
    70|    private readonly provider: LLMProvider,
    71|  ) { }
    72|
    73|  private static readonly ACTIVE_TAB_LABELS: Record<string, string> = {
    74|    spec: "Spec (SDD: what/why)",
    75|    brd: "BRD (etapa)",
    76|    mdd: "MDD",
    77|    architecture: "Arquitectura del sistema",
    78|    "use-cases": "Casos de Uso",
    79|    "user-stories": "Historias de Usuario",
    80|    "ux-ui-guide": "Guía UX/UI",
    81|    blueprint: "Blueprint",
    82|    "api-contracts": "Contratos de API",
    83|    "logic-flows": "Flujos de lógica",
    84|    infra: "Infraestructura",
    85|    tasks: "Tareas (Breakdown)",
    86|  };
    87|
    88|  /** Política Google Stitch + fragmentos SDD para Guía UX/UI (según projectType). */
    89|  private appendUxGuideStitchPolicy(
    90|    systemPrompt: string,
    91|    options: GenerateResponseOptions | undefined,
    92|  ): string {
    93|    const pt = options?.projectTypeForUxGuide;
    94|    if (!pt) return systemPrompt;
    95|    if (options?.activeTab?.trim() !== "ux-ui-guide") return systemPrompt;
    96|    let s = systemPrompt;
    97|    if (pt === "LEGACY") {
    98|      return (
    99|        s +
   100|        "\n\n**[Tipo de proyecto: LEGACY]** Cambio sobre sistema existente. **Prohibido** incluir en la Guía UX/UI ninguna sección titulada **«Prompt para Google Stitch»** ni brief para herramientas de diseño generativo (p. ej. Google Stitch) orientado a un producto greenfield desde cero. La guía debe alinearse con lo ya existente descrito en el MDD y el contexto del proyecto."
   101|      );
   102|    }
   103|    if (pt === "NEW") {
   104|      s +=
   105|        "\n\n**[Tipo de proyecto: NEW]** Al generar o actualizar la **Guía UX/UI completa**, **incluye obligatoriamente** al final del documento markdown (antes de la línea `---FIN_UX_UI---`) la sección **## Prompt para Google Stitch (producto)** con **un único bloque de texto** listo para copiar y pegar en Google Stitch. Ese prompt debe describir **el producto que estamos especificando en este proyecto** (el sistema del cliente según el MDD y los documentos del contexto), **no** la aplicación interna The Forge ni su Workshop. Incluye: (1) nombre provisional del producto y propuesta de valor en una frase; (2) usuarios objetivo y contexto de uso; (3) inventario de **pantallas, vistas o flujos** inferidos de MDD, Blueprint, Spec, casos de uso, historias, flujos de lógica y arquitectura que recibes en el contexto; (4) dirección visual, stack de UI (p. ej. React, Tailwind, shadcn) y criterios de accesibilidad alineados a las secciones anteriores de esta guía; (5) si el producto es web, pedir **variantes desktop y móvil**; (6) estados vacío, carga y error en flujos críticos. Si faltan datos, **infórelos** y declara **supuestos explícitos** dentro del bloque Stitch.";
   106|      const docs = options.uxGuideAdditionalDocs;
   107|      if (docs) {
   108|        const blocks: [string, string | undefined][] = [
   109|          ["Spec (SDD what/why)", docs.spec],
   110|          ["Casos de uso", docs.useCases],
   111|          ["Historias de usuario", docs.userStories],
   112|          ["Flujos de lógica / interacción", docs.logicFlows],
   113|          ["Arquitectura del sistema (impacto UI)", docs.architecture],
   114|          ["Contratos de API (datos y pantallas)", docs.apiContracts],
   115|          ["Benchmark & Gap Analysis (dominio)", docs.dbga],
   116|          ["Resumen fase 0", docs.phase0],
   117|        ];
   118|        for (const [title, body] of blocks) {
   119|          if (body?.trim()) {
   120|            s += `\n\n[${title} — contexto para Guía UX/UI y Prompt Stitch del producto]\n---\n${body.trim()}\n---`;
   121|          }
   122|        }
   123|      }
   124|    }
   125|    return s;
   126|  }
   127|
   128|  async generateResponse(
   129|    prompt: string,
   130|    history: LlmChatMessage[],
   131|    options?: GenerateResponseOptions,
   132|  ): Promise<string> {
   133|    try {
   134|      const isUxUiGuide = options?.activeTab?.trim() === "ux-ui-guide";
   135|      const isBenchmarkRefine =
   136|        options?.activeTab?.trim() === "benchmark" && (options?.currentDbgaContent?.trim() ?? "").length > 0;
   137|      let systemPrompt =
   138|        options?.systemPrompt ??
   139|        (options?.welcomeBrief
   140|          ? WELCOME_BRIEF_SYSTEM_PROMPT
   141|          : isBenchmarkRefine
   142|            ? BENCHMARK_REFINE_PROMPT
   143|            : isUxUiGuide
   144|              ? UX_UI_GUIDE_PROMPT
   145|              : MASTER_PROMPT);
   146|      if (options?.activeTab?.trim()) {
   147|        const at = options.activeTab.trim();
   148|        const label = AiService.ACTIVE_TAB_LABELS[at] ?? at;
   149|        systemPrompt += `\n\n[Contexto de documento activo:] El usuario está trabajando en: **${label}**. Adapta tu respuesta a ese documento (preguntas, sugerencias o ediciones relevantes para ese contexto).\n\n**Desambiguación:** Si el usuario expresa una intención de cambio o modificación (ej. "agrega", "cambia", "modifica", "actualiza") o percibes ambigüedad entre una consulta y un cambio, PREGUNTA explícitamente: "¿Es una consulta o quieres que aplique el cambio al documento?". No asumas que quiere modificar el documento a menos que lo confirme.`;
   150|
   151|        // Instrucción para delimitadores universales en el chat (aplicar cambios al documento)
   152|        const tagMap: Record<string, string> = {
   153|          mdd: "MDD",
   154|          spec: "SPEC",
   155|          brd: "BRD",
   156|          architecture: "ARCH",
   157|          "use-cases": "USECASES",
   158|          "user-stories": "STORIES",
   159|          blueprint: "BLUEPRINT",
   160|          "api-contracts": "API",
   161|          "logic-flows": "FLOWS",
   162|          tasks: "TASKS",
   163|          infra: "INFRA",
   164|        };
   165|        const tag = tagMap[at];
   166|        if (tag && !options?.welcomeBrief) {
   167|          systemPrompt += `\n\n**Instrucción DE delimitador (OBLIGATORIO):** Cuando generes o actualices el documento de ${label} (completo o solo una sección), DEBES escribir el contenido y TERMINAR con la línea exacta \`---FIN_${tag}---\`. Lo que vaya después se mostrará como mensaje en el chat. Sin ese delimitador, el sistema NO persiste ningún cambio y el usuario no ve nada en el panel del documento.`;
   168|          if (at === "mdd") {
   169|            systemPrompt +=
   170|              "\n\n**\u26a0\ufe0f REGLA ABSOLUTA \u2014 MDD:** Cada vez que el usuario pida **agregar, cambiar, modificar, actualizar, corregir o eliminar** algo del MDD (ej. \"agrega X\", \"cambia Y por Z\", \"falta W\", \"actualiza la secci\u00f3n N\"), **DEBES** devolver el **MDD COMPLETO ACTUALIZADO** (conservando TODO el contenido existente m\u00e1s los cambios) terminando con `---FIN_MDD---`. **NUNCA** respondas solo con un mensaje como \"MDD actualizado\" o \"Hecho\" \u2014 si lo haces, el sistema NO persiste ning\u00fan cambio y el usuario cree que se aplic\u00f3 cuando no es as\u00ed. Siempre incluye un mensaje breve resumiendo el cambio DESPU\u00c9S de `---FIN_MDD---`.";
   171|          }
   172|          if (at === "spec") {
   173|            systemPrompt +=
   174|              "\n\n**Cuando el usuario confirme que integre o aplique cambios al Spec** (ej. \"sí ingrésalo\", \"integralo\", \"aplica\", \"confirma\", \"actualiza el spec\"), **debes** devolver el **documento Spec completo** actualizado (incluyendo lo que ya existía más la nueva sección o cambios), terminando con \`---FIN_SPEC---\`. Nunca respondas solo con un mensaje tipo \"El documento Spec ha sido actualizado con éxito\": el sistema solo persiste cuando encuentra el contenido del documento seguido de ---FIN_SPEC---.";
   175|          }
   176|          if (at === "brd") {
   177|            systemPrompt +=
   178|              "\n\n**OBLIGATORIO - BRD (formato exacto obligatorio):**\n\n**NO preguntes ni pidas confirmaci\u00f3n**. Cuando el usuario pida agregar, modificar o eliminar algo del BRD, **Aplica el cambio inmediatamente** siguiendo este formato:\n\n```\n[BRD completo actualizado con el cambio incorporado, conservando TODO el contenido existente]\n---FIN_BRD---\n[breve mensaje de chat resumiendo lo que cambiaste]\n```\n\nEJEMPLO:\n```\n# Business Requirements Document: CRM Inmobiliario\n\n## Alcance\n### Funcional\nRF-1: ...\nRF-15: ...\n---FIN_BRD---\nAgregado RF-15 al alcance.\n```\n\n**IMPORTANTE:** Sin ``---FIN_BRD---`` no se persiste NADA. El contenido del BRD va ANTES del delimitador. El mensaje de chat va DESPU\u00c9S.";
   179|          }
   180|          if (at === "blueprint") {
   181|            systemPrompt +=
   182|              "\n\n**OBLIGATORIO - Blueprint:** Cuando el usuario pida **agregar, modificar o eliminar** algo del Blueprint, **debes** devolver el **Blueprint completo actualizado** (conservando TODO el contenido existente) terminando con `---FIN_BLUEPRINT---`. Si solo envías una sección, el sistema la **fusiona** automáticamente con el contenido actual. Nunca respondas solo con un mensaje tipo \"El Blueprint ha sido actualizado\" — el sistema solo persiste cuando encuentra el contenido del documento seguido de `---FIN_BLUEPRINT---`.";
   183|          }
   184|          if (at === "ux-ui-guide") {
   185|            systemPrompt +=
   186|              "\n\n**OBLIGATORIO - Guía UX/UI:** Cuando el usuario pida **agregar, modificar o regenerar** la Guía UX/UI, **debes** devolver la **Guía UX/UI completa actualizada** (conservando TODO el contenido existente) terminando con `---FIN_UX_UI---`. Si solo envías un fragmento sin el documento completo, el sistema ignora el cambio y el usuario no ve nada. **Siempre incluye la guía COMPLETA antes del delimitador.**";
   187|          }
   188|        }
   189|      }
   190|      if (!options?.welcomeBrief) {
   191|        if (options?.currentDbgaContent?.trim()) {
   192|          if (isBenchmarkRefine) {
   193|            systemPrompt +=
   194|              "\n\n[Contenido actual del Benchmark & Gap Analysis del proyecto (a refinar según la petición del usuario)]\n---\n" +
   195|              options.currentDbgaContent.trim() +
   196|              "\n---";
   197|          } else if (!options?.currentMddContent?.trim()) {
   198|            systemPrompt +=
   199|              "\n\n[Contexto base: Domain Benchmark & Gap Analysis del usuario. Úsalo como referencia para guiar la entrevista y redactar el MDD.]\n---\n" +
   200|              options.currentDbgaContent.trim().slice(0, 4000) +
   201|              "\n---";
   202|          }
   203|        }
   204|        if (options?.currentMddContent?.trim()) {
   205|          systemPrompt +=
   206|            "\n\n[Contenido actual del MDD del proyecto (puede incluir ediciones del usuario)]\n---\n" +
   207|            options.currentMddContent.trim() +
   208|            "\n---";
   209|        }
   210|        if (isUxUiGuide && options?.currentBlueprintContent?.trim()) {
   211|          systemPrompt +=
   212|            "\n\n[Blueprint del proyecto: estructura, pantallas y módulos. Úsalo para alinear la Guía UX/UI con las pantallas y flujos descritos.]\n---\n" +
   213|            options.currentBlueprintContent.trim().slice(0, 6000) +
   214|            "\n---";
   215|        }
   216|        if (options?.currentUxUiGuideContent?.trim()) {
   217|          systemPrompt +=
   218|            "\n\n[Contenido actual de la Guía UX/UI del proyecto (puede incluir ediciones del usuario)]\n---\n" +
   219|            options.currentUxUiGuideContent.trim().slice(0, 6000) +
   220|            "\n---";
   221|        }
   222|        if (options?.activeTab?.trim() === "spec" && options?.currentSpecContent?.trim()) {
   223|          systemPrompt +=
   224|            "\n\n[Contenido actual del Spec del proyecto. Al integrar o actualizar, incluye todo esto más la nueva sección o cambios, y termina con ---FIN_SPEC---.]\n---\n" +
   225|            options.currentSpecContent.trim().slice(0, 12000) +
   226|            "\n---";
   227|        }
   228|        if (options?.activeTab?.trim() === "brd" && options?.currentBrdContent?.trim()) {
   229|          systemPrompt +=
   230|            "\n\n[BRD actual de la etapa del Workshop. Al actualizar, conserva lo acordado y fusiona cambios; termina con ---FIN_BRD---.]\n---\n" +
   231|            options.currentBrdContent.trim().slice(0, 8000) +
   232|            "\n---";
   233|        }
   234|        if (options?.learningHistory?.trim()) {
   235|          systemPrompt +=
   236|            "\n\n**HISTORIAL_DE_APRENDIZAJE (proyectos previos del usuario):**\n---\n" +
   237|            options.learningHistory.trim().slice(0, 6000) +
   238|            "\n---";
   239|        }
   240|        if (options?.complexityInterviewContext?.trim()) {
   241|          systemPrompt +=
   242|            "\n\n**[Política de complejidad / entrevista Fase 0 — aplicar en esta conversación]**\n" +
   243|            options.complexityInterviewContext.trim().slice(0, 8000);
   244|        }
   245|      }
   246|      systemPrompt = this.appendUxGuideStitchPolicy(systemPrompt, options);
   247|      if (
   248|        (options?.userMessageImages?.length ?? 0) > 0 ||
   249|        history.some((h) => h.role === "user" && (h.images?.length ?? 0) > 0)
   250|      ) {
   251|        systemPrompt +=
   252|          "\n\n**Entrada multimodal:** Puede haber imágenes en el historial o en este mensaje. Interprétalas en el contexto del documento activo y la conversación (modelo de datos, UI, flujos); no inventes detalles no visibles.";
   253|        if (
   254|          options?.activeTab?.trim() === "mdd" &&
   255|          (options?.currentMddContent?.trim().length ?? 0) > 400
   256|        ) {
   257|          systemPrompt +=
   258|            "\n\n**MDD no destructivo (obligatorio si ya hay MDD en contexto):** El bloque \"Contenido actual del MDD\" incluye **todas** las secciones. Si el usuario pide revisar, alinear o ampliar (p. ej. tras un diagrama), **no sustituyas el proyecto por un solo fragmento**: devuelve el **MDD completo** actualizado (copia el contenido existente y aplica cambios), terminando con `---FIN_MDD---`. Si optas por enviar **solo una sección**, debe empezar por el **mismo patrón de encabezado** que ya usa el documento para esa sección (`## N.` recomendado, mismo `N` que corresponda). Nunca envíes solo tablas o JSON sueltos sin el título de sección reconocible.";
   259|        }
   260|      }
   261|      const ts = () => new Date().toISOString();
   262|      console.log(`[AiService] ${ts()} → Enviando al LLM:`, {
   263|        activeTab: options?.activeTab,
   264|        welcomeBrief: options?.welcomeBrief === true,
   265|        promptLength: prompt.length,
   266|        promptPreview: prompt.slice(0, 120) + (prompt.length > 120 ? "…" : ""),
   267|        systemPromptLength: systemPrompt.length,
   268|        approxTotalChars: systemPrompt.length + prompt.length,
   269|        historyLength: history.length,
   270|      });
   271|      const out = await this.provider.generateResponse(prompt, history, {
   272|        systemPrompt,
   273|        userMessageImages: options?.userMessageImages,
   274|      });
   275|      console.log(`[AiService] ${ts()} ← Respuesta del LLM recibida:`, {
   276|        length: out?.length ?? 0,
   277|        preview: (out ?? "").slice(0, 200) + ((out?.length ?? 0) > 200 ? "…" : ""),
   278|      });
   279|      return out;
   280|    } catch (err) {
   281|      console.error("[AiService] generateResponse error", err);
   282|      throw err;
   283|    }
   284|  }
   285|
   286|  /**
   287|   * Streaming: same system prompt as generateResponse, yields chunks from the provider.
   288|   */
   289|  async generateResponseStream(
   290|    prompt: string,
   291|    history: LlmChatMessage[],
   292|    options?: GenerateResponseOptions,
   293|  ): Promise<AsyncIterable<string>> {
   294|    const isUxUiGuide = options?.activeTab?.trim() === "ux-ui-guide";
   295|    const isBenchmarkRefine =
   296|      options?.activeTab?.trim() === "benchmark" && (options?.currentDbgaContent?.trim() ?? "").length > 0;
   297|    let systemPrompt =
   298|      options?.systemPrompt ??
   299|      (options?.welcomeBrief
   300|        ? WELCOME_BRIEF_SYSTEM_PROMPT
   301|        : isBenchmarkRefine
   302|          ? BENCHMARK_REFINE_PROMPT
   303|          : isUxUiGuide
   304|            ? UX_UI_GUIDE_PROMPT
   305|            : MASTER_PROMPT);
   306|    if (options?.activeTab?.trim()) {
   307|      const at = options.activeTab.trim();
   308|      const label = AiService.ACTIVE_TAB_LABELS[at] ?? at;
   309|      systemPrompt += `\n\n[Contexto de documento activo:] El usuario está trabajando en: **${label}**. Adapta tu respuesta a ese documento (preguntas, sugerencias o ediciones relevantes para ese contexto).`;
   310|
   311|      // Instrucción para delimitadores universales en el chat (aplicar cambios al documento)
   312|      const tagMap: Record<string, string> = {
   313|        mdd: "MDD",
   314|        spec: "SPEC",
   315|        brd: "BRD",
   316|        architecture: "ARCH",
   317|        "use-cases": "USECASES",
   318|        "user-stories": "STORIES",
   319|        blueprint: "BLUEPRINT",
   320|        "api-contracts": "API",
   321|        "logic-flows": "FLOWS",
   322|        tasks: "TASKS",
   323|        infra: "INFRA",
   324|      };
   325|      const tag = tagMap[at];
   326|      if (tag && !options?.welcomeBrief) {
   327|        systemPrompt += `\n\nSi decides generar o actualizar el documento de ${label} (completo o solo una sección), escribe el contenido y TERMINA con la línea exacta \`---FIN_${tag}---\`. Lo que vaya después se mostrará como mensaje en el chat. Así el sistema aplicará los cambios al documento del proyecto.`;
   328|        if (at === "mdd") {
   329|            systemPrompt +=
   330|              "\n\n**\u26a0\ufe0f REGLA ABSOLUTA \u2014 MDD:** Cada vez que el usuario pida **agregar, cambiar, modificar, actualizar, corregir o eliminar** algo del MDD (ej. \"agrega X\", \"cambia Y por Z\", \"falta W\", \"actualiza la secci\u00f3n N\"), **DEBES** devolver el **MDD COMPLETO ACTUALIZADO** (conservando TODO el contenido existente m\u00e1s los cambios) terminando con `---FIN_MDD---`. **NUNCA** respondas solo con un mensaje como \"MDD actualizado\" o \"Hecho\" \u2014 si lo haces, el sistema NO persiste ning\u00fan cambio y el usuario cree que se aplic\u00f3 cuando no es as\u00ed. Siempre incluye un mensaje breve resumiendo el cambio DESPU\u00c9S de `---FIN_MDD---`.";
   331|          }
   332|        if (at === "spec") {
   333|          systemPrompt +=
   334|            "\n\n**Cuando el usuario confirme que integre o aplique cambios al Spec** (ej. \"sí ingrésalo\", \"integralo\", \"aplica\", \"confirma\", \"actualiza el spec\"), **debes** devolver el **documento Spec completo** actualizado (incluyendo lo que ya existía más la nueva sección o cambios), terminando con \`---FIN_SPEC---\`. Nunca respondas solo con un mensaje tipo \"El documento Spec ha sido actualizado con éxito\": el sistema solo persiste cuando encuentra el contenido del documento seguido de ---FIN_SPEC---.";
   335|        }
   336|        if (at === "brd") {
   337|          systemPrompt +=
   338|            "\n\n**OBLIGATORIO - BRD (formato exacto obligatorio):**\n\n**NO preguntes ni pidas confirmaci\u00f3n**. Cuando el usuario pida agregar, modificar o eliminar algo del BRD, **Aplica el cambio inmediatamente** siguiendo este formato:\n\n```\n[BRD completo actualizado con el cambio incorporado, conservando TODO el contenido existente]\n---FIN_BRD---\n[breve mensaje de chat resumiendo lo que cambiaste]\n```\n\nEJEMPLO:\n```\n# Business Requirements Document: CRM Inmobiliario\n\n## Alcance\n### Funcional\nRF-1: ...\nRF-15: ...\n---FIN_BRD---\nAgregado RF-15 al alcance.\n```\n\n**IMPORTANTE:** Sin ``---FIN_BRD---`` no se persiste NADA. El contenido del BRD va ANTES del delimitador. El mensaje de chat va DESPU\u00c9S.";
   339|        }
   340|          if (at === "blueprint") {
   341|            systemPrompt +=
   342|              "\n\n**OBLIGATORIO - Blueprint:** Cuando el usuario pida **agregar, modificar o eliminar** algo del Blueprint, **debes** devolver el **Blueprint completo actualizado** (conservando TODO el contenido existente) terminando con `---FIN_BLUEPRINT---`. Si solo envías una sección, el sistema la **fusiona** automáticamente con el contenido actual. Nunca respondas solo con un mensaje tipo \"El Blueprint ha sido actualizado\" — el sistema solo persiste cuando encuentra el contenido del documento seguido de `---FIN_BLUEPRINT---`.";
   343|          }
   344|        }
   345|    }
   346|    if (!options?.welcomeBrief) {
   347|      if (options?.currentDbgaContent?.trim()) {
   348|        if (isBenchmarkRefine) {
   349|          systemPrompt +=
   350|            "\n\n[Contenido actual del Benchmark & Gap Analysis del proyecto (a refinar según la petición del usuario)]\n---\n" +
   351|            options.currentDbgaContent.trim() +
   352|            "\n---";
   353|        } else if (!options?.currentMddContent?.trim()) {
   354|          systemPrompt +=
   355|            "\n\n[Contexto base: Domain Benchmark & Gap Analysis del usuario. Úsalo como referencia para guiar la entrevista y redactar el MDD.]\n---\n" +
   356|            options.currentDbgaContent.trim().slice(0, 4000) +
   357|            "\n---";
   358|        }
   359|      }
   360|      if (options?.currentMddContent?.trim()) {
   361|        systemPrompt +=
   362|          "\n\n[Contenido actual del MDD del proyecto (puede incluir ediciones del usuario)]\n---\n" +
   363|          options.currentMddContent.trim() +
   364|          "\n---";
   365|      }
   366|      if (isUxUiGuide && options?.currentBlueprintContent?.trim()) {
   367|        systemPrompt +=
   368|          "\n\n[Blueprint del proyecto: estructura, pantallas y módulos. Úsalo para alinear la Guía UX/UI con las pantallas y flujos descritos.]\n---\n" +
   369|          options.currentBlueprintContent.trim().slice(0, 6000) +
   370|          "\n---";
   371|      }
   372|      if (options?.currentUxUiGuideContent?.trim()) {
   373|        systemPrompt +=
   374|          "\n\n[Contenido actual de la Guía UX/UI del proyecto (puede incluir ediciones del usuario)]\n---\n" +
   375|          options.currentUxUiGuideContent.trim().slice(0, 6000) +
   376|          "\n---";
   377|      }
   378|      if (options?.activeTab?.trim() === "spec" && options?.currentSpecContent?.trim()) {
   379|        systemPrompt +=
   380|          "\n\n[Contenido actual del Spec del proyecto. Al integrar o actualizar, incluye todo esto más la nueva sección o cambios, y termina con ---FIN_SPEC---.]\n---\n" +
   381|          options.currentSpecContent.trim().slice(0, 12000) +
   382|          "\n---";
   383|      }
   384|      if (options?.activeTab?.trim() === "brd" && options?.currentBrdContent?.trim()) {
   385|        systemPrompt +=
   386|          "\n\n[BRD actual de la etapa del Workshop. Al actualizar, conserva lo acordado y fusiona cambios; termina con ---FIN_BRD---.]\n---\n" +
   387|          options.currentBrdContent.trim().slice(0, 8000) +
   388|          "\n---";
   389|      }
   390|      if (options?.activeTab?.trim() === "architecture" && (options as any).currentArchitectureContent?.trim()) {
   391|        systemPrompt +=
   392|          "\n\n[Contenido actual del documento Architecture del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_ARCH---.]\n---\n" +
   393|          (options as any).currentArchitectureContent.trim().slice(0, 12000) +
   394|          "\n---";
   395|      }
   396|      if (options?.activeTab?.trim() === "use-cases" && (options as any).currentUseCasesContent?.trim()) {
   397|        systemPrompt +=
   398|          "\n\n[Contenido actual de Use Cases del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_USECASES---.]\n---\n" +
   399|          (options as any).currentUseCasesContent.trim().slice(0, 12000) +
   400|          "\n---";
   401|      }
   402|      if (options?.activeTab?.trim() === "user-stories" && (options as any).currentUserStoriesContent?.trim()) {
   403|        systemPrompt +=
   404|          "\n\n[Contenido actual de User Stories del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_STORIES---.]\n---\n" +
   405|          (options as any).currentUserStoriesContent.trim().slice(0, 12000) +
   406|          "\n---";
   407|      }
   408|      if (options?.activeTab?.trim() === "blueprint" && options?.currentBlueprintContent?.trim()) {
   409|        systemPrompt +=
   410|          "\n\n[Contenido actual del Blueprint del proyecto. Al actualizar, incluye todo esto más los cambios; termina con ---FIN_BLUEPRINT---.]\n---\n" +
   411|          options.currentBlueprintContent.trim().slice(0, 12000) +
   412|          "\n---";
   413|      }
   414|      if (options?.activeTab?.trim() === "api-contracts" && (options as any).currentApiContractsContent?.trim()) {
   415|        systemPrompt +=
   416|          "\n\n[Contenido actual de API Contracts del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_API---.]\n---\n" +
   417|          (options as any).currentApiContractsContent.trim().slice(0, 12000) +
   418|          "\n---";
   419|      }
   420|      if (options?.activeTab?.trim() === "logic-flows" && (options as any).currentLogicFlowsContent?.trim()) {
   421|        systemPrompt +=
   422|          "\n\n[Contenido actual de Logic Flows del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_FLOWS---.]\n---\n" +
   423|          (options as any).currentLogicFlowsContent.trim().slice(0, 12000) +
   424|          "\n---";
   425|      }
   426|      if (options?.activeTab?.trim() === "tasks" && (options as any).currentTasksContent?.trim()) {
   427|        systemPrompt +=
   428|          "\n\n[Contenido actual de Tasks del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_TASKS---.]\n---\n" +
   429|          (options as any).currentTasksContent.trim().slice(0, 12000) +
   430|          "\n---";
   431|      }
   432|      if (options?.activeTab?.trim() === "infra" && (options as any).currentInfraContent?.trim()) {
   433|        systemPrompt +=
   434|          "\n\n[Contenido actual de Infraestructura del proyecto. Al actualizar, incluye el contenido completo más los cambios; termina con ---FIN_INFRA---.]\n---\n" +
   435|          (options as any).currentInfraContent.trim().slice(0, 12000) +
   436|          "\n---";
   437|      }
   438|      if (options?.learningHistory?.trim()) {
   439|        systemPrompt +=
   440|          "\n\n**HISTORIAL_DE_APRENDIZAJE (proyectos previos del usuario):**\n---\n" +
   441|          options.learningHistory.trim().slice(0, 6000) +
   442|          "\n---";
   443|      }
   444|      if (options?.complexityInterviewContext?.trim()) {
   445|        systemPrompt +=
   446|          "\n\n**[Política de complejidad / entrevista Fase 0 — aplicar en esta conversación]**\n" +
   447|          options.complexityInterviewContext.trim().slice(0, 8000);
   448|      }
   449|    }
   450|    systemPrompt = this.appendUxGuideStitchPolicy(systemPrompt, options);
   451|    if (
   452|        (options?.userMessageImages?.length ?? 0) > 0 ||
   453|        history.some((h) => h.role === "user" && (h.images?.length ?? 0) > 0)
   454|      ) {
   455|      systemPrompt +=
   456|        "\n\n**Entrada multimodal:** Puede haber imágenes en el historial o en este mensaje. Interprétalas en el contexto del documento activo y la conversación (modelo de datos, UI, flujos); no inventes detalles no visibles.";
   457|      if (
   458|        options?.activeTab?.trim() === "mdd" &&
   459|        (options?.currentMddContent?.trim().length ?? 0) > 400
   460|      ) {
   461|        systemPrompt +=
   462|          "\n\n**MDD no destructivo (obligatorio si ya hay MDD en contexto):** El bloque \"Contenido actual del MDD\" incluye **todas** las secciones. Si el usuario pide revisar, alinear o ampliar (p. ej. tras un diagrama), **no sustituyas el proyecto por un solo fragmento**: devuelve el **MDD completo** actualizado (copia el contenido existente y aplica cambios), terminando con `---FIN_MDD---`. Si optas por enviar **solo una sección**, debe empezar por el **mismo patrón de encabezado** que ya usa el documento para esa sección (`## N.` recomendado, mismo `N` que corresponda). Nunca envíes solo tablas o JSON sueltos sin el título de sección reconocible.";
   463|      }
   464|    }
   465|    return this.provider.generateResponseStream(prompt, history, { ...options, systemPrompt });
   466|  }
   467|
   468|  /**
   469|   * Visión → texto para inyectar en el grafo MDD (Manager) sin soportar multimodal en LangGraph.
   470|   */
   471|  async describeImagesForMddPipeline(userText: string, images: ChatImagePart[]): Promise<string> {
   472|    if (!images.length) return "";
   473|    const hint = (userText ?? "").trim().slice(0, 4000) || "(sin texto adicional)";
   474|    const prompt = `El usuario está elaborando el Master Design Document. Mensaje o petición asociada:\n---\n${hint}\n---\n\nDescribe lo que muestran las imágenes: modelo de datos, UI, flujos, stack visible, etc. Responde en español, viñetas; indica partes ilegibles.`;
   475|    const out = await this.generateResponse(prompt, [], {
   476|      systemPrompt:
   477|        "Eres arquitecto de software: extrae solo información sustentada en las imágenes; no inventes.",
   478|      userMessageImages: images,
   479|    });
   480|    return out.trim().slice(0, 12000);
   481|  }
   482|
   483|  async parseChecklist(text: string) {
   484|    try {
   485|      return await this.provider.parseChecklist(text);
   486|    } catch (err) {
   487|      console.error("[AiService] parseChecklist error", err);
   488|      throw err;
   489|    }
   490|  }
   491|
   492|  /**
   493|   * Genera el contenido de blueprint.md a partir del MDD.
   494|   * Usa BLUEPRINT_PROMPT como system y el MDD como user message.
   495|   */
   496|  /**
   497|   * Genera el documento Spec (SDD: what/why) desde Benchmark + opcional phase0/clarifiedScope.
   498|   */
   499|  async generateSpec(
   500|    inputContent: string,
   501|