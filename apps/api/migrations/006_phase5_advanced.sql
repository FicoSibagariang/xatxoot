-- Phase 5: AI Copilot, SLA, & Enterprise Migration
-- Task 5.1: Vector Extension for Knowledge Base Embeddings & Semantic Search

CREATE EXTENSION IF NOT EXISTS vector;

-- Task 5.2: Knowledge Base Vector Embeddings Table
CREATE TABLE IF NOT EXISTS article_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES portal_articles(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index for article lookup
CREATE INDEX IF NOT EXISTS idx_article_embeddings_article_id ON article_embeddings(article_id);
