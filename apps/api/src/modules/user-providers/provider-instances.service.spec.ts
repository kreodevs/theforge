import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ProviderInstancesService } from "./provider-instances.service.js";
import type { TokenCryptoService } from "../crypto/token-crypto.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

const ACTOR_ID = "super-admin-1";

function mockCrypto(): TokenCryptoService {
  return {
    encrypt: (plain: string) => ({ ciphertext: `enc:${plain}`, keyVersion: 1 }),
    decrypt: (cipher: string, _keyVersion: number) => cipher.replace(/^enc:/, ""),
    getActiveVersion: () => 1,
    listKeyVersions: () => [1],
  } as unknown as TokenCryptoService;
}

function mockPrisma() {
  const instances = new Map<string, Record<string, unknown>>();
  return {
    providerInstance: {
      findMany: async () => [...instances.values()],
      findUnique: async ({ where }: { where: { id: string } }) =>
        instances.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { enabledForUsers?: boolean } }) => {
        for (const row of instances.values()) {
          if (where.enabledForUsers === undefined || row.enabledForUsers === where.enabledForUsers) {
            return row;
          }
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `inst-${instances.size + 1}`;
        const row = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        instances.set(id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...instances.get(where.id)!, ...data };
        instances.set(where.id, row);
        return row;
      },
      updateMany: async () => ({ count: 0 }),
      delete: async ({ where }: { where: { id: string } }) => {
        instances.delete(where.id);
      },
    },
    userAISettings: {
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as PrismaService;
}

test("ProviderInstancesService.create — requiere apiKey", async () => {
  const svc = new ProviderInstancesService(mockPrisma(), mockCrypto());
  await assert.rejects(
    () =>
      svc.create(
        {
          providerType: "openai",
          slug: "prod",
          displayName: "OpenAI prod",
          apiKey: "",
        },
        ACTOR_ID,
      ),
    (err: unknown) => err instanceof BadRequestException,
  );
});

test("ProviderInstancesService.create — crea instancia", async () => {
  const svc = new ProviderInstancesService(mockPrisma(), mockCrypto());
  const row = await svc.create(
    {
      providerType: "openrouter",
      slug: "team",
      displayName: "OpenRouter equipo",
      apiKey: "sk-or-test-12345678",
      enabledForUsers: true,
    },
    ACTOR_ID,
  );
  assert.equal(row.providerType, "openrouter");
  assert.equal(row.slug, "team");
  assert.equal(row.enabledForUsers, true);
  assert.ok(row.apiKeyHint?.includes("…"));
});
