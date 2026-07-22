-- Mueve las tablas de checkpoints de LangGraph del schema `public` al schema
-- dedicado `langgraph`. Razón: `prisma db push --accept-data-loss` borra
-- cualquier tabla que no esté modelada en `schema.prisma`, y los checkpoints
-- se crean por DDL directo en `ensureLangGraphCheckpointSchema` — antes
-- vivían en `public` y un restart del worker los borraba, perdiendo el
-- stream del MDD a mitad de `/mdd-completo`. Ver CHANGELOG [Unreleased].
--
-- Idempotente: si las tablas ya están en `langgraph`, no hace nada. Si
-- coexisten tablas en `public` (BD vieja), copia los datos y las borra.
-- Seguro en BD fresca (no hay `public.checkpoint_*`, el bloque se salta).

-- 1. Crear schema dedicado y tablas destino (idempotente, replica el DDL de
--    `20260513180000_langgraph_checkpoint_tables` pero en el schema correcto).
CREATE SCHEMA IF NOT EXISTS "langgraph";

CREATE TABLE IF NOT EXISTS "langgraph"."checkpoint_migrations" (
  v INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "langgraph"."checkpoints" (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS "langgraph"."checkpoint_blobs" (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  blob BYTEA,
  PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE TABLE IF NOT EXISTS "langgraph"."checkpoint_writes" (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  blob BYTEA NOT NULL,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

ALTER TABLE "langgraph"."checkpoint_blobs" ALTER COLUMN "blob" DROP NOT NULL;

-- 2. Marcar las versiones LangGraph 0..4 como aplicadas para que
--    `ensureLangGraphCheckpointSchema` (que crea DDL idempotente por su
--    propia cuenta) se comporte como no-op en arranques posteriores.
INSERT INTO "langgraph"."checkpoint_migrations" (v) VALUES (0) ON CONFLICT (v) DO NOTHING;
INSERT INTO "langgraph"."checkpoint_migrations" (v) VALUES (1) ON CONFLICT (v) DO NOTHING;
INSERT INTO "langgraph"."checkpoint_migrations" (v) VALUES (2) ON CONFLICT (v) DO NOTHING;
INSERT INTO "langgraph"."checkpoint_migrations" (v) VALUES (3) ON CONFLICT (v) DO NOTHING;
INSERT INTO "langgraph"."checkpoint_migrations" (v) VALUES (4) ON CONFLICT (v) DO NOTHING;

-- 3. Migrar datos viejos: si existen `public.checkpoint_*`, las movemos a
--    `langgraph.*` (INSERT ... ON CONFLICT DO NOTHING para no pisar datos
--    ya migrados en un re-deploy). Después borramos las tablas viejas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'checkpoints'
  ) THEN
    INSERT INTO "langgraph"."checkpoints"
      (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
    SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
    FROM "public"."checkpoints"
    ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'checkpoint_blobs'
  ) THEN
    INSERT INTO "langgraph"."checkpoint_blobs"
      (thread_id, checkpoint_ns, channel, version, type, blob)
    SELECT thread_id, checkpoint_ns, channel, version, type, blob
    FROM "public"."checkpoint_blobs"
    ON CONFLICT (thread_id, checkpoint_ns, channel, version) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'checkpoint_writes'
  ) THEN
    INSERT INTO "langgraph"."checkpoint_writes"
      (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, blob)
    SELECT thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, blob
    FROM "public"."checkpoint_writes"
    ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id, task_id, idx) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'checkpoint_migrations'
  ) THEN
    INSERT INTO "langgraph"."checkpoint_migrations" (v)
    SELECT v FROM "public"."checkpoint_migrations"
    ON CONFLICT (v) DO NOTHING;
  END IF;
END $$;

-- 4. Borrar las tablas viejas SOLO si la migración de datos terminó OK.
--    No DROP CASCADE: la app no tiene FKs hacia estas tablas, pero por si
--    una extensión las añadió, usamos CASCADE acotado por tabla.
DROP TABLE IF EXISTS "public"."checkpoint_writes" CASCADE;
DROP TABLE IF EXISTS "public"."checkpoint_blobs" CASCADE;
DROP TABLE IF EXISTS "public"."checkpoints" CASCADE;
DROP TABLE IF EXISTS "public"."checkpoint_migrations" CASCADE;
