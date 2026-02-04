import type { MDDStateType } from "../state/index.js";

/** Prefijos que suelen preceder al requisito real del usuario (se eliminan para obtener el brief). */
const COMMAND_PREFIXES = [
  /^regenera\s+(el\s+)?(documento|mdd|documento\s+)?,?\s*/i,
  /^genera\s+(el\s+)?(documento|mdd)\s*,?\s*/i,
  /^esto\s+es\s+lo\s+que\s+quiero\s+(hacer|)\s*:?\s*/i,
  /^quiero\s+que\s+(el\s+documento\s+)?/i,
  /^necesito\s+que\s+(el\s+documento\s+)?/i,
  /^haz\s+(el\s+)?(documento|mdd)\s*,?\s*/i,
  /^elabora\s+(el\s+)?(documento|mdd)\s*,?\s*/i,
  /^petición\s*:?\s*/i,
];

/** Longitud mínima para considerar un mensaje como "brief" sustancial (evitar "sí", "ok"). */
const MIN_BRIEF_LENGTH = 25;

/**
 * Extrae un brief de una línea: quita prefijos de comando y devuelve el núcleo del requisito.
 */
function stripCommandPrefix(text: string): string {
  let out = text.trim();
  for (const re of COMMAND_PREFIXES) {
    out = out.replace(re, "").trim();
  }
  return out;
}

/**
 * Devuelve una frase corta "lo que el usuario pide" para inyectar al inicio del contexto de cada agente.
 * Así todos los agentes ven el mismo objetivo: "una aplicación que hace X".
 */
export function getUserBrief(state: MDDStateType): string {
  const last = (state.lastUserMessage ?? "").trim();
  if (last.length >= MIN_BRIEF_LENGTH) {
    const stripped = stripCommandPrefix(last);
    if (stripped.length >= MIN_BRIEF_LENGTH) return stripped;
  }
  const accumulated = (state.userInputAccumulated ?? "").trim();
  if (accumulated.length >= MIN_BRIEF_LENGTH) {
    const lastBlock = accumulated.includes("---")
      ? accumulated.split("---").map((s) => s.trim()).filter(Boolean).pop() ?? accumulated
      : accumulated;
    const withoutPeticion = lastBlock.replace(/^petición\s*:?\s*/i, "").trim();
    const stripped = stripCommandPrefix(withoutPeticion);
    if (stripped.length >= MIN_BRIEF_LENGTH) return stripped.slice(0, 500);
    if (lastBlock.length >= MIN_BRIEF_LENGTH) return lastBlock.slice(0, 500);
  }
  const scope = (state.clarifiedScope ?? "").trim();
  if (scope.length >= MIN_BRIEF_LENGTH) {
    const firstParagraph = scope.split(/\n\n+/)[0]?.trim() ?? scope;
    return firstParagraph.slice(0, 400);
  }
  const dbga = (state.dbgaContent ?? "").trim();
  if (dbga.length >= MIN_BRIEF_LENGTH) return dbga.slice(0, 400);
  return "";
}

/** Respuestas breves que no son requisitos (sí, ok, de acuerdo, etc.). */
const TRIVIAL_REPLY = /^(?:Usuario:\s*)?(?:s[ií]|s[ií]\s*,\s*de\s*acuerdo|de\s*acuerdo|ok|vale|correcto|estoy\s+de\s+acuerdo|perfecto|acepto)[\s.]*$/i;

const MIN_REQUIREMENTS_LENGTH = 50;
const MAX_REQUIREMENTS_CHARS = 1500;

/**
 * Texto de requisitos o petición del usuario para inyectar al Arquitecto (§3 y §4).
 * Prioridad: userInputAccumulated (bloques sustanciales que no sean solo "sí"/"ok"), luego dbgaContent.
 */
