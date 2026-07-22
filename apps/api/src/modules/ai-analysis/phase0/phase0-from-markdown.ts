/**
 * Parsea el markdown generado por phase0ToMarkdown de vuelta a Phase0Document.
 * Fuente de verdad cuando el usuario editó dbgaContent en el Workshop.
 */

import type { Phase0Document, Phase0Entity, Phase0Flow, Phase0Role } from "./phase0.types.js";

function emptyDocument(): Phase0Document {
  return {
    proposito: { problema: "", usuarios: [], outOfScope: [] },
    entidades: [],
    reglasNegocio: [],
    flujos: [],
    roles: [],
    integraciones: [],
    edgeCases: [],
    preguntasPendientes: [],
  };
}

function bulletItems(lines: string[], start: number): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("## ") || line.startsWith("### ")) break;
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
      i += 1;
      continue;
    }
    if (line === "") {
      i += 1;
      continue;
    }
    break;
  }
  return { items, next: i };
}

export function isPhase0StructuredMarkdown(markdown: string): boolean {
  const t = markdown.trim();
  return (
    t.includes("# Fase 0") ||
    t.includes("## 1. Propósito y Alcance") ||
    t.includes("## 1. Proposito y Alcance")
  );
}

function isPlaceholder(line: string): boolean {
  const t = line.trim();
  return t === "*(No definidas)*" || t === "*(No definidos)*" || t === "*(No definida)*";
}

function sectionIndex(lines: string[], heading: string): number {
  return lines.findIndex((l) => l.trim() === heading);
}

