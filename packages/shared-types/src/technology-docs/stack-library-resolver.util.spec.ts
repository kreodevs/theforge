import assert from "node:assert/strict";
import test from "node:test";
import { resolveStackLibrariesFromMarkdown } from "./stack-library-resolver.util.js";

test("resolveStackLibrariesFromMarkdown detects NestJS and Prisma from §2-like text", () => {
  const mdd = `
## 2. Stack
- Backend: NestJS + Prisma ORM
- Frontend: React + Vite + Tailwind CSS
`;
  const libs = resolveStackLibrariesFromMarkdown(mdd, 5);
  const names = libs.map((l) => l.libraryName);
  assert.ok(names.includes("nestjs"));
  assert.ok(names.includes("prisma"));
  assert.ok(names.includes("react"));
});

test("resolveStackLibrariesFromMarkdown returns empty for blank input", () => {
  assert.deepEqual(resolveStackLibrariesFromMarkdown(""), []);
});

test("resolveStackLibrariesFromMarkdown respects maxLibraries cap", () => {
  const mdd = "NestJS Prisma React Next.js Zod BullMQ Express";
  const libs = resolveStackLibrariesFromMarkdown(mdd, 2);
  assert.equal(libs.length, 2);
});
