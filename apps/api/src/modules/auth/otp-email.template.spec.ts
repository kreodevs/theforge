import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOtpEmailContent } from "./otp-email.template.js";

describe("buildOtpEmailContent", () => {
  it("renders a copy-friendly 6-digit code without literal spaces or attachments", () => {
    const { html, text, subject } = buildOtpEmailContent({
      code: "980999",
      email: "user@example.com",
      appBaseUrl: null,
    });

    assert.equal(subject, "Código de acceso — The Forge (980999)");
    assert.match(text, /^980999/m);
    assert.doesNotMatch(html, /9 8 0 9 9 9/);
    assert.match(html, /font-family:ui-monospace[\s\S]*980999/);
    assert.match(html, /The Forge/);
    assert.doesNotMatch(html, /La Forja/);
    assert.doesNotMatch(html, /cid:/);
  });

  it("includes inline copy icon and handoff link when app base URL is set", () => {
    const { html, text } = buildOtpEmailContent({
      code: "123456",
      email: "user@example.com",
      appBaseUrl: "http://localhost:5173",
    });

    assert.match(html, /http:\/\/localhost:5173\/auth\/otp\?otp=123456/);
    assert.match(html, /title="Copiar código"/);
    assert.match(html, />copiar</);
    assert.doesNotMatch(html, /cid:/);
    assert.doesNotMatch(html, /@localhost:5173 #123456/);
    assert.doesNotMatch(html, /Ir al login de The Forge/);
    assert.doesNotMatch(text, /@localhost:5173 #123456/);
    assert.match(text, /auth\/otp\?otp=123456/);
  });
});
