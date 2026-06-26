import { describe, expect, it } from "vitest";
import { computeMermaidFitTransform } from "./MarkdownMermaid";

describe("computeMermaidFitTransform", () => {
  it("centers and scales content to fit viewport", () => {
    const fit = computeMermaidFitTransform(1000, 800, 2000, 1000, 0);
    expect(fit.scale).toBe(0.5);
    expect(fit.x).toBe(0);
    expect(fit.y).toBe(150);
  });

  it("respects padding", () => {
    const fit = computeMermaidFitTransform(500, 500, 400, 400, 50);
    expect(fit.scale).toBeCloseTo(1);
    expect(fit.x).toBeCloseTo(50);
    expect(fit.y).toBeCloseTo(50);
  });
});
