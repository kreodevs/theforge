/**
 * Detecta si un turno en la pestaña Guía UX/UI debe persistir el documento
 * o quedarse solo en el chat (preguntas de capacidad, exploración, etc.).
 */

const CAPABILITY_RE =
  /^\s*¿?\s*(puedes|podr[ií]as|podrias|se puede|es posible|sabes si|me puedes|me podr[ií]as|eres capaz)\b/i;

const CAPABILITY_PHRASE_RE =
  /\b(puedes|podr[ií]as|podrias)\s+(hacer|ayudar|modificar|cambiar|ajustar|editar)\b/i;

const EXPLORATORY_RE =
  /^\s*¿?\s*(qué|que|cuál|cual|cómo|como|dónde|donde|por qué|porque|explica|muéstrame|muestrame|cuéntame|cuentame|dime qué|dime que)\b/i;

const EXPLICIT_MODIFY_RE =
  /\b(agrega|añade|anade|modifica|actualiza|regenera|reescribe|aplica|pon|usa|establece|define|elimina|quita|reemplaza|cambia|ajusta|edita|incorpora|sustituye)\b/i;

const GENERATE_GUIDE_RE =
  /\b(genera|crea|elabora|redacta|construye|produce|escribe)\b.*\b(gu[ií]a|design\.md|ux\/ui|design system|tokens)\b/i;

const CONFIRMATION_RE =
  /^\s*(s[ií]|dale|aplica|correcto|adelante|ok|de acuerdo|confirmo|hazlo|procede|haz\s*los?\s*cambios)\b/i;

