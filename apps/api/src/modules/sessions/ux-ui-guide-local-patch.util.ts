/**
 * Parches deterministas en DESIGN.md cuando el usuario pidió aplicar tokens
 * (p. ej. cambio de color) pero el modelo solo respondió en chat sin ---FIN_UX_UI---.
 */

import {
  buildUxGuideChatAck,
  isUxGuideConfirmationMessage,
} from "./ux-ui-guide-chat-intent.util.js";

export const UX_GUIDE_CHAT_NO_CHANGE =
  "No se guardaron cambios en la Guía UX/UI. La respuesta no incluyó el documento con ---FIN_UX_UI---. Repite la petición o edita el panel directamente.";

export type ColorTokenMap = Record<string, string>;

const SEMANTIC_LABELS: Array<{ re: RegExp; keys: string[] }> = [
  { re: /\b(principal|primario|primary)\b/i, keys: ["primary", "accent"] },
  { re: /\b(acento|accent)\b/i, keys: ["accent"] },
  { re: /\b(secundario|secondary)\b/i, keys: ["secondary"] },
  { re: /\b(terciario|tertiary)\b/i, keys: ["tertiary"] },
  { re: /\b(ámbar|amber|ambar)\b/i, keys: ["tertiary"] },
  { re: /\b(verde|green)\b/i, keys: ["secondary"] },
  { re: /\b(azul|blue)\b/i, keys: ["primary"] },
  { re: /\b(rojo|red|danger|error|destructive)\b/i, keys: ["danger"] },
  { re: /\b(fondo|background|surface)\b/i, keys: ["background", "surface"] },
  { re: /\b(foreground|texto|text)\b/i, keys: ["foreground"] },
  { re: /\b(neutral|muted|gris|gray)\b/i, keys: ["muted", "neutral"] },
  { re: /\b(success|éxito|exito)\b/i, keys: ["success"] },
  { re: /\b(warning|advertencia)\b/i, keys: ["warning"] },
  { re: /\b(info|informaci[oó]n)\b/i, keys: ["info"] },
];

function normalizeHex(raw: string): string {
  const h = raw.replace(/^#/, "").trim().toUpperCase();
  return `#${h}`;
}

/** Extrae #RRGGBB del mensaje (con o sin `#`). */
export function extractHexFromUxGuideMessage(message: string): string | null {
  const t = message.trim();
  const withHash = t.match(/#([0-9a-f]{6})\b/i);
  if (withHash) return `#${withHash[1]!.toUpperCase()}`;

  const bare = t.match(/\b([0-9a-f]{6})\b/i);
  if (bare) return `#${bare[1]!.toUpperCase()}`;
  return null;
}

/** Claves YAML `colors.*` a actualizar según la intención del usuario. */
export function resolveUxGuideColorKeys(userMessage: string): string[] {
  const m = userMessage.toLowerCase();
  if (/\b(principal|primario|primary)\b/.test(m)) return ["primary", "accent"];
  if (/\b(secundario|secondary)\b/.test(m)) return ["secondary"];
  if (/\b(terciario|tertiary)\b/.test(m)) return ["tertiary"];
  if (/\b(acento|accent)\b/.test(m)) return ["accent", "tertiary"];
  if (/\b(fondo|background)\b/.test(m)) return ["background", "surface"];
  if (/\b(neutral|muted|gris|gray|gris\b)/.test(m)) return ["muted", "neutral"];
  if (extractHexFromUxGuideMessage(userMessage)) return ["primary", "accent"];
  return [];
}

/** Último mensaje del asistente en el hilo del tab (propuesta previa a «sí, aplícalo»). */
export function getLastAssistantChatContent(
  history: Array<{ role: string; content: string }>,
): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry?.role === "assistant" && entry.content?.trim()) {
      return entry.content.trim();
    }
  }
  return undefined;
}

