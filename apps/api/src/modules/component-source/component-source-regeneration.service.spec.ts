import test from "node:test";
import assert from "node:assert/strict";
import {
  ComponentSourceRegenerationService,
  type RegenerationEvent,
  type RegenerationJobData,
} from "./component-source-regeneration.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { ComponentSourceRegistry } from "./component-source.registry.js";
import type { AiAnalysisService } from "../ai-analysis/ai-analysis.service.js";
import type { ComponentSourceRegenerationQueueService } from "./component-source-regeneration-queue.service.js";

const USER_ID = "user-regen-1";
const PROJECT_ID = "project-regen-1";
const PROFILE_ID = "profile-regen-1";
const PREVIOUS_PROFILE_ID = "profile-old";

function mockQueue(overrides: Partial<ComponentSourceRegenerationQueueService> = {}) {
  let enqueued: RegenerationJobData | null = null;
  const queue = {
    isEnabled: () => false,
    enqueue: async (data: RegenerationJobData) => {
      enqueued = data;
      return "job-id";
    },
    hasActiveJobForUser: async () => false,
    ...overrides,
  } as unknown as ComponentSourceRegenerationQueueService;

  return {
    queue,
    getEnqueued: () => enqueued,
  };
}

function createService(options: {
  profile?: Record<string, unknown> | null;
  wireframeEvents?: Array<{ type: string; message?: string }>;
  queue?: Partial<ComponentSourceRegenerationQueueService>;
  streamWireframesOptions?: { dsOnly?: boolean };
} = {}) {
  const profile =
    options.profile === null
      ? null
      : {
          id: PROFILE_ID,
          userId: USER_ID,
          toolMapping: {
            "catalog.list": { toolName: "list_modules" },
          },
          capabilities: { catalog: { list: true } },
          mappingConfirmedAt: new Date(),
          ...options.profile,
        };

  const prisma = {
    componentSourceProfile: {
      findUnique: async () => profile,
    },
    project: {
      update: async () => ({ id: PROJECT_ID }),
    },
  } as unknown as PrismaService;

  const registry = {
    resolveForProject: async () => ({ active: false, port: null, ownerUserId: USER_ID }),
  } as unknown as ComponentSourceRegistry;

  const wireframeEvents = options.wireframeEvents ?? [{ type: "done" }];
  let capturedStreamOptions: { dsOnly?: boolean } | undefined;

  const aiAnalysis = {
    streamWireframes: async function* (_projectId: string, opts?: { dsOnly?: boolean }) {
      capturedStreamOptions = opts;
      for (const event of wireframeEvents) {
        yield event;
      }
    },
  } as unknown as AiAnalysisService;

  const { queue, getEnqueued } = mockQueue(options.queue);

  const service = new ComponentSourceRegenerationService(
    prisma,
    registry,
    aiAnalysis,
    queue,
  );

  return { service, getEnqueued, getCapturedStreamOptions: () => capturedStreamOptions };
}

test("ComponentSourceRegenerationService.enqueueProjectProfileChange — no-op when profileId is null", async () => {
  const { service, getEnqueued } = createService();
  service.enqueueProjectProfileChange(PROJECT_ID, null, USER_ID, PREVIOUS_PROFILE_ID);
  assert.equal(getEnqueued(), null);
  assert.equal(await service.hasActiveJob(USER_ID), false);
});

test("ComponentSourceRegenerationService.enqueueProjectProfileChange — no-op when profile unchanged", async () => {
  const { service, getEnqueued } = createService();
  service.enqueueProjectProfileChange(PROJECT_ID, PROFILE_ID, USER_ID, PROFILE_ID);
  assert.equal(getEnqueued(), null);
  assert.equal(await service.hasActiveJob(USER_ID), false);
});

test("ComponentSourceRegenerationService.enqueueProjectProfileChange — enqueues via BullMQ when queue enabled", async () => {
  const { service, getEnqueued } = createService({
    queue: { isEnabled: () => true },
  });

  service.enqueueProjectProfileChange(PROJECT_ID, PROFILE_ID, USER_ID, PREVIOUS_PROFILE_ID);

  assert.deepEqual(getEnqueued(), {
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    userId: USER_ID,
  });
});

test("ComponentSourceRegenerationService.enqueueProjectProfileChange — in-process job emits terminal done", async () => {
  const { service } = createService();
  const events: RegenerationEvent[] = [];
  const unsubscribe = service.subscribe(USER_ID, (event) => events.push(event));

  service.enqueueProjectProfileChange(PROJECT_ID, PROFILE_ID, USER_ID, PREVIOUS_PROFILE_ID);

  await new Promise<void>((resolve) => {
    const deadline = Date.now() + 2000;
    const poll = () => {
      if (events.some((e) => e.type === "done" || e.type === "error")) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        resolve();
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });

  unsubscribe();
  assert.equal(await service.hasActiveJob(USER_ID), false);
  assert.ok(events.some((e) => e.type === "progress"));
  assert.ok(events.some((e) => e.type === "done" && e.projectId === PROJECT_ID));
});

test("ComponentSourceRegenerationService.executeJob — emits error when profile missing", async () => {
  const { service } = createService({ profile: null });
  const events: RegenerationEvent[] = [];
  const unsubscribe = service.subscribe(USER_ID, (event) => events.push(event));

  await service.executeJob({
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    userId: USER_ID,
  });

  unsubscribe();
  assert.ok(
    events.some(
      (e) => e.type === "error" && e.message.includes("Perfil no encontrado"),
    ),
  );
});

test("ComponentSourceRegenerationService.executeJob — wireframe refresh uses dsOnly", async () => {
  const { service, getCapturedStreamOptions } = createService();
  await service.executeJob({
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    userId: USER_ID,
  });
  assert.deepEqual(getCapturedStreamOptions(), { dsOnly: true });
});

test("ComponentSourceRegenerationService.executeJob — wireframe step reports error event", async () => {
  const { service } = createService({
    wireframeEvents: [{ type: "error", message: "Wireframe stream failed" }],
  });
  const events: RegenerationEvent[] = [];

  await service.executeJob(
    { projectId: PROJECT_ID, profileId: PROFILE_ID, userId: USER_ID },
    (event) => events.push(event),
  );

  assert.ok(
    events.some(
      (e) =>
        e.type === "progress" &&
        e.label === "Regenerando wireframes" &&
        e.status === "error",
    ),
  );
});
