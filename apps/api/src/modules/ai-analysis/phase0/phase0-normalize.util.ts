/**
 * Normaliza borradores Phase0 desde JSON LLM o persistencia parcial.
 * Evita crashes cuando faltan proposito, permisos, pasos, etc.
 */

import type {
  Phase0Document,
  Phase0Entity,
  Phase0Flow,
  Phase0GlossaryEntry,
  Phase0Risk,
  Phase0Role,
  Phase0UATCriterion,
} from "./phase0.types.js";

export function emptyPhase0Document(): Phase0Document {
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeEntities(value: unknown): Phase0Entity[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      nombre: typeof item.nombre === "string" ? item.nombre.trim() : "",
      descripcion: typeof item.descripcion === "string" ? item.descripcion.trim() : "",
      atributosClave: toStringArray(item.atributosClave),
    }))
    .filter((item) => item.nombre.length > 0);
}

function normalizeFlujos(value: unknown): Phase0Flow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      nombre: typeof item.nombre === "string" ? item.nombre.trim() : "",
      pasos: toStringArray(item.pasos),
    }))
    .filter((item) => item.nombre.length > 0);
}

function normalizeRoles(value: unknown): Phase0Role[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      rol: typeof item.rol === "string" ? item.rol.trim() : "",
      permisos: toStringArray(item.permisos),
    }))
    .filter((item) => item.rol.length > 0);
}

function normalizeGlossary(value: unknown): Phase0GlossaryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      termino: typeof item.termino === "string" ? item.termino.trim() : "",
      definicion: typeof item.definicion === "string" ? item.definicion.trim() : "",
    }))
    .filter((item) => item.termino.length > 0);
}

const VALID_IMPACTO: Phase0Risk["impacto"][] = ["Alto", "Medio", "Bajo"];
const VALID_PROBABILIDAD: Phase0Risk["probabilidad"][] = ["Alta", "Media", "Baja"];

function normalizeRiesgos(value: unknown): Phase0Risk[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const impactoRaw = typeof item.impacto === "string" ? item.impacto.trim() : "Medio";
      const probRaw =
        typeof item.probabilidad === "string" ? item.probabilidad.trim() : "Media";
      return {
        id: typeof item.id === "string" ? item.id.trim() : "",
        nombre: typeof item.nombre === "string" ? item.nombre.trim() : "",
        impacto: (VALID_IMPACTO.includes(impactoRaw as Phase0Risk["impacto"])
          ? impactoRaw
          : "Medio") as Phase0Risk["impacto"],
        probabilidad: (VALID_PROBABILIDAD.includes(probRaw as Phase0Risk["probabilidad"])
          ? probRaw
          : "Media") as Phase0Risk["probabilidad"],
        mitigacion: typeof item.mitigacion === "string" ? item.mitigacion.trim() : "",
      };
    })
    .filter((item) => item.nombre.length > 0);
}

function normalizeUAT(value: unknown): Phase0UATCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id.trim() : "",
      descripcion: typeof item.descripcion === "string" ? item.descripcion.trim() : "",
    }))
    .filter((item) => item.descripcion.length > 0);
}

function normalizeRolesPorApp(
  value: unknown,
): Array<{ aplicacion: string; roles: Phase0Role[] }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      aplicacion: typeof item.aplicacion === "string" ? item.aplicacion.trim() : "",
      roles: normalizeRoles(item.roles),
    }))
    .filter((item) => item.aplicacion.length > 0);
  return out.length > 0 ? out : undefined;
}

