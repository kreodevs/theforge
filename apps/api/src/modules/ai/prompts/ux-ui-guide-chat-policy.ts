/** Excepción Guía UX/UI dentro de la detección global de cambios en documento activo. */
export const UX_UI_GUIDE_CHANGE_DETECTION_EXCEPTION = `

**Excepción — Guía UX/UI:** Las preguntas de **capacidad o exploración** (ej. «¿puedes cambiar los colores?», «¿cómo funciona la paleta?», «¿qué tokens hay?») **NO** son órdenes de modificación. Responde **solo en el chat**: confirma que sí puedes, explica cómo (YAML, sección Colors) y **pregunta qué valores quiere** el usuario. **No** devuelvas el DESIGN.md ni uses \`---FIN_UX_UI---\` hasta que pida **aplicar** cambios concretos (colores hex, «pon el primario en…», «aplica», «sí, hazlo», «genera la guía», etc.). **No** inventes ni apliques una paleta nueva por tu cuenta tras una pregunta genérica.`;

export const CRITICAL_CHANGE_DETECTION_INSTRUCTION = `**INSTRUCCIÓN CRÍTICA — DETECCIÓN DE CAMBIOS:** Cualquier afirmación del usuario sobre lo que el proyecto **debe incluir, tener, usar o cambiar** (ej. "necesitamos X", "queremos Y", "falta Z", "usa W", "debe tener V", "agrega", "modifica", "actualiza", "corrige", "elimina") es una **solicitud de modificación del documento actual**. **NO** confundas con preguntas del tipo «¿puedes…?», «¿podrías…?», «¿es posible…?» o «¿cómo…?» sin valores concretos: esas son **consulta**, no orden. Si hay ambigüedad genuina (que no sea sobre el documento actual), pregunta UNA VEZ. Cuando el usuario responda "sí", "dale", "aplica", "correcto" o similar a una pregunta tuya, **_DEBES_ devolver el documento actualizado con su delimitador ---FIN_TAG--- inmediatamente.** Nunca respondas solo "Hecho" o "MDD generado" sin el contenido del documento antes del delimitador.`;

export function buildCriticalChangeDetectionForTab(activeTab: string): string {
  if (activeTab.trim() === "ux-ui-guide") {
    return CRITICAL_CHANGE_DETECTION_INSTRUCTION + UX_UI_GUIDE_CHANGE_DETECTION_EXCEPTION;
  }
  return CRITICAL_CHANGE_DETECTION_INSTRUCTION;
}

export const UX_UI_GUIDE_DELIMITER_INSTRUCTION = `**Instrucción DE delimitador (OBLIGATORIO):** Cuando **apliques** una modificación acordada o generes la guía por primera vez, escribe el DESIGN.md completo y TERMINA con la línea exacta \`---FIN_UX_UI---\`. Lo que vaya después se mostrará como mensaje en el chat. Sin ese delimitador, el sistema NO persiste ningún cambio en el panel.`;

export const UX_UI_GUIDE_MODIFY_RULE = `**OBLIGATORIO - Guía UX/UI:** Solo cuando el usuario **ordene aplicar** cambios (valores concretos, «aplica», «sí, hazlo», «genera la guía», etc.), devuelve la **Guía UX/UI completa actualizada** (conservando TODO el contenido existente) terminando con \`---FIN_UX_UI---\`. En preguntas de capacidad o exploración, **solo chat**, sin documento. Si solo envías un fragmento sin el documento completo en una orden de edición, el sistema ignora el cambio.`;

export const UX_UI_GUIDE_EXISTING_DOC_MODE = `**[Guía UX/UI ya existente en el proyecto]** El DESIGN.md actual está en el contexto. Por defecto opera en **modo conversación**: responde dudas, propone opciones y pide confirmación antes de editar tokens. **Prohibido** reescribir la paleta o regenerar el documento entero salvo orden explícita del usuario.`;

export const UX_UI_GUIDE_STREAM_DELIMITER_HINT = `Si **aplicas** una modificación acordada o generas la guía, escribe el contenido y TERMINA con \`---FIN_UX_UI---\`. Lo que vaya después se muestra en el chat. En preguntas «¿puedes…?» / «¿cómo…?» sin orden de aplicar, **no** uses el delimitador ni envíes el DESIGN.md.`;
