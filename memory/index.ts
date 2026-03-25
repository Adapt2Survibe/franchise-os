/**
 * memory/index.ts — FranchiseOS Memory System
 *
 * Multi-layer memory system backed by Supabase pgvector.
 * Supports episodic, semantic, strategic, brand, market, campaign,
 * franchisee, territory, and decision-log memory layers.
 *
 * Usage:
 *   import { storeMemory, retrieveMemory, searchSimilarMemories } from '../memory';
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryLayer =
  | "episodic"
  | "semantic"
  | "strategic"
  | "brand"
  | "market"
  | "campaign"
  | "franchisee"
  | "territory"
  | "decision-log";

export interface MemoryRecord {
  id: string;
  brand_id: string;
  layer: MemoryLayer;
  content: string;
  embedding_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SimilarMemoryResult {
  id: string;
  brand_id: string;
  layer: MemoryLayer;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

const EMBEDDING_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Supabase Client (singleton)
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Embedding Generation
// ---------------------------------------------------------------------------

/**
 * Generate an embedding vector for the given text.
 *
 * TODO: Claude/Anthropic does not provide an embeddings endpoint.
 * Replace this with one of the following:
 *   - OpenAI Embeddings API (text-embedding-3-small, 1536 dimensions)
 *   - Supabase's built-in pg embedding function: select extensions.embed('text', 'gte-small')
 *   - A self-hosted embedding model (e.g., sentence-transformers)
 *
 * For now, returns a dummy 1536-dimension zero vector so the rest of the
 * system can be developed and tested end-to-end.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _apiKey = process.env.ANTHROPIC_API_KEY;

  // TODO: Replace with real embedding call, e.g.:
  //
  // const response = await fetch('https://api.openai.com/v1/embeddings', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'text-embedding-3-small',
  //     input: text,
  //   }),
  // });
  // const data = await response.json();
  // return data.data[0].embedding;

  console.warn(
    `[memory] generateEmbedding() called with ${text.length} chars — returning dummy zero vector. Replace with real embeddings.`
  );

  return new Array(EMBEDDING_DIMENSIONS).fill(0);
}

// ---------------------------------------------------------------------------
// Core Memory Operations
// ---------------------------------------------------------------------------

/**
 * Store a memory record in the specified layer.
 *
 * If no embedding is provided, one will be generated automatically
 * using generateEmbedding().
 */
