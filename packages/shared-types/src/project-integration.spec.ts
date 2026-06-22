import { formatIntegrationHandoffPreviewStory, nextNewLegId } from "@theforge/shared-types";

describe("nextNewLegId", () => {
  it("starts at NEW-LEG-01", () => {
    expect(nextNewLegId([])).toBe("NEW-LEG-01");
  });

  it("increments from max existing", () => {
    expect(nextNewLegId([{ id: "NEW-LEG-03" }, { id: "NEW-LEG-01" }])).toBe("NEW-LEG-04");
  });
});

describe("formatIntegrationHandoffPreviewStory", () => {
  it("formats natural-language handoff as integration user story preview", () => {
    const md = formatIntegrationHandoffPreviewStory({
      id: "NEW-LEG-01",
      title: "Costos en cotizador",
      description: "El cotizador debe mostrar costos desglosados por medio.",
      actor: "vendedor",
      acceptanceCriteria: ["Se ve el costo unitario"],
    });
    expect(md).toContain("NEW-LEG-01");
    expect(md).toContain("Costos en cotizador");
    expect(md).toContain("costos desglosados");
    expect(md).toContain("**Como:** vendedor");
    expect(md).toContain("Se ve el costo unitario");
    expect(md).toContain("No** forma parte del documento **Historias de Usuario**");
  });
});
