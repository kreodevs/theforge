/**
 * Convierte secciones "Flujo de …" en diagramas Mermaid (flowchart).
 */

const FLOW_HEADING = /^#{2,4}\s+Flujo de\s+/i;

function escapeMermaidLabel(s: string): string {
  return s.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")").slice(0, 72);
}

function slugId(i: number): string {
  return `S${i}`;
}

/** "Evento en origen: texto" → etiqueta corta para nodo */
function stepLabel(line: string): string {
  const t = line.replace(/^[-*]\s+/, "").trim();
  const colon = t.match(/^([^:]+):\s*(.+)$/);
  if (colon) return `${colon[1]!.trim()}: ${colon[2]!.trim().slice(0, 40)}`;
  return t.slice(0, 60);
}

export function stepsToFlowchartMermaid(steps: string[]): string {
  if (steps.length === 0) return "";
  const lines = ["```mermaid", "flowchart TD"];
  for (let i = 0; i < steps.length; i++) {
    const id = slugId(i);
    lines.push(`  ${id}["${escapeMermaidLabel(stepLabel(steps[i]!))}"]`);
    if (i > 0) lines.push(`  ${slugId(i - 1)} --> ${id}`);
  }
  lines.push("```");
  return lines.join("\n");
}

/** Flujo Odoo con rama Si existe / Si no existe */
export function odooCostFlowToMermaid(lines: string[]): string {
  const pre: string[] = [];
  const existsBranch: string[] = [];
  const notExistsBranch: string[] = [];
  let phase: "pre" | "exists" | "notexists" = "pre";

  for (const raw of lines) {
    const t = raw.replace(/^[-*]\s+/, "").trim();
    if (!t) continue;
    if (/^Si existe:/i.test(t)) {
      phase = "exists";
      continue;
    }
    if (/^Si no existe:/i.test(t)) {
      phase = "notexists";
      continue;
    }
    if (phase === "pre") pre.push(t);
    else if (phase === "exists") existsBranch.push(t);
    else notExistsBranch.push(t);
  }

  const out = ["```mermaid", "flowchart TD"];
  let last = "START";
  out.push(`  START(["Inicio"])`);
  pre.forEach((step, i) => {
    const id = `P${i}`;
    out.push(`  ${id}["${escapeMermaidLabel(stepLabel(step))}"]`);
    out.push(`  ${last} --> ${id}`);
    last = id;
  });
  out.push(`  DEC{"¿Registro existe?"}`);
  out.push(`  ${last} --> DEC`);
  existsBranch.forEach((step, i) => {
    const id = `E${i}`;
    out.push(`  ${id}["${escapeMermaidLabel(stepLabel(step))}"]`);
    out.push(i === 0 ? `  DEC -->|Sí| ${id}` : `  E${i - 1} --> ${id}`);
  });
  const lastE = existsBranch.length ? `E${existsBranch.length - 1}` : "DEC";
  notExistsBranch.forEach((step, i) => {
    const id = `N${i}`;
    out.push(`  ${id}["${escapeMermaidLabel(stepLabel(step))}"]`);
    out.push(i === 0 ? `  DEC -->|No| ${id}` : `  N${i - 1} --> ${id}`);
  });
  const endFrom = notExistsBranch.length
    ? `N${notExistsBranch.length - 1}`
    : existsBranch.length
      ? lastE
      : "DEC";
  out.push(`  END(["Responde resultado"])`);
  out.push(`  ${endFrom} --> END`);
  out.push("```");
  return out.join("\n");
}

export function repairFlowSectionsToMermaid(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();
    if (FLOW_HEADING.test(t)) {
      out.push(line);
      i++;
      const body: string[] = [];
      while (i < lines.length) {
        const lt = lines[i]!.trim();
        if (/^#{1,4}\s/.test(lt) && !FLOW_HEADING.test(lt)) break;
        if (/^```/.test(lt) && body.length > 0) break;
        body.push(lines[i]!);
        i++;
      }
      const steps = body
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("```") && !/^#{1,6}\s/.test(l));
      const isOdoo = /procesamiento/i.test(t) && steps.some((s) => /Si existe:/i.test(s));
      const bullets = steps
        .filter((s) => !/^Si (no )?existe:/i.test(s))
        .map((s) => (s.startsWith("- ") ? s : `- ${s.replace(/^[-*]\s+/, "")}`));
      const mermaid = isOdoo ? odooCostFlowToMermaid(steps) : stepsToFlowchartMermaid(steps);
      if (mermaid) {
        out.push("");
        out.push(mermaid);
        out.push("");
        out.push(...bullets);
        out.push("");
      } else {
        out.push(...body);
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}
