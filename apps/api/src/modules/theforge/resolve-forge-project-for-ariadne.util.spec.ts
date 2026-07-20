import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pickForgeProjectResolution,
  type ForgeProjectLinkRow,
} from "./resolve-forge-project-for-ariadne.util.js";
import { normalizeGitRemoteUrl } from "./normalize-git-remote.util.js";

describe("normalizeGitRemoteUrl", () => {
  it("lowercases and strips .git suffix", () => {
    assert.equal(
      normalizeGitRemoteUrl("HTTPS://GitHub.com/KreoDevs/TheForge.git"),
      "https://github.com/kreodevs/theforge",
    );
  });
});

describe("pickForgeProjectResolution", () => {
  const rows: ForgeProjectLinkRow[] = [
    {
      projectId: "forge-1",
      projectName: "The Forge Workshop",
      theforgeProjectId: "ariadne-repo-1",
      linkId: "link-1",
      ariadneProjectId: "ariadne-ws-1",
      ariadneRepositoryId: "ariadne-repo-1",
      gitRemote: "https://github.com/kreodevs/theforge.git",
      projectKey: "kreodevs",
      repoSlug: "theforge",
      isPrimary: true,
    },
    {
      projectId: "forge-2",
      projectName: "Otro",
      theforgeProjectId: "ariadne-repo-2",
      linkId: "link-2",
      ariadneProjectId: "ariadne-ws-2",
      ariadneRepositoryId: "ariadne-repo-2",
      gitRemote: null,
      projectKey: null,
      repoSlug: null,
      isPrimary: true,
    },
  ];

  it("resuelve por ariadneRepositoryId", () => {
    const out = pickForgeProjectResolution(
      { ariadneRepositoryId: "ariadne-repo-1" },
      rows,
      new Map(),
    );
    assert.equal(out.kind, "single");
    if (out.kind === "single") {
      assert.equal(out.result.forgeProjectId, "forge-1");
      assert.equal(out.result.linkKind, "primary");
    }
  });

  it("devuelve ambiguous cuando hay empate", () => {
    const dupRows: ForgeProjectLinkRow[] = [
      ...rows,
      {
        ...rows[1]!,
        projectId: "forge-3",
        projectName: "Duplicado",
        linkId: "link-3",
      },
    ];
    const out = pickForgeProjectResolution(
      { ariadneRepositoryId: "ariadne-repo-2" },
      dupRows,
      new Map(),
    );
    assert.equal(out.kind, "ambiguous");
    if (out.kind === "ambiguous") {
      assert.ok(out.candidates.length >= 2);
    }
  });
});
