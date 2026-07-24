/**
 * @fileoverview Servicio de tipo de cambio MXN/USD. Lee el valor de
 * `AppConfig` (clave `mxn_per_usd`) con cache in-memory de corta duración.
 *
 * El valor es **estimado** — no es un feed live. El usuario lo mantiene en
 * Ajustes → Sistema (definición `mxn_per_usd` en SYSTEM_CONFIG_DEFINITIONS).
 * Si no hay valor en BD, usa el default 20.
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

const FX_CONFIG_KEY = "mxn_per_usd";
const DEFAULT_MXN_PER_USD = 20;
const CACHE_TTL_MS = 60_000;

interface CachedRate {
  value: number;
  expiresAt: number;
}

@Injectable()
export class FxRateService implements OnModuleInit {
  private readonly logger = new Logger(FxRateService.name);
  private cache: CachedRate | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.invalidate();
  }

  /**
   * Devuelve el tipo de cambio MXN/USD actual. Lee de BD la primera vez
   * y cachea por `CACHE_TTL_MS`. Si la BD no devuelve valor, usa el default 20.
   */
  async getMxnPerUsd(): Promise<number> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    let value = DEFAULT_MXN_PER_USD;
    try {
      const row = await this.prisma.appConfig.findUnique({
        where: { key: FX_CONFIG_KEY },
      });
      if (row?.value?.trim()) {
        const parsed = Number.parseFloat(row.value);
        if (Number.isFinite(parsed) && parsed > 0) {
          value = parsed;
        } else {
          this.logger.warn(
            `AppConfig.${FX_CONFIG_KEY}="${row.value}" no es numérico positivo; usando default ${DEFAULT_MXN_PER_USD}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo leer AppConfig.${FX_CONFIG_KEY} (${(err as Error).message}); usando default ${DEFAULT_MXN_PER_USD}`,
      );
    }

    this.cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /**
   * Convierte USD a MXN con el tipo de cambio actual. Helper para adapters
   * y servicios que ya tienen un valor USD calculado.
   */
  async usdToMxn(usd: number): Promise<number> {
    const rate = await this.getMxnPerUsd();
    return round6(usd * rate);
  }

  /**
   * Invalida la caché. Llamar tras `patchSettings` con la key `mxn_per_usd`
   * para que la próxima lectura recargue.
   */
  invalidate(): void {
    this.cache = null;
  }
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
