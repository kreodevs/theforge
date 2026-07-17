import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HumanMessage } from "@langchain/core/messages";
import {
  ARCHITECT_LLM_PROGRESS_INTERVAL_MS,
  emitArchitectLlmProgress,
  invokeArchitectLlmStreaming,
  type ArchitectLlmProgressContext,
} from "./architect-llm-invoke.util.js";

describe("architect-llm-invoke.util", () => {
  it("emitArchitectLlmProgress forwards phase payload to trace service", () => {
    const events: Array<Record<string, unknown>> = [];
    const ctx: ArchitectLlmProgressContext = {
      passNumber: 1,
      passKind: "architect_sections_2_to_5",
      promptChars: 9000,
      maxOutputTokens: 32768,
      modelSlug: "google/gemini-2.5-pro-preview",
      toolsEnabled: false,
      trace: {
        architectLlmProgress: (_id, payload) => events.push(payload),
      } as unknown as ArchitectLlmProgressContext["trace"],
      correlationId: "corr-x",
    };

    emitArchitectLlmProgress(ctx, "prompt_built");
    emitArchitectLlmProgress(ctx, "llm_stream_chunk", { elapsedMs: 8000, charsReceived: 512 });

    assert.equal(events.length, 2);
    assert.equal(events[0]?.phase, "prompt_built");
    assert.equal(events[1]?.phase, "llm_stream_chunk");
    assert.equal(events[1]?.charsReceived, 512);
    assert.equal(events[1]?.modelSlug, "google/gemini-2.5-pro-preview");
  });

  it("invokeArchitectLlmStreaming emits start, chunk progress, and end", async () => {
    const phases: string[] = [];
    const ctx: ArchitectLlmProgressContext = {
      passNumber: 1,
      passKind: "architect_sections_2_to_5",
      promptChars: 1000,
      toolsEnabled: false,
      trace: {
        architectLlmProgress: (_id, payload) => phases.push(String(payload.phase)),
      } as unknown as ArchitectLlmProgressContext["trace"],
      correlationId: "corr-y",
    };

    async function* fakeStream() {
      yield { content: "CREATE TABLE users" };
      await new Promise((resolve) => setTimeout(resolve, ARCHITECT_LLM_PROGRESS_INTERVAL_MS + 20));
      yield { content: " (id UUID PRIMARY KEY);" };
    }

    const llm = {
      stream: async () => fakeStream(),
    };

    const text = await invokeArchitectLlmStreaming(llm, [new HumanMessage("prompt")], ctx);
    assert.match(text, /CREATE TABLE users/);
    assert.ok(phases.includes("llm_invoke_start"));
    assert.ok(phases.includes("llm_stream_chunk"));
    assert.ok(phases.includes("llm_invoke_end"));
  });
});
