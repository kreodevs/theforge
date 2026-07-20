-- Enlaces Forge ↔ Ariadne (brownfield / parity pack). No se editan desde Ariadne.
CREATE TABLE IF NOT EXISTS "project_ariadne_links" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ariadneProjectId" TEXT,
  "ariadneRepositoryId" TEXT,
  "gitRemote" TEXT,
  "projectKey" TEXT,
  "repoSlug" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_ariadne_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_ariadne_links_projectId_idx" ON "project_ariadne_links"("projectId");
CREATE INDEX IF NOT EXISTS "project_ariadne_links_ariadneProjectId_idx" ON "project_ariadne_links"("ariadneProjectId");
CREATE INDEX IF NOT EXISTS "project_ariadne_links_ariadneRepositoryId_idx" ON "project_ariadne_links"("ariadneRepositoryId");
CREATE INDEX IF NOT EXISTS "project_ariadne_links_gitRemote_idx" ON "project_ariadne_links"("gitRemote");
CREATE INDEX IF NOT EXISTS "project_ariadne_links_projectKey_repoSlug_idx" ON "project_ariadne_links"("projectKey", "repoSlug");

ALTER TABLE "project_ariadne_links"
  ADD CONSTRAINT "project_ariadne_links_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
