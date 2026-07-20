import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  workshopPanelPersistFailedBanner,
  workshopPanelPersistFailedChatNote,
} from "./workshop-fin-delimiter-covenant.js";

describe("workshopPanelPersistFailedBanner", () => {
  it("no menciona delimitadores ni pide reformular con ---FIN_*---", () => {
    const msg = workshopPanelPersistFailedBanner("benchmark");
    assert.match(msg, /DBGA/);
    assert.doesNotMatch(msg, /---FIN_/);
    assert.doesNotMatch(msg, /Reformula/i);
  });
});

describe("workshopPanelPersistFailedChatNote", () => {
  it("no expone jerga de delimitador al usuario", () => {
    const msg = workshopPanelPersistFailedChatNote("benchmark", true);
    assert.doesNotMatch(msg, /---FIN_/);
    assert.match(msg, /Repite tu pedido/i);
  });
});
