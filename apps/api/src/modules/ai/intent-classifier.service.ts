import { Injectable } from "@nestjs/common";
import {
  looksLikeDbgaSpecIntegrationRequest,
} from "@theforge/shared-types";

export type ChatIntent = "explore" | "direct_edit" | "mixed";

/**
 * Clasifica la intención del mensaje del usuario en el chat.
 * No usa LLM — solo heurística ligera para decidir si activar
 * o atenuar la instrucción de detección de cambios.
 */
@Injectable()
export class IntentClassifierService {
  /**
   * Frases que indican que el usuario está explorando/preguntando,
   * NO pidiendo cambios directos.
   */
  private readonly EXPLORE_PATTERNS = [
    /qué (tal|pasaría|opinas|piensas)/i,
    /cómo (sería|funcionaría|se ve|se maneja)/i,
    /por qué/i,
    /cuál (sería|es la)/i,
    /sería mejor/i,
    /tendría sentido/i,
    /se podría/i,
    /es posible/i,
    /qué opinas/i,
    /qué tal si/i,
    /what if/i,
    /how (about|would|does)/i,
    /is it (possible|better)/i,
    /quizás/i,
    /tal vez/i,
    /maybe/i,
    /perhaps/i,
    /\?\s*$/m,  // termina con signo de interrogación
  ];

  /**
   * Frases que indican que el usuario QUIERE un cambio directo.
   */
  private readonly DIRECT_EDIT_PATTERNS = [
    /^(agrega|agregar|pon|meter|incluye|incorpora|integra)\b/i,
    /^(cambia|cambiar|modifica|modificar|actualiza|actualizar|edita|editar)\b/i,
    /^(elimina|eliminar|borra|borrar|saca|quita|remueve|remover)\b/i,
    /^(corrige|corregir|arregla|arreglar|repara|reparar)\b/i,
    /^(haz|hacer|crea|crear|genera|generar)\b.*(cambio|cambios|modificación)/i,
    /apli(ca|car) (esto|ese|el) cambio/i,
    /haz (los |esos )?cambios/i,
    /(actualiza|modifica|corrige) el documento/i,
    /integra esto/i,
    /ingrésalo/i,
  ];

  classify(message: string): ChatIntent {
    const lines = message.trim().split("\n").filter(Boolean);
    const lastLine = lines[lines.length - 1] ?? "";

    if (looksLikeDbgaSpecIntegrationRequest(message)) {
      return "direct_edit";
    }

    // Si la última línea es una afirmación corta confirmando ("sí", "dale", "aplica", "ok")
    // es una confirmación de cambio después de una pregunta del asistente
    if (/^(s[íi]|dale|aplica|ok|vale|correcto|de acuerdo|hazlo|adelante|procede)\b/i.test(lastLine.trim())) {
      return "direct_edit";
    }

    const isQuestion = this.EXPLORE_PATTERNS.some((p) => p.test(message));
    const isDirectEdit = this.DIRECT_EDIT_PATTERNS.some((p) => p.test(message));

    if (isDirectEdit) return "direct_edit";
    if (isQuestion) return "explore";

    // Mixed: si tiene verbo + pregunta, o es ambiguo
    const hasAnyVerb = /\b(agrega|cambia|modifica|pon|saca|elimina|incluye|actualiza|haz|crea)\b/i.test(message);
    if (hasAnyVerb && isQuestion) return "mixed";

    // Por defecto, si no hay señales claras, asumir exploración
    // para evitar cambios no deseados
    return "explore";
  }
}