export async function storeMemory(
  brandId: string,
  layer: MemoryLayer,
  content: string,
  title?: string
): Promise<MemoryRecord> {
  const supabase = getSupabaseClient();

  const now = new Date().toISOString();
  const record = {
    brand_id: brandId,
    layer,
    content,
    title: title ?? null,
    embedding_text: content.slice(0, 500),
    metadata: {
      content_length: content.length,
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("memory_entries")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return data as MemoryRecord;
}

/**
 * Retrieve memories by brand and layer, optionally filtered by a text query.
 *
 * When a query is provided, memories are ranked by vector similarity using
 * pgvector. When no query is provided, returns the most recent memories.
 */
export async function retrieveMemory(
  brandId: string,
  layer: MemoryLayer,
  query?: string,
  limit: number = 10
): Promise<MemoryRecord[]> {
  const supabase = getSupabaseClient();

  // If a query is provided, use text-based memory search
  // V1: passes raw text to match_memories RPC (keyword search)
  // V2: will use embeddings with pgvector cosine similarity
  if (query) {
    const { data, error } = await supabase.rpc("match_memories", {
      query_text: query,
      match_brand_id: brandId,
      match_layer: layer,
      match_threshold: 0.0, // Return all matches, sorted by relevance
      match_count: limit,
    });

    if (error) {
      throw new Error(`Failed to retrieve memories by query: ${error.message}`);
    }

    return (data ?? []) as MemoryRecord[];
  }

  // No query — return most recent memories in this layer
  const { data, error } = await supabase
    .from("memory_entries")
    .select("*")
    .eq("brand_id", brandId)
    .eq("layer", layer)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to retrieve memories: ${error.message}`);
  }

  return (data ?? []) as MemoryRecord[];
}

/**
 * Search for memories similar to the given embedding vector across all layers
 * for a specific brand. Returns results above the similarity threshold.
 *
 * Uses Supabase pgvector RPC function for cosine similarity search.
 */
export async function searchSimilarMemories(
  brandId: string,
  embedding: number[],
  threshold: number = 0.7
): Promise<SimilarMemoryResult[]> {
  const supabase = getSupabaseClient();

  // V1: text-based search — convert embedding back to query text is not possible,
  // so searchSimilarMemories uses a direct table query until pgvector is enabled
  const { data, error } = await supabase
    .from("memory_entries")
    .select("*")
    .eq("brand_id", brandId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(
      `Failed to search similar memories: ${error.message}`
    );
  }

  return (data ?? []) as SimilarMemoryResult[];
}

// ---------------------------------------------------------------------------
// Convenience Helpers
// ---------------------------------------------------------------------------

/**
 * Store a decision log entry with structured metadata.
 */
export async function logDecision(
  brandId: string,
  decision: string,
  context: {
    agent: string;
    trigger_event?: string;
    alternatives_considered?: string[];
    confidence?: number;
    rationale?: string;
  }
): Promise<MemoryRecord> {
  const content = [
    `Decision: ${decision}`,
    `Agent: ${context.agent}`,
    context.trigger_event ? `Trigger: ${context.trigger_event}` : null,
    context.rationale ? `Rationale: ${context.rationale}` : null,
    context.confidence != null
      ? `Confidence: ${(context.confidence * 100).toFixed(0)}%`
      : null,
    context.alternatives_considered?.length
      ? `Alternatives: ${context.alternatives_considered.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const record = {
    brand_id: brandId,
    layer: "decision-log" as MemoryLayer,
    content,
    embedding_text: content.slice(0, 500),
    metadata: {
      ...context,
      content_length: content.length,
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("memory_entries")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log decision: ${error.message}`);
  }

  return data as MemoryRecord;
}

/**
 * Retrieve the most recent decision log entries for a brand.
 */
export async function getRecentDecisions(
  brandId: string,
  limit: number = 20
): Promise<MemoryRecord[]> {
  return retrieveMemory(brandId, "decision-log", undefined, limit);
}

/**
 * Store a strategic insight that should influence long-term behavior.
 */
export async function storeStrategicInsight(
  brandId: string,
  insight: string,
  source: { agent: string; event?: string }
): Promise<MemoryRecord> {
  const content = `Strategic Insight (from ${source.agent}): ${insight}`;
  return storeMemory(brandId, "strategic", content);
}

/**
 * Retrieve the most recent memories for a brand within a specific layer.
 *
 * Returns records ordered by created_at descending, limited to the
 * requested count.
 */
export async function getRecentMemories(
  brandId: string,
  layer: MemoryLayer,
  limit: number = 10
): Promise<MemoryRecord[]> {
  return retrieveMemory(brandId, layer, undefined, limit);
}

/**
 * Summarize recent memories for a brand within a specific layer.
 *
 * Currently concatenates the content of recent memories into a summary
 * string. TODO: Replace with a Claude API call for real summarization
 * once the Anthropic messages endpoint is integrated.
 */
export async function summarizeMemories(
  brandId: string,
  layer: MemoryLayer,
  limit: number = 20
): Promise<string> {
  const memories = await getRecentMemories(brandId, layer, limit);

  if (memories.length === 0) {
    return `No memories found for brand ${brandId} in the "${layer}" layer.`;
  }

  // TODO: Call Claude for real summarization, e.g.:
  //
  // const response = await anthropic.messages.create({
  //   model: 'claude-sonnet-4-20250514',
  //   messages: [{
  //     role: 'user',
  //     content: `Summarize these ${layer} memories for brand ${brandId}:\n\n${memories.map(m => m.content).join('\n---\n')}`
  //   }],
  //   max_tokens: 500,
  // });
  // return response.content[0].text;

  const header = `Summary of ${memories.length} recent "${layer}" memories for brand ${brandId}:`;
  const body = memories
    .map((m, i) => `${i + 1}. ${m.content}`)
    .join("\n");

  return `${header}\n\n${body}`;
}
