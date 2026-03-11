import OpenAI from "openai";
import { prisma } from "@/lib/db";

const openai = new OpenAI();
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 500; // tokens (~400-512)
const CHUNK_OVERLAP = 50; // tokens

/**
 * Generate embedding vector for a text string.
 */
export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // safety limit
  });
  return res.data[0]!.embedding;
}

/**
 * Split text into overlapping chunks by rough token count (~4 chars/token).
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const charSize = chunkSize * 4;
  const charOverlap = overlap * 4;
  const chunks: string[] = [];

  // Split by paragraphs first, then merge into chunk-sized pieces
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 > charSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current chunk
      current = current.slice(-charOverlap) + "\n\n" + trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Index a published article into ArticleChunk for RAG retrieval.
 */
export async function indexArticle(opts: {
  content: string;
  sourceType: string;
  sourceId: string;
  personaId?: string | null;
  topics?: string[];
  artistMentions?: string[];
  publishedAt?: Date;
}): Promise<number> {
  const chunks = chunkText(opts.content);
  let indexed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const vector = await embed(chunk);
    const vectorStr = `[${vector.join(",")}]`;

    await prisma.$queryRawUnsafe(
      `INSERT INTO article_chunks (id, content, embedding, source_type, source_id, persona_id, topics, artist_mentions, published_at, chunk_index, created_at)
       VALUES (gen_random_uuid(), $1, $2::vector, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      chunk,
      vectorStr,
      opts.sourceType,
      opts.sourceId,
      opts.personaId ?? null,
      opts.topics ?? [],
      opts.artistMentions ?? [],
      opts.publishedAt ?? new Date(),
      i,
    );
    indexed++;
  }

  return indexed;
}

// -- Search result type shared by all search methods --

interface ChunkResult {
  id: string;
  content: string;
  sourceType: string;
  sourceId: string;
  score: number;
}

/**
 * Search ArticleChunks by vector similarity. Returns top-k most relevant chunks.
 */
export async function searchSimilarChunks(
  query: string,
  opts?: { limit?: number; sourceType?: string; personaId?: string },
): Promise<ChunkResult[]> {
  const vector = await embed(query);
  const vectorStr = `[${vector.join(",")}]`;
  const limit = opts?.limit ?? 5;

  const filters: string[] = [];
  const params: unknown[] = [vectorStr, limit];

  if (opts?.sourceType) {
    params.push(opts.sourceType);
    filters.push(`AND source_type = $${params.length}`);
  }
  if (opts?.personaId) {
    params.push(opts.personaId);
    filters.push(`AND persona_id = $${params.length}`);
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; content: string; source_type: string; source_id: string; score: number }>
  >(
    `SELECT id, content, source_type, source_id,
            1 - (embedding <=> $1::vector) as score
     FROM article_chunks
     WHERE 1=1 ${filters.join(" ")}
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    ...params,
  );

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    sourceType: r.source_type,
    sourceId: r.source_id,
    score: Number(r.score),
  }));
}

/**
 * Search ArticleChunks by keyword (BM25-style) using PostgreSQL full-text search.
 * Uses plainto_tsquery for safe query parsing (handles Korean + English).
 */
export async function searchByKeyword(
  query: string,
  opts?: { limit?: number; sourceType?: string; personaId?: string },
): Promise<ChunkResult[]> {
  const limit = opts?.limit ?? 5;

  const filters: string[] = [];
  const params: unknown[] = [query, limit];

  if (opts?.sourceType) {
    params.push(opts.sourceType);
    filters.push(`AND source_type = $${params.length}`);
  }
  if (opts?.personaId) {
    params.push(opts.personaId);
    filters.push(`AND persona_id = $${params.length}`);
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; content: string; source_type: string; source_id: string; score: number }>
  >(
    `SELECT id, content, source_type, source_id,
            ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $1)) as score
     FROM article_chunks
     WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
     ${filters.join(" ")}
     ORDER BY score DESC
     LIMIT $2`,
    ...params,
  );

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    sourceType: r.source_type,
    sourceId: r.source_id,
    score: Number(r.score),
  }));
}

/**
 * Hybrid search: combines vector similarity + keyword (BM25) search
 * using Reciprocal Rank Fusion (RRF).
 *
 * RRF score = 1/(k + rank_vector) + 1/(k + rank_keyword)
 * k=60 is the standard constant that balances the two signals.
 */
export async function searchHybrid(
  query: string,
  opts?: { limit?: number; sourceType?: string; personaId?: string },
): Promise<ChunkResult[]> {
  const limit = opts?.limit ?? 5;
  const fetchLimit = limit * 3; // fetch more from each method for better fusion

  const searchOpts = { ...opts, limit: fetchLimit };

  const [vectorResults, keywordResults] = await Promise.all([
    searchSimilarChunks(query, searchOpts).catch(() => [] as ChunkResult[]),
    searchByKeyword(query, searchOpts).catch(() => [] as ChunkResult[]),
  ]);

  // If one method returns nothing, fall back to the other
  if (vectorResults.length === 0 && keywordResults.length === 0) return [];
  if (keywordResults.length === 0) return vectorResults.slice(0, limit);
  if (vectorResults.length === 0) return keywordResults.slice(0, limit);

  // RRF fusion
  const RRF_K = 60;
  const scoreMap = new Map<string, { chunk: ChunkResult; rrfScore: number }>();

  vectorResults.forEach((chunk, rank) => {
    const existing = scoreMap.get(chunk.id);
    const rrfContrib = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContrib;
    } else {
      scoreMap.set(chunk.id, { chunk, rrfScore: rrfContrib });
    }
  });

  keywordResults.forEach((chunk, rank) => {
    const existing = scoreMap.get(chunk.id);
    const rrfContrib = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContrib;
    } else {
      scoreMap.set(chunk.id, { chunk, rrfScore: rrfContrib });
    }
  });

  // Sort by RRF score descending, return top-k
  return [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((entry) => ({ ...entry.chunk, score: entry.rrfScore }));
}
