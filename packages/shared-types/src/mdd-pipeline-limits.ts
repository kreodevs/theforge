/**
 * Límites del pipeline MDD (backend) y umbral de aviso UX (Workshop).
 * Una sola fuente de verdad: importar desde aquí en API y web.
 */

/** `getUserExplicitRequirements` — pegados de guías API, INEGI, etc. */
export const MDD_MAX_EXPLICIT_REQUIREMENTS_CHARS = 16000;

/** `getPlanDirective` — directiva acumulada + alcance. */
export const MDD_MAX_PLAN_DIRECTIVE_CHARS = 16000;

/** Fragmento máximo por bloque reciente dentro de la directiva del plan. */
export const MDD_MAX_PLAN_BLOCK_CHARS = 2500;

/** `getUserBrief` desde acumulado / último mensaje. */
export const MDD_MAX_USER_BRIEF_FROM_ACCUMULATED_CHARS = 5000;

/** Goal del paso `software_architect` en Planner–Executor. */
export const MDD_MAX_GOAL_SOFTWARE_ARCHITECT_CHARS = 12000;

/** Goal de clarifier / security / integration. */
export const MDD_MAX_GOAL_OTHER_NODES_CHARS = 800;

/**
 * Si el texto del cuadro de chat (pestaña MDD) supera este tamaño, el Workshop muestra
 * un aviso: trocear por sección (p. ej. `/contratos-api`) o usar adjunto / varios mensajes.
 * No bloquea el envío; es menor que los límites duros de arriba.
 */
export const MDD_LONG_PASTE_WARN_CHARS = 12000;