export function getUserExplicitRequirements(state: MDDStateType): string {
  const accumulated = (state.userInputAccumulated ?? "").trim();
  if (accumulated.length >= MIN_REQUIREMENTS_LENGTH) {
    const blocks = accumulated.split(/\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
    const substantial = blocks.filter(
      (b) => b.length >= MIN_REQUIREMENTS_LENGTH && !TRIVIAL_REPLY.test(b.replace(/^Usuario:\s*/i, "").trim()),
    );
    if (substantial.length > 0) {
      const combined = substantial.join("\n\n");
      return combined.slice(0, MAX_REQUIREMENTS_CHARS);
    }
  }
  const dbga = (state.dbgaContent ?? "").trim();
  if (dbga.length >= MIN_REQUIREMENTS_LENGTH && !dbga.startsWith("(Sin Benchmark")) {
    const peticionMatch = dbga.match(/(?:Petición|Usuario|Respuesta del usuario)[:\s]*\n([\s\S]{1,1200})/i);
    if (peticionMatch?.[1]?.trim()) return peticionMatch[1].trim().slice(0, MAX_REQUIREMENTS_CHARS);
    return dbga.slice(0, MAX_REQUIREMENTS_CHARS);
  }
  return "";
}

const MIN_SUBSTANTIVE_LENGTH = 25;

/** Bloques que parecen pregunta del sistema, no requisito del usuario (excluir de directiva). */
const SYSTEM_QUESTION_PATTERN = /^(?:¿Ejecutar\s+este\s+plan|¿Puedes\s+detallar|¿Quieres\s+que\s+avancemos)/i;

/** Indicios de requisito de diseño: entidades, modelo, diagrama, aplicaciones, roles, permisos, stack, arquitectura. */
const DESIGN_REQUIREMENT_REGEX =
  /\b(aplicaciones?|diagrama\s*(er|entidad|relaci[oó]n)?|entidad|entidades|modelo\s+de\s+datos|roles?|permisos?|relaci[oó]n(es)?|tablas?|usuarios?|CREATE\s+TABLE|stack|arquitectura|frontend|backend|framework|tecnolog[ií]a|nestjs|react|vue|angular|node\.?js|postgresql|mysql|vite|webpack|secci[oó]n\s*2|§2)\b/i;

/**
 * Último mensaje sustancial del usuario (para usarlo como directiva al confirmar un plan).
 * Prioridad 1: bloque que contenga indicios de requisito de diseño (entidades, aplicaciones, diagrama, roles, etc.).
 * Prioridad 2: último bloque sustancial y no trivial que no sea pregunta del sistema.
 * Fallback: lastUserMessage si es sustancial.
 */
export function getLastSubstantiveUserMessage(state: MDDStateType): string {
  const accumulated = (state.userInputAccumulated ?? "").trim();
  if (accumulated.length >= MIN_SUBSTANTIVE_LENGTH) {
    const blocks = accumulated.split(/\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
    let fallback = "";
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      const withoutPrefix = b.replace(/^Usuario:\s*|Plan aprobado:\s*/gi, "").trim();
      if (withoutPrefix.length < MIN_SUBSTANTIVE_LENGTH || TRIVIAL_REPLY.test(withoutPrefix)) continue;
      if (SYSTEM_QUESTION_PATTERN.test(withoutPrefix)) continue;
      if (DESIGN_REQUIREMENT_REGEX.test(withoutPrefix)) return withoutPrefix.slice(0, 800);
      if (!fallback) fallback = withoutPrefix.slice(0, 800);
    }
    if (fallback) return fallback;
  }
  const last = (state.lastUserMessage ?? "").trim();
  if (last.length >= MIN_SUBSTANTIVE_LENGTH && !TRIVIAL_REPLY.test(last)) return last.slice(0, 800);
  return "";
}

const MAX_PLAN_DIRECTIVE_CHARS = 2000;
const MAX_PLAN_BLOCKS = 4;

/**
 * Directiva completa para el plan: agrega varios bloques con requisitos de diseño + fragmento de clarifiedScope.
 * Usar como planUserIntent para que el Arquitecto y el Critic reciban la intención completa (no solo el último mensaje).
 */
export function getPlanDirective(state: MDDStateType): string {
  const parts: string[] = [];
  const accumulated = (state.userInputAccumulated ?? "").trim();
  if (accumulated.length >= MIN_SUBSTANTIVE_LENGTH) {
    const blocks = accumulated.split(/\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
    const substantial: string[] = [];
    for (let i = blocks.length - 1; i >= 0 && substantial.length < MAX_PLAN_BLOCKS; i--) {
      const b = blocks[i];
      const withoutPrefix = b.replace(/^Usuario:\s*|Plan aprobado:\s*|Petición:\s*/gi, "").trim();
      if (withoutPrefix.length < MIN_SUBSTANTIVE_LENGTH || TRIVIAL_REPLY.test(withoutPrefix)) continue;
      if (SYSTEM_QUESTION_PATTERN.test(withoutPrefix)) continue;
      substantial.unshift(withoutPrefix.slice(0, 600));
    }
    if (substantial.length > 0) {
      parts.push("Requisitos del usuario (conversación reciente):\n" + substantial.join("\n\n---\n\n"));
    }
  }
  const scope = (state.clarifiedScope ?? "").trim();
  if (scope.length >= 50) {
    const fragment = scope.slice(0, 500) + (scope.length > 500 ? "…" : "");
    parts.push("Alcance clarificado (resumen):\n" + fragment);
  }
  const combined = parts.join("\n\n");
  if (combined.length > MAX_PLAN_DIRECTIVE_CHARS) return combined.slice(0, MAX_PLAN_DIRECTIVE_CHARS) + "…";
  if (combined) return combined;
  return getLastSubstantiveUserMessage(state);
}