export function markdownToPhase0Document(markdown: string): Phase0Document {
  const doc = emptyDocument();
  const raw = markdown.trim();
  if (!raw) return doc;

  const lines = raw.split("\n");

  const idxProposito = sectionIndex(lines, "## 1. Propósito y Alcance");
  const idxEntidades = sectionIndex(lines, "## 2. Entidades del Dominio");
  const idxReglas = sectionIndex(lines, "## 3. Reglas de Negocio");
  const idxFlujos = sectionIndex(lines, "## 4. Flujos Principales");
  const idxRoles = sectionIndex(lines, "## 5. Roles y Permisos");
  const idxIntegraciones = sectionIndex(lines, "## 6. Integraciones Externas");
  const idxEdge = sectionIndex(lines, "## 7. Edge Cases y Supuestos");
  const idxPendientes = sectionIndex(lines, "## 8. Preguntas Pendientes");

  if (idxProposito >= 0) {
    const end = [idxEntidades, idxReglas, idxFlujos, lines.length].find((i) => i > idxProposito) ?? lines.length;
    for (let i = idxProposito + 1; i < end; i += 1) {
      const line = lines[i].trim();
      if (line.startsWith("**Problema:**")) {
        doc.proposito.problema = line.replace(/^\*\*Problema:\*\*\s*/, "").trim();
      } else if (line === "**Usuarios objetivo:**") {
        const { items, next } = bulletItems(lines, i + 1);
        doc.proposito.usuarios = items;
        i = next - 1;
      } else if (line === "**Fuera de alcance:**") {
        const { items, next } = bulletItems(lines, i + 1);
        doc.proposito.outOfScope = items;
        i = next - 1;
      }
    }
  }

  if (idxEntidades >= 0) {
    const end = idxReglas >= 0 ? idxReglas : lines.length;
    let i = idxEntidades + 1;
    while (i < end) {
      const line = lines[i].trim();
      if (line.startsWith("### ")) {
        const entity: Phase0Entity = {
          nombre: line.slice(4).trim(),
          descripcion: "",
          atributosClave: [],
        };
        i += 1;
        while (i < end) {
          const inner = lines[i].trim();
          if (inner.startsWith("### ") || inner.startsWith("## ")) break;
          if (inner.startsWith("**Descripción:**")) {
            entity.descripcion = inner.replace(/^\*\*Descripción:\*\*\s*/, "").trim();
          } else if (inner.startsWith("**Atributos clave:**")) {
            const attrs = inner.replace(/^\*\*Atributos clave:\*\*\s*/, "").trim();
            if (attrs) {
              entity.atributosClave = attrs
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean);
            } else {
              i += 1;
              while (i < end) {
                const bullet = lines[i]!.trim();
                if (bullet.startsWith("- ")) {
                  entity.atributosClave.push(bullet.slice(2).trim());
                  i += 1;
                  continue;
                }
                if (bullet === "") {
                  i += 1;
                  continue;
                }
                break;
              }
              i -= 1;
            }
          } else if (inner.startsWith("- ") && entity.descripcion) {
            entity.atributosClave.push(inner.slice(2).trim());
          }
          i += 1;
        }
        if (entity.nombre) doc.entidades.push(entity);
        continue;
      }
      if (!isPlaceholder(line)) {
        i += 1;
        continue;
      }
      i += 1;
    }
  }

  if (idxReglas >= 0) {
    const { items } = bulletItems(lines, idxReglas + 1);
    if (items.length > 0 || !isPlaceholder(lines[idxReglas + 1]?.trim() ?? "")) {
      doc.reglasNegocio = items;
    }
  }

  if (idxFlujos >= 0) {
    const end = idxRoles >= 0 ? idxRoles : lines.length;
    let i = idxFlujos + 1;
    while (i < end) {
      const line = lines[i].trim();
      if (line.startsWith("### ")) {
        const flow: Phase0Flow = { nombre: line.slice(4).trim(), pasos: [] };
        i += 1;
        while (i < end) {
          const inner = lines[i]!.trim();
          const stepMatch = inner.match(/^(?:##\s+)?(\d+)\.\s+(.+)$/);
          if (stepMatch) {
            flow.pasos.push(stepMatch[2]!.trim());
            i += 1;
            continue;
          }
          if (inner.startsWith("### ") || inner.startsWith("## ")) break;
          if (inner.startsWith("- ")) {
            const note = inner.slice(2).trim();
            if (note && flow.pasos.length > 0) {
              flow.pasos[flow.pasos.length - 1] = `${flow.pasos[flow.pasos.length - 1]} (${note})`;
            }
          }
          i += 1;
        }
        if (flow.nombre) doc.flujos.push(flow);
        continue;
      }
      i += 1;
    }
  }

  if (idxRoles >= 0) {
    const end = idxIntegraciones >= 0 ? idxIntegraciones : lines.length;
    for (let i = idxRoles + 1; i < end; i += 1) {
      const line = lines[i].trim();
      if (line.startsWith("## ")) break;
      const roleMatch = line.match(/^-\s+\*\*(.+?):\*\*\s*(.+)$/);
      if (roleMatch) {
        const role: Phase0Role = {
          rol: roleMatch[1].trim(),
          permisos: roleMatch[2]
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        };
        doc.roles.push(role);
      }
    }
  }

  if (idxIntegraciones >= 0) {
    const { items } = bulletItems(lines, idxIntegraciones + 1);
    doc.integraciones = items;
  }

  if (idxEdge >= 0) {
    const { items } = bulletItems(lines, idxEdge + 1);
    doc.edgeCases = items;
  }

  if (idxPendientes >= 0) {
    const { items } = bulletItems(lines, idxPendientes + 1);
    doc.preguntasPendientes = items;
  }

  // §9. Glosario — tabla | Término | Definición |
  const idxGlosario = sectionIndex(lines, "## 9. Glosario de Dominio");
  if (idxGlosario >= 0) {
    const end = lines.length;
    const glossary: Array<{ termino: string; definicion: string }> = [];
    for (let i = idxGlosario + 1; i < end; i += 1) {
      const raw = lines[i].trim();
      if (raw.startsWith("## ")) break;
      if (raw.startsWith("|") && !raw.startsWith("| ---") && !/Término\s*\|/.test(raw)) {
        const cells = raw
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (cells.length >= 2 && cells[0] && cells[1]) {
          glossary.push({ termino: cells[0], definicion: cells[1] });
        }
      }
    }
    if (glossary.length > 0) doc.glosario = glossary;
  }

  // §10. Stack declarado por el usuario
  const idxStack = sectionIndex(lines, "## 10. Stack declarado por el usuario");
  if (idxStack >= 0) {
    // Puede haber un párrafo introductorio antes de los bullets; saltar líneas no-bullet
    let cursor = idxStack + 1;
    while (cursor < lines.length) {
      const t = lines[cursor].trim();
      if (t === "" || t.startsWith("## ")) {
        cursor += 1;
        continue;
      }
      if (t.startsWith("- ")) break;
      cursor += 1;
    }
    const { items } = bulletItems(lines, cursor);
    const stack = items.filter((s) => !/^Esta sección/i.test(s) && !/^Stack técnico/i.test(s));
    if (stack.length > 0) doc.stackUsuario = stack;
  }

  // §11. Riesgos y Mitigación — tabla | ID | Riesgo | Impacto | Probabilidad | Mitigación |
  const idxRiesgos = sectionIndex(lines, "## 11. Riesgos y Mitigación");
  if (idxRiesgos >= 0) {
    const end = lines.length;
    const riesgos: Array<{
      id: string;
      nombre: string;
      impacto: "Alto" | "Medio" | "Bajo";
      probabilidad: "Alta" | "Media" | "Baja";
      mitigacion: string;
    }> = [];
    for (let i = idxRiesgos + 1; i < end; i += 1) {
      const raw = lines[i].trim();
      if (raw.startsWith("## ")) break;
      if (
        raw.startsWith("|") &&
        !raw.startsWith("| ---") &&
        !/ID\s*\|\s*Riesgo/i.test(raw)
      ) {
        const cells = raw
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (cells.length >= 5 && cells[0] && cells[1]) {
          const impacto = (["Alto", "Medio", "Bajo"].includes(cells[2] ?? "")
            ? cells[2]
            : "Medio") as "Alto" | "Medio" | "Bajo";
          const prob = (["Alta", "Media", "Baja"].includes(cells[3] ?? "")
            ? cells[3]
            : "Media") as "Alta" | "Media" | "Baja";
          riesgos.push({
            id: cells[0],
            nombre: cells[1],
            impacto,
            probabilidad: prob,
            mitigacion: cells[4] ?? "",
          });
        }
      }
    }
    if (riesgos.length > 0) doc.riesgos = riesgos;
  }

  // §12. Criterios de Aceptación (UAT) — bullets - **<id>:** <desc>
  const idxUAT = sectionIndex(lines, "## 12. Criterios de Aceptación (UAT)");
  if (idxUAT >= 0) {
    const end = lines.length;
    const uat: Array<{ id: string; descripcion: string }> = [];
    for (let i = idxUAT + 1; i < end; i += 1) {
      const raw = lines[i].trim();
      if (raw.startsWith("## ")) break;
      const m = raw.match(/^-\s+\*\*(.+?):\*\*\s*(.+)$/);
      if (m) uat.push({ id: m[1].trim(), descripcion: m[2].trim() });
    }
    if (uat.length > 0) doc.criteriosUAT = uat;
  }

  return doc;
}
