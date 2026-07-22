/**
 * Phase0GapAnalyzer — detecta qué información falta en el borrador
 * y la prioriza por criticidad. Sin dependencias de LLM, es pura lógica.
 */

import type { Phase0Document, Phase0Gap } from "./phase0.types.js";
import { GAP_WEIGHT } from "./phase0.types.js";

/**
 * Analiza el borrador y produce gaps priorizados.
 * Regla: solo gaps que realmente bloquean o degradan el MDD.
 */
export function analyzeGaps(borrador: Phase0Document): Phase0Gap[] {
  const gaps: Phase0Gap[] = [];

  // 1. PROPÓSITO — crítico si falta
  if (!borrador.proposito.problema || borrador.proposito.problema.length < 10) {
    gaps.push({
      seccion: "proposito",
      criticidad: "critico",
      descripcion: "No se ha definido el problema principal que resuelve el sistema",
      razon: "Sin propósito claro, el MDD no tiene dirección ni límites",
      sugerenciaPregunta: "¿Cuál es el problema principal que resuelve este sistema?",
    });
  }

  if (!borrador.proposito.usuarios || borrador.proposito.usuarios.length === 0) {
    gaps.push({
      seccion: "proposito",
      criticidad: "critico",
      descripcion: "No se han identificado los usuarios objetivo",
      razon: "Sin usuarios, el MDD no puede definir roles, permisos ni flujos",
      sugerenciaPregunta: "¿Quiénes van a usar este sistema?",
    });
  }

  // 2. ENTIDADES — crítico si vacío o sospechosamente genérico
  if (!borrador.entidades || borrador.entidades.length === 0) {
    gaps.push({
      seccion: "entidades",
      criticidad: "critico",
      descripcion: "No se han identificado entidades del dominio",
      razon: "El MDD §3 (Modelo de Datos) no puede generarse sin entidades",
      sugerenciaPregunta: "¿Qué cosas o conceptos principales maneja el sistema? (ej: proyectos, usuarios, facturas...)",
    });
  } else if (borrador.entidades.length < 2) {
    gaps.push({
      seccion: "entidades",
      criticidad: "critico",
      descripcion: `Solo se identificó 1 entidad (${borrador.entidades[0].nombre})`,
      razon: "Un sistema con una entidad es improbable. Faltan más entidades del dominio",
      sugerenciaPregunta: `Además de "${borrador.entidades[0].nombre}", ¿qué otras entidades o conceptos existen?`,
    });
  }

  // 3. REGLAS DE NEGOCIO — crítico si vacío
  if (!borrador.reglasNegocio || borrador.reglasNegocio.length === 0) {
    gaps.push({
      seccion: "reglasNegocio",
      criticidad: "critico",
      descripcion: "No se han definido reglas de negocio",
      razon: "Sin reglas, la IA inventa validaciones genéricas que pueden ser incorrectas",
      sugerenciaPregunta: "¿Hay reglas importantes del negocio? (ej: 'un usuario solo puede tener un proyecto activo')",
    });
  }

  // 4. ROLES — crítico si vacío
  if (!borrador.roles || borrador.roles.length === 0) {
    gaps.push({
      seccion: "roles",
      criticidad: "critico",
      descripcion: "No se han definido roles ni permisos",
      razon: "El MDD §6 (Seguridad) no puede generarse correctamente sin roles",
      sugerenciaPregunta: "¿Qué tipos de usuarios hay y qué puede hacer cada uno?",
    });
  }

  // 5. FLUJOS — importante si vacío
  if (!borrador.flujos || borrador.flujos.length === 0) {
    gaps.push({
      seccion: "flujos",
      criticidad: "importante",
      descripcion: "No se han definido flujos principales",
      razon: "Los flujos guían los casos de uso y las HU; sin ellos la implementación solo cubre happy path",
      sugerenciaPregunta: "¿Cuál es el flujo principal de principio a fin?",
    });
  }

  // 6. EDGE CASES — importante si vacío
  if (!borrador.edgeCases || borrador.edgeCases.length === 0) {
    gaps.push({
      seccion: "edgeCases",
      criticidad: "importante",
      descripcion: "No se han identificado edge cases o supuestos",
      razon: "Sin edge cases, la IA implementa solo el camino feliz",
      sugerenciaPregunta: "¿Qué debería pasar si algo sale mal? (ej: el pago falla, el servidor no responde...)",
    });
  }

  // 7. OUT OF SCOPE — importante si vacío
  if (!borrador.proposito.outOfScope || borrador.proposito.outOfScope.length === 0) {
    gaps.push({
      seccion: "proposito",
      criticidad: "importante",
      descripcion: "No se ha definido qué NO hace el sistema",
      razon: "Sin límites claros, la IA puede generar features que no pidieron",
      sugerenciaPregunta: "¿Hay algo que este sistema NO deba hacer? (límites explícitos)",
    });
  }

  // 8. ENTIDADES DE NEGOCIO NO-AUTH — crítico si solo hay entidades auth/genéricas
  // Evita domain-auth-only-skew en §3 del MDD.
  const entidades = borrador.entidades ?? [];
  const entidadesNegocio = entidades.filter((e) => {
    const nombre = (e?.nombre ?? "").toLowerCase().trim();
    return !/^(user|usuario|users|usuarios|role|rol|roles|session|sesion|sesiones|audit|auditoria|auditlog|permission|permiso)$/i.test(
      nombre,
    );
  });
  if (entidades.length > 0 && entidadesNegocio.length < 2) {
    gaps.push({
      seccion: "entidades",
      criticidad: "critico",
      descripcion: `Solo se identificaron entidades auth/genéricas (${entidades
        .map((e) => e.nombre)
        .join(", ")})`,
      razon:
        "El MDD §3 (Modelo de Datos) saldrá vacío o solo-auth. La IA downstream lo penaliza como domain-auth-only-skew.",
      sugerenciaPregunta:
        "¿Qué objetos o conceptos de negocio maneja el sistema, además de usuarios y roles? (ej: proyectos, pedidos, candidatos, facturas)",
    });
  }

  // 9. RIESGOS — importante si vacío
  if (!borrador.riesgos || borrador.riesgos.length === 0) {
    gaps.push({
      seccion: "proposito",
      criticidad: "importante",
      descripcion: "No se han identificado riesgos del proyecto",
      razon: "La §1 (Riesgos) del MDD queda vacía y la IA los inventa",
      sugerenciaPregunta:
        "¿Cuáles son los 3 principales riesgos del proyecto y su mitigación? (ej: 'cambio regulatorio — mitigación: asesoría legal trimestral')",
    });
  }

  // 10. UAT — importante si vacío
  if (!borrador.criteriosUAT || borrador.criteriosUAT.length === 0) {
    gaps.push({
      seccion: "proposito",
      criticidad: "importante",
      descripcion: "No se han definido criterios de aceptación de negocio (UAT)",
      razon: "La §1 (Criterios de aceptación) del MDD queda vacía y la IA los inventa",
      sugerenciaPregunta:
        "¿Cuáles son los 4 escenarios de aceptación más importantes? (Dado/Cuando/Entonces en lenguaje de negocio)",
    });
  }

  return gaps.sort((a, b) => GAP_WEIGHT[a.criticidad] - GAP_WEIGHT[b.criticidad]);
}

