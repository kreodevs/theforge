import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { computeToolsListHash } from "@theforge/component-source-mcp";
import { runWithRequestUserAsync } from "../../common/request-user.store.js";
import { ComponentSourceProfileService } from "./component-source-profile.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { TokenCryptoService } from "../crypto/token-crypto.service.js";
import type { ComponentSourceMcpToolsService } from "./component-source-mcp-tools.service.js";
import type { ComponentSourceToolMappingService } from "./component-source-tool-mapping.service.js";
import type { ComponentSourceRegenerationService } from "./component-source-regeneration.service.js";
import type { ComponentSourceCredentialService } from "./component-source-credential.service.js";

const USER_ID = "user-cs-1";
const PROFILE_ID = "profile-1";
const PROJECT_ID = "project-1";

const MCP_TOOLS = [
  { name: "list_modules", description: "List modules", inputSchema: { type: "object" } },
  { name: "resolve_components", description: "Resolve", inputSchema: { type: "object" } },
];

const TOOLS_LIST_HASH = computeToolsListHash(MCP_TOOLS);

const CONFIRMED_MAPPING = {
  "catalog.list": { toolName: "list_modules" },
  "catalog.resolve": { toolName: "resolve_components" },
};

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    userId: USER_ID,
    name: "Orbita dev",
    pluginId: "mcp",
    url: "https://mcp.example.com",
    tokenCipher: "cipher",
    tokenKeyVersion: 1,
    toolMapping: CONFIRMED_MAPPING,
    capabilities: { catalog: { list: true, resolve: true } },
    toolsListHash: TOOLS_LIST_HASH,
    mappedAt: new Date("2026-01-01"),
    mappingConfirmedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function createMocks(options: {
  projectRefs?: number;
  profile?: Record<string, unknown> | null;
  mcpTools?: Partial<ComponentSourceMcpToolsService>;
} = {}) {
  let deleted = false;
  const profile = options.profile === null ? null : baseProfile(options.profile ?? {});

  const prisma = {
    componentSourceProfile: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === PROFILE_ID ? profile : null,
      delete: async () => {
        deleted = true;
      },
    },
    project: {
      count: async () => options.projectRefs ?? 0,
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== PROJECT_ID) return null;
        return {
          userId: USER_ID,
          componentSourceProfileId: PROFILE_ID,
          componentSourceProfile: profile,
        };
      },
      update: async () => ({
        componentSourceProfileId: PROFILE_ID,
        componentSourceProfile: profile,
      }),
    },
  } as unknown as PrismaService;

  const defaultMcpTools = {
    checkHealth: async () => ({ ok: true, service: "orbita-mcp" }),
    fetchToolsList: async () => ({ tools: MCP_TOOLS, toolsListHash: TOOLS_LIST_HASH }),
  };

  const mcpTools = {
    ...defaultMcpTools,
    ...options.mcpTools,
  } as unknown as ComponentSourceMcpToolsService;

  const toolMappingService = {
    proposeMapping: async () => ({
      "catalog.list": { toolName: "list_modules" },
      "catalog.resolve": { toolName: "resolve_components" },
    }),
    inferCapabilities: () => ({ catalog: { list: true, resolve: true } }),
    validateAndNormalize: (mapping: Record<string, unknown>) => mapping,
  } as unknown as ComponentSourceToolMappingService;

  const regeneration = {
    enqueueProjectProfileChange: () => undefined,
  } as unknown as ComponentSourceRegenerationService;

  const credentialService = {
    resolveForTest: async () => ({ url: "https://mcp.example.com", token: "tok" }),
    resolveFromProfile: async () => ({ url: "https://mcp.example.com", token: "tok" }),
  } as unknown as ComponentSourceCredentialService;

  const tokenCrypto = {
    encrypt: (plain: string) => ({ ciphertext: `enc:${plain}`, keyVersion: 1 }),
  } as unknown as TokenCryptoService;

  const service = new ComponentSourceProfileService(
    prisma,
    tokenCrypto,
    mcpTools,
    toolMappingService,
    regeneration,
    credentialService,
  );

  return { service, getDeleted: () => deleted };
}

test("ComponentSourceProfileService.deleteProfile — blocked when projects reference profile", async () => {
  const { service } = createMocks({ projectRefs: 2 });

  await assert.rejects(
    () =>
      runWithRequestUserAsync(USER_ID, () => service.deleteProfile(PROFILE_ID, USER_ID)),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      assert.match(err.message, /2 proyecto\(s\)/);
      return true;
    },
  );
});

test("ComponentSourceProfileService.deleteProfile — succeeds when unreferenced", async () => {
  const { service, getDeleted } = createMocks({ projectRefs: 0 });

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.deleteProfile(PROFILE_ID, USER_ID),
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(getDeleted(), true);
});

test("ComponentSourceProfileService.deleteProfile — not found for missing profile", async () => {
  const { service } = createMocks({ profile: null });

  await assert.rejects(
    () =>
      runWithRequestUserAsync(USER_ID, () => service.deleteProfile(PROFILE_ID, USER_ID)),
    NotFoundException,
  );
});

test("ComponentSourceProfileService.testProfileConnection — health-only when mapping confirmed and hash matches", async () => {
  const { service } = createMocks();

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.testProfileConnection(PROFILE_ID, { useSaved: true }, USER_ID),
  );

  assert.equal(result.mode, "health");
  assert.equal(result.ok, true);
  if (result.mode === "health" && result.ok) {
    assert.equal(result.service, "orbita-mcp");
  }
});

test("ComponentSourceProfileService.testProfileConnection — mapping mode when tools hash changed", async () => {
  const { service } = createMocks({
    profile: { toolsListHash: "stale-hash" },
  });

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.testProfileConnection(PROFILE_ID, { useSaved: true }, USER_ID),
  );

  assert.equal(result.mode, "mapping");
  assert.equal(result.ok, true);
  if (result.mode === "mapping") {
    assert.equal(result.toolsListHash, TOOLS_LIST_HASH);
    assert.ok(result.proposedMapping["catalog.list"]);
  }
});

test("ComponentSourceProfileService.testProfileConnection — mapping mode when URL override provided", async () => {
  const { service } = createMocks();

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.testProfileConnection(
      PROFILE_ID,
      { url: "https://other.example.com", useSaved: false },
      USER_ID,
    ),
  );

  assert.equal(result.mode, "mapping");
  assert.equal(result.ok, true);
});

test("ComponentSourceProfileService.testProfileConnection — health failure when MCP unhealthy", async () => {
  const { service } = createMocks({
    mcpTools: {
      checkHealth: async () => ({ ok: false, error: "Connection refused" }),
    },
  });

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.testProfileConnection(PROFILE_ID, { useSaved: true }, USER_ID),
  );

  assert.equal(result.mode, "health");
  assert.equal(result.ok, false);
  if (result.mode === "health" && !result.ok) {
    assert.match(result.error, /Connection refused/);
  }
});

test("ComponentSourceProfileService.testProfileConnection — mapping mode when mapping never confirmed", async () => {
  const { service } = createMocks({
    profile: { mappingConfirmedAt: null, toolsListHash: TOOLS_LIST_HASH },
  });

  const result = await runWithRequestUserAsync(USER_ID, () =>
    service.testProfileConnection(PROFILE_ID, { useSaved: true }, USER_ID),
  );

  assert.equal(result.mode, "mapping");
  assert.equal(result.ok, true);
});