/** Extrae mapa token → hex de una propuesta del asistente (listas, YAML inline, etc.). */
export function extractColorMapFromProposal(text: string): ColorTokenMap {
  const map: ColorTokenMap = {};

  for (const m of text.matchAll(
    /\b(primary|secondary|tertiary|accent|background|foreground|surface|muted|neutral|danger|success|warning|info)\s*:\s*["']?(#?[0-9A-Fa-f]{6})\b/gi,
  )) {
    map[m[1]!.toLowerCase()] = normalizeHex(m[2]!);
  }

  for (const m of text.matchAll(
    /\|\s*\*{0,2}(primary|secondary|tertiary|accent|background|foreground|surface|muted|neutral|danger|success|warning|info)\*{0,2}\s*\|\s*`?(#?[0-9A-Fa-f]{6})`?/gi,
  )) {
    map[m[1]!.toLowerCase()] = normalizeHex(m[2]!);
  }

  for (const line of text.split("\n")) {
    const hexMatch = line.match(/#([0-9A-Fa-f]{6})\b/i);
    if (!hexMatch) continue;
    const hex = normalizeHex(`#${hexMatch[1]!}`);
    for (const { re, keys } of SEMANTIC_LABELS) {
      if (!re.test(line)) continue;
      for (const key of keys) {
        map[key] = hex;
      }
    }
  }

  return map;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchYamlColorKey(
  content: string,
  key: string,
  hex: string,
): { next: string; changed: boolean } {
  const keyRe = escapeRegExp(key);
  const quoted = new RegExp(
    `(^|\\n)([ \\t]*${keyRe}:\\s*)(["']?)#[0-9A-Fa-f]{3,8}\\3`,
    "im",
  );
  if (quoted.test(content)) {
    return {
      next: content.replace(quoted, `$1$2"${hex}"`),
      changed: true,
    };
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/m);
  if (!fmMatch) return { next: content, changed: false };

  const fm = fmMatch[1]!;
  if (!/\ncolors:\s*\n/.test(`\n${fm}\n`) && !/^colors:\s*\n/m.test(fm)) {
    return { next: content, changed: false };
  }
  if (new RegExp(`^[ \\t]*${keyRe}:`, "m").test(fm)) {
    return { next: content, changed: false };
  }

  const insert = fm.replace(/(\ncolors:\s*\n)/i, `$1  ${key}: "${hex}"\n`);
  if (insert === fm) return { next: content, changed: false };

  return {
    next: content.replace(fmMatch[0], `---\n${insert}\n---`),
    changed: true,
  };
}

const TABLE_ROW_LABELS: Record<string, string[]> = {
  primary: ["primary", "primario", "principal", "accent", "acento"],
  accent: ["accent", "acento", "primary", "primario", "principal"],
  secondary: ["secondary", "secundario"],
  tertiary: ["tertiary", "terciario"],
  background: ["background", "fondo"],
  muted: ["muted", "neutral", "gris", "gray"],
  neutral: ["neutral", "muted", "gris", "gray"],
  danger: ["danger", "error", "rojo", "red"],
  success: ["success", "verde", "green"],
  warning: ["warning", "ámbar", "amber", "ambar"],
  foreground: ["foreground", "texto", "text"],
};

function patchMarkdownTableHex(
  content: string,
  keys: string[],
  hex: string,
): { next: string; changed: boolean } {
  let next = content;
  let changed = false;
  const labels = new Set<string>();
  for (const key of keys) {
    for (const label of TABLE_ROW_LABELS[key] ?? [key]) {
      labels.add(label);
    }
  }

  for (const label of labels) {
    const labelRe = escapeRegExp(label);
    const rowRe = new RegExp(
      `(\\|\\s*\\*{0,2}${labelRe}\\*{0,2}[^|\\n]*\\|[^|\\n]*\\|\\s*)\`?(#[0-9A-Fa-f]{6})\`?(\\s*\\|)`,
      "gi",
    );
    const rowReCol2 = new RegExp(
      `(\\|\\s*\\*{0,2}${labelRe}\\*{0,2}\\s*\\|\\s*)\`?(#[0-9A-Fa-f]{6})\`?(\\s*\\|)`,
      "gi",
    );
    for (const re of [rowRe, rowReCol2]) {
      if (re.test(next)) {
        next = next.replace(re, `$1${hex}$3`);
        changed = true;
      }
    }
  }

  return { next, changed };
}

function applyColorMapToGuide(
  currentGuide: string,
  colorMap: ColorTokenMap,
): { next: string; changed: boolean } {
  let next = currentGuide;
  let changed = false;

  for (const [key, hex] of Object.entries(colorMap)) {
    const yaml = patchYamlColorKey(next, key, hex);
    next = yaml.next;
    changed ||= yaml.changed;

    const table = patchMarkdownTableHex(next, [key], hex);
    next = table.next;
    changed ||= table.changed;
  }

  return { next, changed };
}

function buildPaletteAck(colorMap: ColorTokenMap): string {
  const parts = Object.entries(colorMap)
    .slice(0, 8)
    .map(([key, hex]) => `${key} ${hex}`);
  if (parts.length === 0) return buildUxGuideChatAck();
  return `Guía UX/UI actualizada (${parts.join(", ")}). Revisa la vista previa del Design System.`;
}

/** El modelo afirmó un cambio en chat sin entregar documento. */
export function responseClaimsUxGuideAppliedWithoutDoc(response: string): boolean {
  const t = response.trim();
  if (!t || t.length > 900) return false;
  if (/^---\s*\n[\s\S]*\n---/m.test(t)) return false;
  return (
    /\b(es ahora|qued[oó] en|actualic|modific|establec|he cambiado|he actualizado|he ajustado|he aplicado|aplicad[oa])\b/i.test(
      t,
    ) ||
    /^(el color|los colores|he |te confirmo|listo)/i.test(t)
  );
}

export type UxGuideLocalPatchResult = {
  content: string;
  message: string;
};

/**
 * Aplica cambios de color sobre el DESIGN.md existente.
 * - Mensaje con hex concreto → parche directo.
 * - Confirmación («sí, aplícalos») → lee la paleta del último mensaje del asistente.
 */
export function tryApplyUxGuideLocalPatch(
  currentGuide: string,
  userMessage: string,
  priorAssistantMessage?: string,
): UxGuideLocalPatchResult | null {
  if (!currentGuide.trim()) return null;

  const hex = extractHexFromUxGuideMessage(userMessage);
  const keys = resolveUxGuideColorKeys(userMessage);
  if (hex && keys.length > 0) {
    const single = applyColorMapToGuide(
      currentGuide,
      Object.fromEntries(keys.map((k) => [k, hex])),
    );
    if (!single.changed || single.next.trim() === currentGuide.trim()) return null;
    return {
      content: single.next,
      message: buildUxGuideChatAck(userMessage),
    };
  }

  if (isUxGuideConfirmationMessage(userMessage) && priorAssistantMessage?.trim()) {
    const colorMap = extractColorMapFromProposal(priorAssistantMessage);
    if (Object.keys(colorMap).length === 0) return null;

    const applied = applyColorMapToGuide(currentGuide, colorMap);
    if (!applied.changed || applied.next.trim() === currentGuide.trim()) return null;

    return {
      content: applied.next,
      message: buildPaletteAck(colorMap),
    };
  }

  return null;
}
