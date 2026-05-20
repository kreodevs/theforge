import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { requestUserStore } from "../request-user.store.js";
import { requireAdmin, requireSuperAdmin } from "./role.helpers.js";

test("requireSuperAdmin — permite super_admin", () => {
  requestUserStore.run({ userId: "u1", role: "super_admin" }, () => {
    assert.doesNotThrow(() => requireSuperAdmin());
  });
});

test("requireSuperAdmin — rechaza admin", () => {
  requestUserStore.run({ userId: "u1", role: "admin" }, () => {
    assert.throws(() => requireSuperAdmin(), ForbiddenException);
  });
});

test("requireAdmin — permite admin y super_admin", () => {
  requestUserStore.run({ userId: "u1", role: "admin" }, () => {
    assert.doesNotThrow(() => requireAdmin());
  });
  requestUserStore.run({ userId: "u1", role: "super_admin" }, () => {
    assert.doesNotThrow(() => requireAdmin());
  });
});

test("requireAdmin — rechaza developer", () => {
  requestUserStore.run({ userId: "u1", role: "developer" }, () => {
    assert.throws(() => requireAdmin(), ForbiddenException);
  });
});
