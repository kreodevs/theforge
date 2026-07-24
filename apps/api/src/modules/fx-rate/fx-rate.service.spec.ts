/**
 * Tests del servicio de tipo de cambio. Usa mocks de PrismaService.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FxRateService } from "./fx-rate.service.js";

class FakePrisma {
  rows = new Map<string, string>();
  appConfig = {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const value = this.rows.get(where.key);
      return value ? { key: where.key, value } : null;
    },
  };
}

function makeService(initial?: { key: string; value: string }[]) {
  const prisma = new FakePrisma();
  initial?.forEach((r) => prisma.rows.set(r.key, r.value));
  const service = new FxRateService(prisma as unknown as ConstructorParameters<typeof FxRateService>[0]);
  return { service, prisma };
}

describe("FxRateService", () => {
  it("devuelve 20 (default) cuando AppConfig no tiene mxn_per_usd", async () => {
    const { service } = makeService();
    const rate = await service.getMxnPerUsd();
    assert.equal(rate, 20);
  });

  it("lee el valor de AppConfig", async () => {
    const { service } = makeService([{ key: "mxn_per_usd", value: "17.5" }]);
    const rate = await service.getMxnPerUsd();
    assert.equal(rate, 17.5);
  });

  it("cachea el valor entre llamadas (no relee BD)", async () => {
    const { service, prisma } = makeService([{ key: "mxn_per_usd", value: "20" }]);
    const first = await service.getMxnPerUsd();
    assert.equal(first, 20);

    // Cambiamos BD: la caché debe seguir mostrando 20
    prisma.rows.set("mxn_per_usd", "22");
    const second = await service.getMxnPerUsd();
    assert.equal(second, 20);
  });

  it("invalidate() fuerza la siguiente lectura", async () => {
    const { service, prisma } = makeService([{ key: "mxn_per_usd", value: "20" }]);
    await service.getMxnPerUsd();
    prisma.rows.set("mxn_per_usd", "22");
    service.invalidate();
    const rate = await service.getMxnPerUsd();
    assert.equal(rate, 22);
  });

  it("ignora valores inválidos y usa default", async () => {
    const { service } = makeService([{ key: "mxn_per_usd", value: "not-a-number" }]);
    const rate = await service.getMxnPerUsd();
    assert.equal(rate, 20);
  });

  it("ignora valores ≤ 0 y usa default", async () => {
    const { service, prisma } = makeService([{ key: "mxn_per_usd", value: "0" }]);
    const rate = await service.getMxnPerUsd();
    assert.equal(rate, 20);
    service.invalidate();
    prisma.rows.set("mxn_per_usd", "-5");
    const rate2 = await service.getMxnPerUsd();
    assert.equal(rate2, 20);
  });

  it("usdToMxn convierte usando el TC vigente", async () => {
    const { service } = makeService([{ key: "mxn_per_usd", value: "18" }]);
    const mxn = await service.usdToMxn(10);
    assert.equal(mxn, 180);
  });

  it("usdToMxn acepta 0", async () => {
    const { service } = makeService();
    assert.equal(await service.usdToMxn(0), 0);
  });
});
