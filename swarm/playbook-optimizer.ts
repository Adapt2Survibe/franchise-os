// ---------------------------------------------------------------------------
// playbook-optimizer.ts
// Self-improving playbook loop — scores playbook performance against
// initiative outcomes and rewrites underperformers.
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Playbook {
  id: string;
  brand_id: string;
  name: string;
  type: string;
  version: number;
  content: Record<string, unknown>;
  performance_score: number | null;
  last_rewritten_at: string | null;
  created_at: string;
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
// Load playbooks
// ---------------------------------------------------------------------------

/**
 * Fetch all playbooks for a brand, ordered by type then version descending.
 */
export async function loadPlaybooks(brandId: string): Promise<Playbook[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('playbooks')
    .select('*')
    .eq('brand_id', brandId)
    .order('type', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load playbooks for brand "${brandId}": ${error.message} (code ${error.code})`
    );
  }

  return (data ?? []) as Playbook[];
}

// ---------------------------------------------------------------------------
// Score playbook
// ---------------------------------------------------------------------------

/**
 * Calculate a performance score (0-100) for a playbook based on the outcomes
 * of initiatives that reference it. Returns the computed score.
 *
 * Scoring logic:
 *   - Each linked initiative with outcome = 'win' scores 100
 *   - outcome = 'mixed' scores 50
 *   - outcome = 'loss' scores 0
 *   - Final score = average across all linked initiatives
 *   - If no initiatives are linked, returns null (insufficient data)
 */
export async function scorePlaybook(
  playbookId: string
): Promise<number | null> {
  const supabase = getClient();

  // Fetch initiatives whose data->playbook_id matches this playbook
  const { data: initiatives, error } = await supabase
    .from('initiatives')
    .select('id, outcome')
    .or(`data->>playbook_id.eq.${playbookId}`)
    .not('outcome', 'is', null);

  if (error) {
    throw new Error(
      `Failed to score playbook "${playbookId}": ${error.message} (code ${error.code})`
    );
  }

  if (!initiatives || initiatives.length === 0) {
    return null; // Not enough data to score
  }

  const outcomeScores: Record<string, number> = {
    win: 100,
    mixed: 50,
    loss: 0,
  };

  let total = 0;
  let count = 0;

  for (const init of initiatives) {
    const score = outcomeScores[init.outcome ?? ''];
    if (score !== undefined) {
      total += score;
      count += 1;
    }
  }

  if (count === 0) return null;

  const finalScore = Math.round(total / count);

  // Persist the score back to the playbook row
  const { error: updateError } = await supabase
    .from('playbooks')
    .update({ performance_score: finalScore })
    .eq('id', playbookId);

  if (updateError) {
    console.error(
      `[PlaybookOptimizer] Failed to persist score for playbook "${playbookId}":`,
      updateError.message
    );
  }

  return finalScore;
}

// ---------------------------------------------------------------------------
// Rewrite playbook (stub)
// ---------------------------------------------------------------------------

/**
 * Rewrite a playbook's content using AI.
 *
 * TODO: Integrate Claude API to generate improved playbook content based on
 * performance data, initiative outcomes, and brand context. For now this is a
 * stub that returns the existing content unchanged.
 */
export async function rewritePlaybook(
  playbookId: string
): Promise<Record<string, unknown>> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('playbooks')
    .select('content')
    .eq('id', playbookId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load playbook "${playbookId}" for rewrite: ${error.message} (code ${error.code})`
    );
  }

  // TODO: Call Claude API to rewrite playbook content
  // - Pass current content, performance score, and recent initiative outcomes
  // - Use brand voice_tone for style consistency
  // - Return the AI-generated improved content
  console.log(
    `[PlaybookOptimizer] TODO: call Claude to rewrite playbook "${playbookId}". Returning existing content.`
  );

  return (data?.content as Record<string, unknown>) ?? {};
}

// ---------------------------------------------------------------------------
// Save new playbook version
// ---------------------------------------------------------------------------

/**
 * Save a new version of a playbook. Increments the version number and
 * inserts a new row (preserving history). Updates `last_rewritten_at`.
 */
export async function savePlaybookVersion(
  playbookId: string,
  newContent: Record<string, unknown>
): Promise<Playbook> {
  const supabase = getClient();

  // Fetch current playbook to get version + metadata
  const { data: current, error: fetchError } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', playbookId)
    .single();

  if (fetchError || !current) {
    throw new Error(
      `Failed to fetch playbook "${playbookId}" for versioning: ${fetchError?.message ?? 'not found'}`
    );
  }

  const nextVersion = (current.version ?? 1) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from('playbooks')
    .insert({
      brand_id: current.brand_id,
      name: current.name,
      type: current.type,
      version: nextVersion,
      content: newContent,
      performance_score: null,
      last_rewritten_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(
      `Failed to save new version for playbook "${playbookId}": ${insertError.message} (code ${insertError.code})`
    );
  }

  return inserted as Playbook;
}

// ---------------------------------------------------------------------------
// Main optimization loop
// ---------------------------------------------------------------------------

/**
 * Run the full optimization cycle for a brand:
 * 1. Load all playbooks
 * 2. Score each one against initiative outcomes
 * 3. Rewrite underperformers (score < 50)
 * 4. Save new versions of rewritten playbooks
 *
 * Returns a summary of actions taken.
 */
export async function optimizePlaybooks(
  brandId: string
): Promise<{
  total: number;
  scored: number;
  rewritten: number;
  skipped: number;
  details: Array<{ name: string; score: number | null; action: string }>;
}> {
  const playbooks = await loadPlaybooks(brandId);

  const summary = {
    total: playbooks.length,
    scored: 0,
    rewritten: 0,
    skipped: 0,
    details: [] as Array<{ name: string; score: number | null; action: string }>,
  };

  if (playbooks.length === 0) {
    console.log(
      `[PlaybookOptimizer] No playbooks found for brand "${brandId}". Nothing to optimize.`
    );
    return summary;
  }

  // De-duplicate: only process the latest version of each playbook type
  const latestByType = new Map<string, Playbook>();
  for (const pb of playbooks) {
    const existing = latestByType.get(pb.type);
    if (!existing || pb.version > existing.version) {
      latestByType.set(pb.type, pb);
    }
  }

  for (const pb of latestByType.values()) {
    const score = await scorePlaybook(pb.id);
    summary.scored += 1;

    if (score === null) {
      summary.skipped += 1;
      summary.details.push({
        name: pb.name,
        score: null,
        action: 'skipped — insufficient data',
      });
      continue;
    }

    if (score < 50) {
      const newContent = await rewritePlaybook(pb.id);
      await savePlaybookVersion(pb.id, newContent);
      summary.rewritten += 1;
      summary.details.push({
        name: pb.name,
        score,
        action: `rewritten — score ${score} below threshold`,
      });
    } else {
      summary.details.push({
        name: pb.name,
        score,
        action: `kept — score ${score} meets threshold`,
      });
    }
  }

  console.log(
    `[PlaybookOptimizer] Optimization complete for brand "${brandId}":`,
    JSON.stringify(summary, null, 2)
  );

  return summary;
}
