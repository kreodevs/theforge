import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildUserDeclaredStackPromptBlock,
  hasUserDeclaredStack,
  mentionsStackTechnology,
  minLengthForExplicitRequirements,
} from "./user-declared-stack.util.js";

describe("user-declared-stack.util", () => {
  it("detects stack keywords", () => {
    assert.equal(mentionsStackTechnology("Frontend Vue 3 + Pinia"), true);
    assert.equal(mentionsStackTechnology("solo dominio de negocio"), false);
  });

  it("hasUserDeclaredStack requires framework + intent", () => {
    assert.equal(hasUserDeclaredStack("Quiero frontend en Vue 3 con Vite"), true);
    assert.equal(hasUserDeclaredStack("Competidor Built with Next.js"), false);
    assert.equal(hasUserDeclaredStack("Stack: SvelteKit + FastAPI"), true);
  });

  it("buildUserDeclaredStackPromptBlock returns empty without user stack", () => {
    assert.equal(buildUserDeclaredStackPromptBlock("app de citas médicas"), "");
  });

  it("buildUserDeclaredStackPromptBlock includes mandate when stack declared", () => {
    const block = buildUserDeclaredStackPromptBlock("Prefiero SvelteKit y backend FastAPI");
    assert.match(block, /STACK DECLARADO/i);
    assert.match(block, /PROHIBIDO/i);
    assert.match(block, /SvelteKit/i);
  });

  it("lowers min length when stack mentioned", () => {
    assert.equal(minLengthForExplicitRequirements("Vue 3 frontend"), 20);
    assert.equal(minLengthForExplicitRequirements("solo negocio"), 50);
  });
});
