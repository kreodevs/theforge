/**
 * Interfaz de referencia para evaluar completitud del MDD (Semáforo).
 * El EstimationService compara el documento contra estas secciones.
 */
export interface MDDReference {
  /** Modelo de datos / entidades */
  db?: boolean;
  /** Contratos de API / endpoints */
  endpoints?: boolean;
  /** Seguridad */
  security?: boolean;
  /** Integración / Infraestructura */
  infra?: boolean;
}

/** Contexto parcial del MDD (markdown o secciones detectadas) para cálculo en vivo. */
export type MDDContext = string | { mddContent?: string; infraContent?: string };

/** Contrato mínimo para que el Manager muestre la misma precisión que el semáforo. */
export interface LivePrecisionCalculator {
  calculateLiveMetrics(ctx: MDDContext): LiveMetricsResult;
}

export type SemaphoreStatusLive = "red" | "yellow" | "green";

/** Calificación por sección/agente (0–100) para mostrar en la tabla del chat tras auditar. */
export interface PrecisionBreakdown {
  contexto: number;
  modeloDatos: number;
  apiContracts: number;
  frontend: number;
  seguridad: number;
  integracion: number;
}

/** Salida exacta para la UI: Semáforo + Estimación (nómina interna y precio mercado). */
export interface LiveMetricsResult {
  precision: number;
  /** Costo a nómina interna ($185/hr × horas × riskFactor). */
  totalMXN: number;
  /** Costo a precio de mercado ($/hr mercado × horas × riskFactor). */
  totalMXNMarket: number;
  totalHours: number;
  /** Personas por rol (conteo). */
  roles: { architect: number; back: number; front: number };
  /** Horas por rol (15% arquitectura, 45% back, 40% front). */
  rolesHours: { architect: number; back: number; front: number };
  status: SemaphoreStatusLive;
}

/** Tasa interna (Costo Empresa 2026): $21k netos × 1.4 carga social ÷ 160 h/mes ≈ $29,400/mes → $185 MXN/hr. */
export const BASE_SALARY_NET_MONTH = 21_000;
export const SOCIAL_LOAD_FACTOR = 1.4;
export const HOURS_PER_MONTH = 160;
export const INTERNAL_HOUR_RATE = 185;

/** Tarifa hora a precio de mercado (consultoría / venta), MXN/hr. */
export const MARKET_HOUR_RATE = 1_050;

/** Reparto de horas: Arquitectura 15%, Backend 45%, Frontend/Integración 40%. */
export const RATIO_ARCHITECT = 0.15;
export const RATIO_BACK = 0.45;
export const RATIO_FRONT = 0.4;

/**
 * Umbrales de precisión del semáforo:
 * - Rojo: < 50% — Solo ideas generales. El costo es una "suposición".
 * - Amarillo: 50%–94% — Arquitectura definida pero faltan contratos de API o Docker.
 * - Verde: 95%+ — Solo si además hay DB/entidades, Endpoints con payloads y Seguridad con decisiones documentadas (agnóstico de dominio).
 */
export const PRECISION_RED_MAX = 50;
export const PRECISION_GREEN_MIN = 95;

/** Factor de riesgo dinámico: < 70% → 1.25; ≥ 95% → 1.0. */
export const RISK_FACTOR_LOW_PRECISION = 1.25;
export const RISK_PRECISION_THRESHOLD = 70;
