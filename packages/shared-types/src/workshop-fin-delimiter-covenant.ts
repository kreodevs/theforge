/** Etiquetas legibles por pestaña del Workshop (mensajes al usuario). */
export const WORKSHOP_TAB_LABELS: Record<string, string> = {
  mdd: "MDD",
  spec: "Spec",
  architecture: "Arquitectura",
  "use-cases": "Casos de uso",
  "user-stories": "Historias de usuario",
  blueprint: "Blueprint",
  "api-contracts": "Contratos API",
  "logic-flows": "Flujos de lógica",
  tasks: "Tasks",
  infra: "Infraestructura",
  brd: "BRD",
  benchmark: "DBGA",
  "ux-ui-guide": "Guía UX/UI",
  phase0: "Fase 0",
};

/** Banner del Workshop cuando el panel no persistió (nunca menciona delimitadores al usuario). */
export function workshopPanelPersistFailedBanner(tab: string): string {
  const label = WORKSHOP_TAB_LABELS[tab] ?? "documento";
  return (
    `El panel de ${label} no se actualizó. Repite tu mensaje tal cual; ` +
    `The Forge reintentará aplicar los cambios automáticamente.`
  );
}

/** Nota breve anexada al mensaje del asistente en el chat (sin jerga ---FIN_*---). */
export function workshopPanelPersistFailedChatNote(tab: string, hadDelimiter?: boolean): string {
  const label = WORKSHOP_TAB_LABELS[tab] ?? "documento";
  if (hadDelimiter) {
    return (
      `El asistente generó contenido pero ${label} no se guardó en el panel ` +
      `(validación o documento incompleto). Repite tu pedido; no hace falta reformular.`
    );
  }
  return (
    `El asistente debió actualizar ${label} en el panel pero no ocurrió. ` +
    `Repite tu pedido tal cual.`
  );
}

/** Regla inviolable para agentes al editar cualquier documento del Workshop. */
export function workshopFinDelimiterCovenant(finTag: string, label: string): string {
  return (
    `**REGLA FIRMADA — ${label} (The Forge y agentes):** ` +
    `Cuando apliques cambios al documento del panel, devuelve el **${label} COMPLETO** ` +
    `y termina con la línea exacta \`---FIN_${finTag}---\` (mensaje breve de chat solo después). ` +
    `Sin ese delimitador el panel **no persiste**. ` +
    `**Prohibido** pedir al usuario que escriba delimitadores o reformule con jerga del sistema. ` +
    `Si el alcance es ambiguo, **pregunta en el chat** sin emitir documento hasta aclarar.`
  );
}

/** Covenant específico DBGA / tab Benchmark. */
export const WORKSHOP_DBGA_EDIT_COVENANT =
  "**REGLA FIRMADA — DBGA (The Forge y agentes):**\n" +
  "1. Pedidos de **revisar**, **auditar**, **cubrir gaps**, **mejorar** o **actualizar** el análisis = edición del **documento COMPLETO**, no solo conversación.\n" +
  "2. Si el alcance es ambiguo → **pregunta en el chat** (sin documento, sin delimitador). Cuando apliques cambios → DBGA **COMPLETO** + línea exacta `---FIN_DBGA---` + mensaje breve después.\n" +
  "3. **Inviolable:** sin `---FIN_DBGA---` el panel **no persiste**. **Prohibido** pedir al usuario delimitadores o reformulaciones técnicas.\n" +
  "4. **Prohibido** responder solo «He actualizado…» / «El cambio ya está en el panel» sin el markdown completo antes del delimitador.";
