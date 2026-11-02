-- PostgreSQL 18 Initialization Script with native uuidv7() and pgvector (halfvec)

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create Dedicated Application Role (Non-Superuser, NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_secret' NOBYPASSRLS;
  END IF;
END
$$;

-- 2. Notebooks Table
CREATE TABLE IF NOT EXISTS notebooks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'hybrid_rag',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Sources Table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  latest_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Source Versions Table
CREATE TABLE IF NOT EXISTS source_versions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  version_number INT NOT NULL,
  s3_raw_key TEXT NOT NULL,
  s3_parsed_prefix TEXT,
  sha256_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  processing_progress INT NOT NULL DEFAULT 0,
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint for sources.latest_version_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sources_latest_version'
  ) THEN
    ALTER TABLE sources
    ADD CONSTRAINT fk_sources_latest_version
    FOREIGN KEY (latest_version_id) REFERENCES source_versions(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- 5. Chat Threads Table
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Chat Thread Pinned Versions Table (Snapshot Isolation)
CREATE TABLE IF NOT EXISTS chat_thread_pinned_versions (
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES source_versions(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  PRIMARY KEY (thread_id, source_id)
);

-- 7. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  reasoning TEXT,
  citations JSONB,
  parent_id UUID REFERENCES chat_messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. RAG Chunks Table with Harmonized halfvec(1024)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  source_id UUID NOT NULL,
  version_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding halfvec(1024),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  citation_anchor JSONB NOT NULL,
  is_multimodal BOOLEAN NOT NULL DEFAULT FALSE,
  image_s3_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. HNSW Index on halfvec(1024) and GIN Index on tsvector
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING hnsw (embedding halfvec_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv ON rag_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_version ON rag_chunks (version_id);
CREATE INDEX IF NOT EXISTS idx_source_versions_source ON source_versions (source_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages (thread_id);

-- 10. Enable & FORCE Row-Level Security on all 7 tables
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooks FORCE ROW LEVEL SECURITY;

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources FORCE ROW LEVEL SECURITY;

ALTER TABLE source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads FORCE ROW LEVEL SECURITY;

ALTER TABLE chat_thread_pinned_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_thread_pinned_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks FORCE ROW LEVEL SECURITY;

-- 11. Define RLS Policies
DROP POLICY IF EXISTS rls_notebooks ON notebooks;
CREATE POLICY rls_notebooks ON notebooks
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_sources ON sources;
CREATE POLICY rls_sources ON sources
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_source_versions ON source_versions;
CREATE POLICY rls_source_versions ON source_versions
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_chat_threads ON chat_threads;
CREATE POLICY rls_chat_threads ON chat_threads
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_chat_thread_pinned ON chat_thread_pinned_versions;
CREATE POLICY rls_chat_thread_pinned ON chat_thread_pinned_versions
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_chat_messages ON chat_messages;
CREATE POLICY rls_chat_messages ON chat_messages
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS rls_rag_chunks ON rag_chunks;
CREATE POLICY rls_rag_chunks ON rag_chunks
  USING (owner_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid);

-- 12. Grant permissions to app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