/** Gaps que justifican una pregunta al usuario */
export function isAskableGap(gap: Phase0Gap): boolean {
  return gap.criticidad === "critico" || gap.criticidad === "importante";
}

/**
 * Plan de entrevista: hasta `max` gaps críticos/importantes, ordenados por prioridad.
 * Evita terminar tras 1 respuesta cuando el LLM rellena el borrador de golpe.
 */
export function buildQuestionPlan(gaps: Phase0Gap[], max: number): Phase0Gap[] {
  const ordered = [...gaps]
    .filter(isAskableGap)
    .sort((a, b) => GAP_WEIGHT[a.criticidad] - GAP_WEIGHT[b.criticidad]);
  const plan: Phase0Gap[] = [];
  const seen = new Set<string>();
  for (const gap of ordered) {
    const key = `${gap.seccion}:${gap.descripcion.slice(0, 64)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plan.push(gap);
    if (plan.length >= max) break;
  }
  return plan;
}

/** True si el gap sigue presente según el analizador lógico */
export function isGapStillOpen(gap: Phase0Gap, borrador: Phase0Document): boolean {
  return analyzeGaps(borrador).some(
    (g) => g.seccion === gap.seccion && g.descripcion === gap.descripcion,
  );
}

/**
 * Filtra gaps que ya no aplican basado en el contenido actual del borrador
 * y gaps que se resolvieron (su pregunta ya fue respondida).
 */
export function filterResolvedGaps(
  gaps: Phase0Gap[],
  borrador: Phase0Document,
  ultimaPregunta?: string,
): Phase0Gap[] {
  return gaps.filter((gap) => {
    // Si el gap tiene una sugerenciaPregunta que coincide con la última pregunta hecha,
    // el usuario ya la respondió → gap resuelto
    if (ultimaPregunta && gap.sugerenciaPregunta) {
      const preguntaClean = ultimaPregunta.toLowerCase().trim();
      const gapPreguntaClean = gap.sugerenciaPregunta.toLowerCase().trim();
      // Si la pregunta del gap está contenida en la última pregunta (o viceversa),
      // probablemente es el mismo gap
      if (preguntaClean.includes(gapPreguntaClean) || gapPreguntaClean.includes(preguntaClean)) {
        return false;
      }
    }
    switch (gap.seccion) {
      case "entidades":
        if (gap.descripcion.includes("entidades auth/genéricas")) {
          const entidadesNegocio = (borrador.entidades ?? []).filter((e) => {
            const nombre = (e?.nombre ?? "").toLowerCase().trim();
            return !/^(user|usuario|users|usuarios|role|rol|roles|session|sesion|sesiones|audit|auditoria|auditlog|permission|permiso)$/i.test(
              nombre,
            );
          });
          return !borrador.entidades || borrador.entidades.length < 2 || entidadesNegocio.length < 2;
        }
        return !borrador.entidades || borrador.entidades.length < 2;
      case "reglasNegocio":
        return !borrador.reglasNegocio || borrador.reglasNegocio.length === 0;
      case "flujos":
        return !borrador.flujos || borrador.flujos.length === 0;
      case "roles":
        return !borrador.roles || borrador.roles.length === 0;
      case "integraciones":
        return !borrador.integraciones || borrador.integraciones.length === 0;
      case "edgeCases":
        return !borrador.edgeCases || borrador.edgeCases.length === 0;
      case "proposito":
        if (gap.descripcion.includes("problema principal")) {
          return !borrador.proposito.problema || borrador.proposito.problema.length < 10;
        }
        if (gap.descripcion.includes("usuarios objetivo")) {
          return !borrador.proposito.usuarios || borrador.proposito.usuarios.length === 0;
        }
        if (gap.descripcion.includes("NO hace")) {
          return !borrador.proposito.outOfScope || borrador.proposito.outOfScope.length === 0;
        }
        if (gap.descripcion.includes("riesgos del proyecto")) {
          return !borrador.riesgos || borrador.riesgos.length === 0;
        }
        if (gap.descripcion.includes("criterios de aceptación")) {
          return !borrador.criteriosUAT || borrador.criteriosUAT.length === 0;
        }
        return true;
      default:
        return false;
    }
  });
}