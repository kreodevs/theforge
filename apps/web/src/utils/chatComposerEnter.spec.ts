import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  handleChatComposerEnterKeyDown,
  shouldSubmitChatOnEnter,
} from "./chatComposerEnter.js";

describe("chatComposerEnter", () => {
  it("shouldSubmitChatOnEnter returns true without matchMedia", () => {
    const original = globalThis.matchMedia;
    // @ts-expect-error test stub
    globalThis.matchMedia = undefined;
    assert.equal(shouldSubmitChatOnEnter(), true);
    globalThis.matchMedia = original;
  });

  it("handleChatComposerEnterKeyDown submits on Enter when coarse pointer is false", () => {
    const submit = mock.fn();
    const preventDefault = mock.fn();
    handleChatComposerEnterKeyDown(
      {
        key: "Enter",
        shiftKey: false,
        preventDefault,
      } as unknown as import("react").KeyboardEvent<HTMLTextAreaElement>,
      submit,
    );
    assert.equal(submit.mock.callCount(), 1);
    assert.equal(preventDefault.mock.callCount(), 1);
  });

  it("handleChatComposerEnterKeyDown ignores Shift+Enter", () => {
    const submit = mock.fn();
    const preventDefault = mock.fn();
    handleChatComposerEnterKeyDown(
      {
        key: "Enter",
        shiftKey: true,
        preventDefault,
      } as unknown as import("react").KeyboardEvent<HTMLTextAreaElement>,
      submit,
    );
    assert.equal(submit.mock.callCount(), 0);
    assert.equal(preventDefault.mock.callCount(), 0);
  });
});
