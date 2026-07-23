/**
 * Fallback local cuando el LLM no devuelve JSON válido en modo asistido (freeform/structured).
 */

import { analyzeGaps, filterResolvedGaps } from "./phase0-gap-analyzer.js";
import { mergePhase0StringList } from "./phase0-normalize.util.js";
import type { Phase0Gap, Phase0InterviewState } from "./phase0.types.js";
import type { Phase0TemplateKind } from "./phase0-template-detect.util.js";

export function patchMarkdownUsuarios(markdown: string, answer: string): string {
  const bullet = `- ${answer.trim()}`;
  if (!answer.trim()) return markdown;
  if (/\*\*Usuarios objetivo:\*\*/i.test(markdown)) {
    const lines = markdown.split("\n");
    const idx = lines.findIndex((l) => /\*\*Usuarios objetivo:\*\*/i.test(l));
    if (idx >= 0) {
      let insert = idx + 1;
      while (insert < lines.length && lines[insert]!.trim().startsWith("- ")) insert += 1;
      lines.splice(insert, 0, bullet);
      return lines.join("\n");
    }
  }
  const propositoMatch = markdown.match(/(##\s*1\.\s*Prop[oó]sito[^\n]*\n)/i);
  if (propositoMatch) {
    return markdown.replace(
      propositoMatch[0],
      `${propositoMatch[0]}\n**Usuarios objetivo:**\n${bullet}\n`,
    );
  }
  return `${markdown.trim()}\n\n**Usuarios objetivo:**\n${bullet}\n`;
}

export function patchMarkdownBulletSection(
  markdown: string,
  sectionHeadingRe: RegExp,
  bulletLine: string,
): string {
  const lines = markdown.split("\n");
  const idx = lines.findIndex((l) => sectionHeadingRe.test(l.trim()));
  if (idx < 0) return markdown;
  let insert = idx + 1;
  while (insert < lines.length) {
    const t = lines[insert]!.trim();
    if (/^##\s+\d+\./.test(t)) break;
    if (t.startsWith("- ")) insert += 1;
    else if (t === "") insert += 1;
    else break;
  }
  lines.splice(insert, 0, bulletLine);
  return lines.join("\n");
}

function gapForQuestion(state: Phase0InterviewState): Phase0Gap | undefined {
  const q = (state.ultimaPregunta ?? "").trim().toLowerCase();
  if (!q) return state.questionPlan[state.planCursor];
  return (
    state.gaps.find((g) => {
      const sug = (g.sugerenciaPregunta ?? "").trim().toLowerCase();
      return sug && (q.includes(sug) || sug.includes(q));
    }) ?? state.questionPlan[state.planCursor]
  );
}

export function applyAssistedAnswerLocalFallback(opts: {
  state: Phase0InterviewState;
  answer: string;
  templateKind: Phase0TemplateKind;
}): { impacto: string; cambios: string[] } {
  const { state, answer, templateKind } = opts;
  const ans = answer.trim();
  const cambios: string[] = [];
  if (!ans) {
    return {
      impacto: "No se recibió texto en la respuesta.",
      cambios: [],
    };
  }

  const gap = gapForQuestion(state);
  const seccion = gap?.seccion ?? "";
  const q = (state.ultimaPregunta ?? "").toLowerCase();

  switch (seccion) {
    case "proposito":
      if (gap?.descripcion.includes("usuarios objetivo") || /qui[eé]n|usuarios?/.test(q)) {
        state.borrador.proposito.usuarios = mergePhase0StringList(
          state.borrador.proposito.usuarios,
          [ans],
        );
        if (templateKind !== "structured") {
          state.workingMarkdown = patchMarkdownUsuarios(state.workingMarkdown ?? "", ans);
        }
        cambios.push("proposito.usuarios");
      } else if (gap?.descripcion.includes("NO hace") || /fuera de alcance|no hace/.test(q)) {
        state.borrador.proposito.outOfScope = mergePhase0StringList(
          state.borrador.proposito.outOfScope,
          [ans],
        );
        cambios.push("proposito.outOfScope");
      } else if (gap?.descripcion.includes("problema principal")) {
        state.borrador.proposito.problema = ans;
        cambios.push("proposito.problema");
      }
      break;
    case "reglasNegocio":
      state.borrador.reglasNegocio = mergePhase0StringList(state.borrador.reglasNegocio, [ans]);
      if (templateKind !== "structured" && state.workingMarkdown) {
        state.workingMarkdown = patchMarkdownBulletSection(
          state.workingMarkdown,
          /##\s+\d+\.\s*Reglas de Negocio/i,
          `- ${ans}`,
        );
      }
      cambios.push("reglasNegocio");
      break;
    case "roles":
      if (!state.borrador.roles.some((r) => r.rol.toLowerCase() === ans.toLowerCase())) {
        state.borrador.roles.push({ rol: ans, permisos: [] });
      }
      cambios.push("roles");
      break;
    case "flujos":
      state.borrador.flujos.push({ nombre: "Flujo principal", pasos: [ans] });
      cambios.push("flujos");
      break;
    case "edgeCases":
      state.borrador.edgeCases = mergePhase0StringList(state.borrador.edgeCases, [ans]);
      cambios.push("edgeCases");
      break;
    case "integraciones":
      state.borrador.integraciones = mergePhase0StringList(state.borrador.integraciones, [ans]);
      cambios.push("integraciones");
      break;
    default:
      if (/qui[eé]n|usuarios?|usar/.test(q)) {
        state.borrador.proposito.usuarios = mergePhase0StringList(
          state.borrador.proposito.usuarios,
          [ans],
        );
        if (templateKind !== "structured") {
          state.workingMarkdown = patchMarkdownUsuarios(state.workingMarkdown ?? "", ans);
        }
        cambios.push("proposito.usuarios");
      }
      break;
  }

  state.gaps = filterResolvedGaps(
    analyzeGaps(state.borrador),
    state.borrador,
    state.ultimaPregunta,
  );

  return {
    impacto:
      cambios.length > 0
        ? "Respuesta incorporada localmente (el modelo no devolvió una actualización válida)."
        : "Respuesta registrada; revisa el documento manualmente si no ves cambios.",
    cambios,
  };
}
