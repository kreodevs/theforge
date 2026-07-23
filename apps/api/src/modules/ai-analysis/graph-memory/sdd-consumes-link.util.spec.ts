import { describe, expect, it } from "vitest";
import {
  extractForeignKeyTargetsByTable,
  extractTableRefsFromSql,
  inferConsumedTableStorageNames,
} from "./sdd-consumes-link.util.js";

describe("sdd-consumes-link", () => {
  it("extracts schema-qualified tables", () => {
    const sql = `
CREATE TABLE public.users (id UUID PRIMARY KEY);
CREATE TABLE public.roles (id UUID PRIMARY KEY);
`;
    const refs = extractTableRefsFromSql(sql);
    expect(refs.map((r) => r.storageName)).toEqual(["public.users", "public.roles"]);
    expect(refs.map((r) => r.bareName)).toEqual(["users", "roles"]);
  });

  it("maps FK REFERENCES between tables", () => {
    const sql = `
CREATE TABLE public.users (id UUID PRIMARY KEY);
CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id),
  role_id UUID NOT NULL REFERENCES public.roles(id)
);
CREATE TABLE public.roles (id UUID PRIMARY KEY);
`;
    const fk = extractForeignKeyTargetsByTable(sql);
    expect(fk.get("public.user_roles")?.has("public.users")).toBe(true);
    expect(fk.get("public.user_roles")?.has("public.roles")).toBe(true);
  });

  it("matches path segments to bare table names (not substring false positives)", () => {
    const tables = extractTableRefsFromSql(`
CREATE TABLE public.users (id UUID PRIMARY KEY);
CREATE TABLE public.applications (id UUID PRIMARY KEY);
`);
    const consumed = inferConsumedTableStorageNames("/api/v1/users/{id}", tables);
    expect(consumed).toContain("public.users");
    expect(consumed).not.toContain("public.applications");
  });

  it("includes FK targets for matched owner tables", () => {
    const sql = `
CREATE TABLE public.orders (id UUID PRIMARY KEY);
CREATE TABLE public.order_items (
  order_id UUID REFERENCES public.orders(id)
);
`;
    const tables = extractTableRefsFromSql(sql);
    const fk = extractForeignKeyTargetsByTable(sql);
    const consumed = inferConsumedTableStorageNames("/api/v1/orders", tables, fk);
    expect(consumed).toContain("public.orders");
  });
});