/** Normaliza mensaje del usuario para detectar confirmaciones («Aplícalos» → `aplicalos`). */
export function normalizeUxGuideUserMessage(userMessage: string): string {
  return userMessage
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** «Sí, aplícalos» / «Aplicalos» / «dale, haz los cambios» tras una propuesta del asistente. */
export function isUxGuideConfirmationMessage(userMessage: string): boolean {
  const t = normalizeUxGuideUserMessage(userMessage);
  if (!t) return false;
  if (
    /^(si|dale|aplica|correcto|adelante|ok|de acuerdo|confirmo|hazlo|procede|haz\s*los?\s*cambios)\b/.test(
      t,
    )
  ) {
    return true;
  }
  /** Imperativo sin «sí»: «Aplicalos», «aplícalo», «aplicar», etc. */
  if (/^aplic(a|alo|alos|ar|arla|arlos|ando|ad[oa]s?)\b/.test(t)) {
    return true;
  }
  if (/^si\b/.test(t) && /(aplic|hazlo|haz\s*los?\s*cambios|de acuerdo|dale)/.test(t)) {
    return true;
  }
  return false;
}

const HEX_COLOR_RE = /#([0-9a-f]{3,8})\b/i;

export const UX_GUIDE_CHAT_ACK =
  "Guía UX/UI actualizada. Revisa el panel del Design System.";

/** Mensaje de confirmación cuando el modelo persiste el doc sin texto tras ---FIN_UX_UI---. */
export function buildUxGuideChatAck(userMessage?: string): string {
  const msg = (userMessage ?? "").trim();
  if (!msg) return UX_GUIDE_CHAT_ACK;

  const hexMatch = msg.match(/#?([0-9a-f]{6})\b/i);
  const hex = hexMatch ? `#${hexMatch[1]!.toUpperCase()}` : null;

  if (hex && /\b(principal|primario|primary|accent|acento)\b/i.test(msg)) {
    return `Guía UX/UI actualizada: color principal establecido en ${hex}. Revisa la vista previa del Design System.`;
  }
  if (hex) {
    return `Guía UX/UI actualizada con el color ${hex}. Revisa la vista previa del Design System.`;
  }
  if (/\b(color|colores|paleta|tipograf|token|fondo|background)\b/i.test(msg)) {
    return "Guía UX/UI actualizada con los tokens solicitados. Revisa la vista previa del Design System.";
  }
  return UX_GUIDE_CHAT_ACK;
}

/**
 * Evita burbuja de chat vacía cuando el panel sí recibió el DESIGN.md.
 * (Paridad con benchmarkAssistantChatMessage / BENCHMARK_CHAT_ACK.)
 */
export function uxGuideAssistantChatMessage(
  rawChat: string,
  finalUxContent: string | undefined,
  userMessage?: string,
): string {
  const chat = rawChat.trim();
  if (!finalUxContent?.trim()) return chat;

  if (
    !chat ||
    chat === UX_GUIDE_CHAT_ACK ||
    /^guía ux\/ui (actualizada|generada)/i.test(chat)
  ) {
    return buildUxGuideChatAck(userMessage);
  }
  if (/^---\s*\n|^name:\s|^colors:\s*\n/i.test(chat)) {
    return buildUxGuideChatAck(userMessage);
  }
  if (chat.length > 600 && /colors:\s*\n/i.test(chat)) {
    return buildUxGuideChatAck(userMessage);
  }
  return chat;
}

/** Pregunta de capacidad o exploración (no orden de edición). */
export function isUxGuideCapabilityOrExploratoryQuestion(userMessage: string): boolean {
  const t = userMessage.trim();
  if (!t) return false;
  if (EXPLICIT_MODIFY_RE.test(t) && !CAPABILITY_PHRASE_RE.test(t)) return false;
  if (HEX_COLOR_RE.test(t) && EXPLICIT_MODIFY_RE.test(t)) return false;
  if (CAPABILITY_RE.test(t)) return true;
  if (CAPABILITY_PHRASE_RE.test(t) && !EXPLICIT_MODIFY_RE.test(t)) return true;
  if (EXPLORATORY_RE.test(t) && !EXPLICIT_MODIFY_RE.test(t)) return true;
  return false;
}

/** Orden explícita de modificar o generar la guía. */
export function isUxGuideExplicitModifyRequest(userMessage: string): boolean {
  const t = userMessage.trim();
  if (!t) return false;
  if (isUxGuideConfirmationMessage(userMessage)) return true;
  if (CONFIRMATION_RE.test(t)) return true;
  if (GENERATE_GUIDE_RE.test(t)) return true;
  if (HEX_COLOR_RE.test(t)) return true;
  if (EXPLICIT_MODIFY_RE.test(t) && !isUxGuideCapabilityOrExploratoryQuestion(t)) return true;
  return false;
}

/**
 * Si debe persistirse actualización del documento Guía UX/UI tras el turno.
 * Con guía existente, por defecto solo chat salvo orden explícita.
 */
export function shouldPersistUxGuideFromChat(
  userMessage: string,
  hasExistingGuide: boolean,
): boolean {
  if (isUxGuideExplicitModifyRequest(userMessage)) return true;
  if (isUxGuideCapabilityOrExploratoryQuestion(userMessage)) return false;
  if (!hasExistingGuide) {
    return GENERATE_GUIDE_RE.test(userMessage.trim()) || CONFIRMATION_RE.test(userMessage.trim());
  }
  return false;
}

/** La respuesta parece un DESIGN.md completo (YAML + secciones), no solo chat. */
export function responseLooksLikeUxGuideDocument(response: string): boolean {
  const trimmed = response.trim();
  if (trimmed.length < 200) return false;
  return (
    /#\s*Guía\s*UX\/UI/i.test(trimmed) ||
    /^#?\s*Guía\s*UX\/UI/im.test(trimmed) ||
    /^---\s*\n/i.test(trimmed) ||
    /^name:\s*["']?[A-Z]/i.test(trimmed) ||
    (/^---\s*\n[\s\S]*\n---/m.test(trimmed) &&
      (/##\s*Overview/i.test(trimmed) || /colors:\s*\n/i.test(trimmed)))
  );
}

/** Respuesta corta conversacional sin cuerpo de guía (resúmenes tipo "He ajustado…"). */
export function responseLooksConversationalOnly(response: string): boolean {
  const trimmed = response.trim();
  if (trimmed.length >= 1200) return false;
  if (/^---\s*\n[\s\S]*\n---/m.test(trimmed)) return false;
  if (/##\s*Overview/i.test(trimmed)) return false;
  if (/^---\s*\n/i.test(trimmed) && /typography:\s*\n/i.test(trimmed)) return false;
  return (
    /^(sí|si|claro|por supuesto|puedo|he |te |la guía|los colores|actualmente)/i.test(trimmed) ||
    (!responseLooksLikeUxGuideDocument(trimmed) && trimmed.length < 900)
  );
}

export type UxGuideFallbackParse = {
  hasUx: boolean;
  uxDocPart: string | undefined;
  rawChat: string;
};

/**
 * Fallback cuando el modelo no puso ---FIN_UX_UI---.
 * No aplica si el usuario solo preguntó capacidad/exploración o la respuesta es solo chat.
 */
export function tryUxGuideDocFallback(
  safeResponse: string,
  userMessage: string,
  hasExistingGuide: boolean,
  currentHasUx: boolean,
  currentUxDocPart: string | undefined,
  currentRawChat: string,
): UxGuideFallbackParse {
  const base: UxGuideFallbackParse = {
    hasUx: currentHasUx,
    uxDocPart: currentUxDocPart,
    rawChat: currentRawChat,
  };
  if (currentHasUx) return base;
  if (!shouldPersistUxGuideFromChat(userMessage, hasExistingGuide)) return base;
  if (responseLooksConversationalOnly(safeResponse)) return base;
  if (!responseLooksLikeUxGuideDocument(safeResponse)) return base;

  const trimmed = safeResponse.trim();
  const docStartMatch = trimmed.match(/#\s*Guía\s*UX\/UI/i);
  const yamlStartMatch = trimmed.match(/^---\s*\n/);
  const yamlInlineStart =
    !docStartMatch && !yamlStartMatch && /^name:\s*["']?[A-Z]/i.test(trimmed);
  const docStartIdx = docStartMatch?.index ?? 0;
  const hasIntro = docStartIdx > 0 && trimmed.slice(0, docStartIdx).trim().length > 0;
  let uxDocPart: string;
  const chatParts: string[] = [];

  if (docStartMatch) {
    const docSection = docStartIdx > 0 ? trimmed.slice(docStartIdx) : trimmed;
    if (hasIntro) chatParts.push(trimmed.slice(0, docStartIdx).trim());
    const hrMatch = docSection.match(/\n\s*[-*_]{3,}\s*\n/);
    if (hrMatch?.index != null) {
      uxDocPart = docSection.slice(0, hrMatch.index).trim();
      const afterHr = docSection.slice(hrMatch.index + hrMatch[0].length).trim();
      if (afterHr.length > 0) chatParts.push(afterHr);
    } else {
      uxDocPart = docSection.trim();
    }
  } else if (yamlStartMatch || yamlInlineStart) {
    uxDocPart = trimmed;
  } else {
    uxDocPart = trimmed;
  }

  return {
    hasUx: true,
    uxDocPart,
    rawChat:
      chatParts.length > 0
        ? chatParts.join("\n\n")
        : buildUxGuideChatAck(userMessage),
  };
}

/**
 * Tras split por ---FIN_UX_UI---: anula persistencia si el turno era solo consulta.
 */
export function gateUxGuideSplitResult(
  userMessage: string,
  hasExistingGuide: boolean,
  hasUx: boolean,
  uxDocPart: string | undefined,
  uxSplit: { docPart: string; chatPart: string } | null,
  safeResponse: string,
  currentRawChat: string,
): UxGuideFallbackParse {
  if (!hasUx || !uxSplit) {
    return { hasUx, uxDocPart, rawChat: currentRawChat };
  }
  if (shouldPersistUxGuideFromChat(userMessage, hasExistingGuide)) {
    return {
      hasUx: true,
      uxDocPart,
      rawChat: uxSplit.chatPart.trim() || buildUxGuideChatAck(userMessage),
    };
  }
  const chatOnly =
    uxSplit.chatPart.trim() ||
    (responseLooksConversationalOnly(safeResponse) ? safeResponse.trim() : "");
  return {
    hasUx: false,
    uxDocPart: undefined,
    rawChat: chatOnly || currentRawChat,
  };
}
