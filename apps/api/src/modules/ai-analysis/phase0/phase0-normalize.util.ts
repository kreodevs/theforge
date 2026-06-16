/**
 * Normaliza borradores Phase0 desde JSON LLM o persistencia parcial.
 * Evita crashes cuando faltan proposito, permisos, pasos, etc.
 */

import type { Phase0Document, Phase0Entity, Phase0Flow, Phase0Role } from "./phase0.types.js";

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

/** Coerce cualquier payload parcial a Phase0Document seguro. */
export function normalizePhase0Document(raw: unknown): Phase0Document {
  if (!raw || typeof raw !== "object") return emptyPhase0Document();

  const record = raw as Record<string, unknown>;
  const proposito =
    record.proposito && typeof record.proposito === "object"
      ? (record.proposito as Record<string, unknown>)
      : {};

  return {
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
}

/**
 * Aplica un borrador LLM sobre el estado previo sin perder secciones
 * que el modelo omitió en la respuesta.
 */
export function mergePhase0Borrador(base: Phase0Document, patch: Phase0Document): Phase0Document {
  const normalizedPatch = normalizePhase0Document(patch);

  return {
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
}
