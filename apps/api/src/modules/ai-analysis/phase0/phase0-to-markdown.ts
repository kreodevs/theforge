/**
 * Serializa un Phase0Document a markdown legible para inyectar como dbgaContent
 * en el pipeline MDD existente.
 */

import { normalizePhase0Document } from "./phase0-normalize.util.js";
import type { Phase0Document } from "./phase0.types.js";

export function phase0ToMarkdown(doc: Phase0Document): string {
  const normalized = normalizePhase0Document(doc);
  const lines: string[] = [];
  lines.push("# Fase 0 — Especificación Inicial");
  lines.push("");

  // 1. Propósito
  lines.push("## 1. Propósito y Alcance");
  lines.push("");
  lines.push(`**Problema:** ${normalized.proposito.problema || "No definido"}`);
  lines.push("");
  if (normalized.proposito.usuarios.length > 0) {
    lines.push("**Usuarios objetivo:**");
    normalized.proposito.usuarios.forEach((u) => lines.push(`- ${u}`));
    lines.push("");
  }
  if (normalized.proposito.outOfScope.length > 0) {
    lines.push("**Fuera de alcance:**");
    normalized.proposito.outOfScope.forEach((o) => lines.push(`- ${o}`));
    lines.push("");
  }

  // 2. Entidades
  lines.push("## 2. Entidades del Dominio");
  lines.push("");
  if (normalized.entidades.length === 0) {
    lines.push("*(No definidas)*");
  } else {
    normalized.entidades.forEach((e) => {
      lines.push(`### ${e.nombre}`);
      lines.push(`**Descripción:** ${e.descripcion}`);
      if (e.atributosClave.length > 0) {
        lines.push(`**Atributos clave:** ${e.atributosClave.join(", ")}`);
      }
      lines.push("");
    });
  }

  // 3. Reglas de Negocio
  lines.push("## 3. Reglas de Negocio");
  lines.push("");
  if (normalized.reglasNegocio.length === 0) {
    lines.push("*(No definidas)*");
  } else {
    normalized.reglasNegocio.forEach((r) => lines.push(`- ${r}`));
  }
  lines.push("");

  // 4. Flujos
  lines.push("## 4. Flujos Principales");
  lines.push("");
  if (normalized.flujos.length === 0) {
    lines.push("*(No definidos)*");
  } else {
    normalized.flujos.forEach((f) => {
      lines.push(`### ${f.nombre}`);
      f.pasos.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
      lines.push("");
    });
  }

  // 5. Roles
  lines.push("## 5. Roles y Permisos");
  lines.push("");
  if (normalized.roles.length === 0) {
    lines.push("*(No definidos)*");
  } else {
    normalized.roles.forEach((r) => {
      const permisos = r.permisos.length > 0 ? r.permisos.join(", ") : "Sin permisos definidos";
      lines.push(`- **${r.rol}:** ${permisos}`);
    });
  }
  lines.push("");

  // 6. Integraciones
  lines.push("## 6. Integraciones Externas");
  lines.push("");
  if (normalized.integraciones.length === 0) {
    lines.push("*(No definidas)*");
  } else {
    normalized.integraciones.forEach((i) => lines.push(`- ${i}`));
  }
  lines.push("");

  // 7. Edge Cases
  lines.push("## 7. Edge Cases y Supuestos");
  lines.push("");
  if (normalized.edgeCases.length === 0) {
    lines.push("*(No definidos)*");
  } else {
    normalized.edgeCases.forEach((ec) => lines.push(`- ${ec}`));
  }
  lines.push("");

  // 8. Pendientes
  if (normalized.preguntasPendientes.length > 0) {
    lines.push("## 8. Preguntas Pendientes");
    lines.push("");
    normalized.preguntasPendientes.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }

  return lines.join("\n");
}