/** Coerce cualquier payload parcial a Phase0Document seguro. */
export function normalizePhase0Document(raw: unknown): Phase0Document {
  if (!raw || typeof raw !== "object") return emptyPhase0Document();

  const record = raw as Record<string, unknown>;
  const proposito =
    record.proposito && typeof record.proposito === "object"
      ? (record.proposito as Record<string, unknown>)
      : {};

  const result: Phase0Document = {
    proposito: {
      problema: typeof proposito.problema === "string" ? proposito.problema : "",
      usuarios: toStringArray(proposito.usuarios),
      outOfScope: toStringArray(proposito.outOfScope),
    },
    entidades: normalizeEntities(record.entidades),
    reglasNegocio: toStringArray(record.reglasNegocio),
    flujos: normalizeFlujos(record.flujos),
    roles: normalizeRoles(record.roles),
    integraciones: toStringArray(record.integraciones),
    edgeCases: toStringArray(record.edgeCases),
    preguntasPendientes: toStringArray(record.preguntasPendientes),
  };

  const glosario = normalizeGlossary(record.glosario);
  if (glosario.length > 0) result.glosario = glosario;

  const riesgos = normalizeRiesgos(record.riesgos);
  if (riesgos.length > 0) result.riesgos = riesgos;

  const uat = normalizeUAT(record.criteriosUAT);
  if (uat.length > 0) result.criteriosUAT = uat;

  const stack = toStringArray(record.stackUsuario);
  if (stack.length > 0) result.stackUsuario = stack;

  if (record.aprobacionDual === true) result.aprobacionDual = true;

  const rolesPorApp = normalizeRolesPorApp(record.rolesPorApp);
  if (rolesPorApp) result.rolesPorApp = rolesPorApp;

  return result;
}

/**
 * Aplica un borrador LLM sobre el estado previo sin perder secciones
 * que el modelo omitió en la respuesta.
 */
export function mergePhase0Borrador(base: Phase0Document, patch: Phase0Document): Phase0Document {
  const normalizedPatch = normalizePhase0Document(patch);

  const merged: Phase0Document = {
    proposito: {
      problema: normalizedPatch.proposito.problema.trim() || base.proposito.problema,
      usuarios:
        normalizedPatch.proposito.usuarios.length > 0
          ? normalizedPatch.proposito.usuarios
          : base.proposito.usuarios,
      outOfScope:
        normalizedPatch.proposito.outOfScope.length > 0
          ? normalizedPatch.proposito.outOfScope
          : base.proposito.outOfScope,
    },
    entidades: normalizedPatch.entidades.length > 0 ? normalizedPatch.entidades : base.entidades,
    reglasNegocio:
      normalizedPatch.reglasNegocio.length > 0 ? normalizedPatch.reglasNegocio : base.reglasNegocio,
    flujos: normalizedPatch.flujos.length > 0 ? normalizedPatch.flujos : base.flujos,
    roles: normalizedPatch.roles.length > 0 ? normalizedPatch.roles : base.roles,
    integraciones:
      normalizedPatch.integraciones.length > 0 ? normalizedPatch.integraciones : base.integraciones,
    edgeCases: normalizedPatch.edgeCases.length > 0 ? normalizedPatch.edgeCases : base.edgeCases,
    preguntasPendientes:
      normalizedPatch.preguntasPendientes.length > 0
        ? normalizedPatch.preguntasPendientes
        : base.preguntasPendientes,
  };

  if (normalizedPatch.glosario && normalizedPatch.glosario.length > 0) {
    merged.glosario = normalizedPatch.glosario;
  } else if (base.glosario) {
    merged.glosario = base.glosario;
  }
  if (normalizedPatch.riesgos && normalizedPatch.riesgos.length > 0) {
    merged.riesgos = normalizedPatch.riesgos;
  } else if (base.riesgos) {
    merged.riesgos = base.riesgos;
  }
  if (normalizedPatch.criteriosUAT && normalizedPatch.criteriosUAT.length > 0) {
    merged.criteriosUAT = normalizedPatch.criteriosUAT;
  } else if (base.criteriosUAT) {
    merged.criteriosUAT = base.criteriosUAT;
  }
  if (normalizedPatch.stackUsuario && normalizedPatch.stackUsuario.length > 0) {
    merged.stackUsuario = normalizedPatch.stackUsuario;
  } else if (base.stackUsuario) {
    merged.stackUsuario = base.stackUsuario;
  }
  if (normalizedPatch.aprobacionDual === true) merged.aprobacionDual = true;
  else if (base.aprobacionDual === true) merged.aprobacionDual = true;
  if (normalizedPatch.rolesPorApp && normalizedPatch.rolesPorApp.length > 0) {
    merged.rolesPorApp = normalizedPatch.rolesPorApp;
  } else if (base.rolesPorApp) {
    merged.rolesPorApp = base.rolesPorApp;
  }

  return merged;
}
