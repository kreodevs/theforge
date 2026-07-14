-- Snapshots completos de documentos antes de sobrescribir (recuperación ante truncado por LLM).
CREATE TABLE "DocumentSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentSnapshot_projectId_field_createdAt_idx"
    ON "DocumentSnapshot"("projectId", "field", "createdAt" DESC);

ALTER TABLE "DocumentSnapshot"
    ADD CONSTRAINT "DocumentSnapshot_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentSnapshot"
    ADD CONSTRAINT "DocumentSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
