import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isContractStubJsonValue,
  MINIMAL_CONTRATO_JSON_PLACEHOLDER,
  repairContratosMarkdownArtifacts,
  sanitizeSection4JsonBlocksForDelivery,
  stripContractStubJsonBlocks,
} from "./contratos-format.js";

describe("contratos-format contract stubs", () => {
  it("isContractStubJsonValue detecta stub legacy con request.note", () => {
    assert.equal(
      isContractStubJsonValue({
        request: { note: "contract stub — pending endpoint detail" },
        response: { data: [], meta: { status: "ok" } },
      }),
      true,
    );
    assert.equal(
      isContractStubJsonValue({
        request: { topicId: "550e8400-e29b-41d4-a716-446655440000" },
        response: { status: "ok" },
      }),
      false,
    );
  });

  it("MINIMAL_CONTRATO_JSON_PLACEHOLDER no usa clave top-level request", () => {
    const parsed = JSON.parse(MINIMAL_CONTRATO_JSON_PLACEHOLDER) as Record<string, unknown>;
    assert.equal("request" in parsed, false);
    assert.ok(parsed.response);
  });

  it("stripContractStubJsonBlocks sustituye stub legacy sin request top-level", () => {
    const body = `\`\`\`json
{
  "request": { "note": "contract stub — pending endpoint detail" },
  "response": { "data": [], "meta": { "status": "ok" } }
}
\`\`\``;
    const { body: out, stripped } = stripContractStubJsonBlocks(body);
    assert.equal(stripped, 1);
    assert.doesNotMatch(out, /"request"\s*:/);
    assert.match(out, /contract detail pending/i);
  });

  it("sanitizeSection4JsonBlocksForDelivery no reintroduce request en placeholder", () => {
    const body = `\`\`\`json
{ not valid json :::
\`\`\``;
    const { body: fixed, fixed: tags } = sanitizeSection4JsonBlocksForDelivery(body);
    assert.ok(tags.includes("§4-json-placeholder"));
    assert.doesNotMatch(fixed, /"request"\s*:\s*\{\s*"note":\s*"contract stub/i);
  });
});

describe("contratos-format markdown artifacts", () => {
  it("repairContratosMarkdownArtifacts corrige ---} y cierra fence", () => {
    const body = `### GET /me

\`\`\`json
{ "response": { "data": [] }
---}

### POST /x
`;
    const out = repairContratosMarkdownArtifacts(body);
    assert.doesNotMatch(out, /---\}/);
    assert.match(out, /```\s*\n\s*### POST/);
  });
});
