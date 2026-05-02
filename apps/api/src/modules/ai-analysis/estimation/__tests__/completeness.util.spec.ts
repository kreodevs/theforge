import { computeDocumentCompleteness } from "../completeness.util";

describe("computeDocumentCompleteness", () => {
  it("returns 100 when all docs have >=300 chars", () => {
    const fill = (n: number) => "x".repeat(n);
    const docs = {
      brdContent: fill(300),
      toBeManualContent: fill(300),
      asIsManualContent: fill(300),
      specContent: fill(300),
      architectureContent: fill(300),
      useCasesContent: fill(300),
      userStoriesContent: fill(300),
      blueprintContent: fill(300),
      apiContractsContent: fill(300),
      logicFlowsContent: fill(300),
      infraContent: fill(300),
      tasksContent: fill(300),
    };
    const r = computeDocumentCompleteness(docs);
    expect(r.overall).toBe(100);
    // Each key should be 100
    for (const [k, v] of Object.entries(r)) {
      if (k !== "overall") expect(v).toBe(100);
    }
  });

  it("returns 0 when no docs have content", () => {
    const r = computeDocumentCompleteness({});
    expect(r.overall).toBe(0);
    expect(r.brdContent).toBe(0);
  });

  it("returns partial scores for mixed content", () => {
    const docs = {
      brdContent: "x".repeat(500),  // complete → 100 (weight 0.18)
      specContent: "x".repeat(100),  // partial → 50 (weight 0.10)
      tasksContent: "",              // empty → 0 (weight 0.03)
    };
    const r = computeDocumentCompleteness(docs);
    // expected = 0.18*1.0 + 0.10*0.5 + 0.03*0.0 = 0.23 → 23%
    expect(r.overall).toBe(23);
    expect(r.brdContent).toBe(100);
    expect(r.specContent).toBe(50);
    expect(r.tasksContent).toBe(0);
    // omitted keys default to 0
    expect(r.infraContent).toBe(0);
  });

  it("scores 10 for minimal content (< 80 chars)", () => {
    const docs = { brdContent: "Hola mundo" }; // 11 chars
    const r = computeDocumentCompleteness(docs);
    expect(r.brdContent).toBe(10);
    expect(r.overall).toBe(2); // 0.18 * 0.10 = 0.018 → 2%
  });

  it("scores 50 for partial content (80-299 chars)", () => {
    const docs = { brdContent: "x".repeat(80) };
    const r = computeDocumentCompleteness(docs);
    expect(r.brdContent).toBe(50);
    expect(r.overall).toBe(9); // 0.18 * 0.50 = 0.09 → 9%
  });
});
