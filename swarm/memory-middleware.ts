// ---------------------------------------------------------------------------
// memory-middleware.ts
// Agent memory context injection — loads relevant memories before agent runs
// and stores outcomes after completion.
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemoryEntry {
  id: string;
  brand_id: string;
  layer: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AgentRunResult {
  action: string;
  outcome: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Supabase client singleton
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch memory entries for a given brand and layer, ordered by most recent.
 */
async function fetchMemories(
  brandId: string,
  layer: string,
  limit: number = 10
): Promise<MemoryEntry[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('memory_entries')
    .select('*')
    .eq('brand_id', brandId)
    .eq('layer', layer)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      `[MemoryMiddleware] Failed to fetch "${layer}" memories for brand "${brandId}":`,
      error.message
    );
    return [];
  }

  return (data ?? []) as MemoryEntry[];
}

/**
 * Format a list of memory entries into a readable context block.
 */
function formatMemoryBlock(label: string, entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';

  const lines = entries.map((entry) => {
    const title = entry.title ? `[${entry.title}] ` : '';
    return `  - ${title}${entry.content}`;
  });

  return `=== ${label} ===\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Before agent run — load context
// ---------------------------------------------------------------------------

/**
 * Load relevant memories before an agent run. Returns a compiled context
 * string suitable for injecting into an agent's system prompt.
 *
 * Memory layers loaded:
 *   - brand (5): Core brand identity and config context
 *   - strategic (5): High-level strategic decisions and goals
 *   - episodic (10): Recent operational events and outcomes
 */
export async function beforeAgentRun(
  agentName: string,
  brandId: string
): Promise<string> {
  const [brandMemories, strategicMemories, episodicMemories] =
    await Promise.all([
      fetchMemories(brandId, 'brand', 5),
      fetchMemories(brandId, 'strategic', 5),
      fetchMemories(brandId, 'episodic', 10),
    ]);

  const blocks: string[] = [];

  const brandBlock = formatMemoryBlock('Brand Context', brandMemories);
  if (brandBlock) blocks.push(brandBlock);

  const strategicBlock = formatMemoryBlock(
    'Strategic Context',
    strategicMemories
  );
  if (strategicBlock) blocks.push(strategicBlock);

  const episodicBlock = formatMemoryBlock(
    'Recent Activity',
    episodicMemories
  );
  if (episodicBlock) blocks.push(episodicBlock);

  if (blocks.length === 0) {
    return `[No prior context available for agent "${agentName}" in brand "${brandId}"]`;
  }

  return `--- Agent Memory Context for ${agentName} ---\n${blocks.join('\n\n')}`;
}

// ---------------------------------------------------------------------------
// After agent run — store outcome
// ---------------------------------------------------------------------------

/**
 * Store the outcome of an agent run as an episodic memory entry.
 */
export async function afterAgentRun(
  agentName: string,
  brandId: string,
  result: AgentRunResult
): Promise<void> {
  const supabase = getClient();

  const content = `Agent "${agentName}" performed "${result.action}" with outcome: ${result.outcome}`;
  const metadata: Record<string, unknown> = {
    agent_name: agentName,
    action: result.action,
    outcome: result.outcome,
    ...(result.data ?? {}),
  };

  const { error } = await supabase.from('memory_entries').insert({
    id: randomUUID(),
    brand_id: brandId,
    layer: 'episodic',
    title: `${agentName}: ${result.action}`,
    content,
    metadata,
    status: 'active',
  });

  if (error) {
    console.error(
      `[MemoryMiddleware] Failed to store episodic memory for agent "${agentName}":`,
      error.message
    );
  }
}

// ---------------------------------------------------------------------------
// Full agent context — combines all memory layers + decision log
// ---------------------------------------------------------------------------

/**
 * Build a comprehensive context string for an agent's system prompt.
 * Includes brand memories, strategic memories, recent episodic memories,
 * and the decision log.
 */
export async function getAgentContext(
  agentName: string,
  brandId: string
): Promise<string> {
  const [brandMemories, strategicMemories, episodicMemories, decisionLog] =
    await Promise.all([
      fetchMemories(brandId, 'brand', 5),
      fetchMemories(brandId, 'strategic', 5),
      fetchMemories(brandId, 'episodic', 15),
      fetchMemories(brandId, 'decision-log', 10),
    ]);

  const blocks: string[] = [];

  // Header
  blocks.push(
    `--- Agent Context: ${agentName} | Brand: ${brandId} ---`
  );

  // Brand context
  const brandBlock = formatMemoryBlock('Brand Identity & Config', brandMemories);
  if (brandBlock) blocks.push(brandBlock);

  // Strategic context
  const strategicBlock = formatMemoryBlock(
    'Strategic Decisions & Goals',
    strategicMemories
  );
  if (strategicBlock) blocks.push(strategicBlock);

  // Episodic context — filter to this agent's recent activity where possible
  const agentEpisodic = episodicMemories.filter(
    (m) =>
      (m.metadata as Record<string, unknown>)?.agent_name === agentName
  );
  const otherEpisodic = episodicMemories.filter(
    (m) =>
      (m.metadata as Record<string, unknown>)?.agent_name !== agentName
  );

  if (agentEpisodic.length > 0) {
    blocks.push(
      formatMemoryBlock('Your Recent Actions', agentEpisodic)
    );
  }
  if (otherEpisodic.length > 0) {
    blocks.push(
      formatMemoryBlock('Other Agent Activity', otherEpisodic.slice(0, 5))
    );
  }

  // Decision log
  const decisionBlock = formatMemoryBlock('Decision Log', decisionLog);
  if (decisionBlock) blocks.push(decisionBlock);

  if (blocks.length <= 1) {
    return `[No context available for agent "${agentName}" in brand "${brandId}"]`;
  }

  return blocks.join('\n\n');
}
