import { describe, expect, it } from "vitest";
import {
  inferPreviewPropsFromSource,
  patchCompiledForUmdReact,
  prepareSnippetForIframe,
  previewPropsForComponent,
} from "./wireframeSnippetPreview";

describe("wireframeSnippetPreview", () => {
  it("unwraps MCP JSON envelope", () => {
    const raw = JSON.stringify({
      moduleId: "button",
      standalone: true,
      snippet: "function Button() { return null; }",
    });
    const prepared = prepareSnippetForIframe(raw);
    expect(prepared).toContain("function Button()");
    expect(prepared).toContain("const React = window.React");
    expect(prepared).not.toMatch(/^import\s/m);
  });

  it("patches Babel require('react') to window.React", () => {
    const compiled = `
var _react = _interopRequireDefault(require("react"));
function Button() {
  var _useState = _react.default.useState(false);
}
`;
    const patched = patchCompiledForUmdReact(compiled);
    expect(patched).toContain("var _react = window.React");
    expect(patched).not.toContain('require("react")');
  });

  it("provides items[] for Accordion-like components", () => {
    const source = `
function Accordion({ items }) {
  return React.createElement('div', null, items.map(function(i) {
    return React.createElement('div', { key: i.id }, i.title);
  }));
}`;
    const props = previewPropsForComponent("Accordion", source);
    expect(props).toContain("items:");
    const prepared = prepareSnippetForIframe(source);
    expect(prepared).toContain("PreviewErrorBoundary");
    expect(prepared).toContain("items:");
  });

  it("infers items from source when name is generic", () => {
    const inferred = inferPreviewPropsFromSource(
      "function X({ items }) { return items.map(i => i); }",
      "X",
    );
    expect(inferred).toContain("items:");
  });

  it("injects hook prelude for bare useState", () => {
    const raw = `
import React, { useState } from 'react';
function Input() {
  const [v, setV] = useState('');
  return React.createElement('input', { value: v, onChange: (e) => setV(e.target.value) });
}
`;
    const prepared = prepareSnippetForIframe(raw);
    expect(prepared).toContain("const { useState");
    expect(prepared).not.toContain("from 'react'");
    expect(prepared).toMatch(/\buseState\(/);
  });
});
