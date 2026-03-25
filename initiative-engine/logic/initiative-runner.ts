/**
 * initiative-engine/logic/initiative-runner.ts
 *
 * Executes an initiative by dispatching to agents. Manages lifecycle
 * transitions (draft -> approved -> in_progress -> complete | failed)
 * and emits events to the agent_events table.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL environment variable');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InitiativeStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'complete'
  | 'failed';

export interface Initiative {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  type: string;
  status: InitiativeStatus;
  priority: number;
  recommended_agents: string[];
  auto_approve: boolean;
  budget?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InitiativeRun {
  id: string;
  initiative_id: string;
  agent: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * Load an initiative record from Supabase by ID.
 */
export async function loadInitiative(
  initiativeId: string
): Promise<Initiative> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('initiatives')
    .select('*')
    .eq('id', initiativeId)
    .single();

  if (error) {
    throw new Error(`Failed to load initiative ${initiativeId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Initiative ${initiativeId} not found.`);
  }

  return data as Initiative;
}

/**
 * Update the status of an initiative.
 */
export async function updateStatus(
  initiativeId: string,
  status: InitiativeStatus
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('initiatives')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', initiativeId);

  if (error) {
    throw new Error(
      `Failed to update initiative ${initiativeId} status to ${status}: ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

/**
 * Emit an event to the agent_events table for observability and
 * downstream processing.
 */
async function emitEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('agent_events').insert({
    event_type: eventType,
    payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[initiative-runner] Failed to emit event ${eventType}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Run record management
// ---------------------------------------------------------------------------

/**
 * Create an initiative_run record for a single agent step.
 */
async function createRunRecord(
  initiativeId: string,
  agent: string
): Promise<InitiativeRun> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('initiative_runs')
    .insert({
      initiative_id: initiativeId,
      agent,
      status: 'pending',
      started_at: null,
      completed_at: null,
      result: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to create run record for agent ${agent}: ${error.message}`
    );
  }

  return data as InitiativeRun;
}

/**
 * Update a run record status and result.
 */
async function updateRunRecord(
  runId: string,
  status: 'running' | 'complete' | 'failed',
  result?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const update: Record<string, unknown> = { status };

  if (status === 'running') {
    update.started_at = new Date().toISOString();
  }

  if (status === 'complete' || status === 'failed') {
    update.completed_at = new Date().toISOString();
    if (result) {
      update.result = result;
    }
  }

  const { error } = await supabase
    .from('initiative_runs')
    .update(update)
    .eq('id', runId);

  if (error) {
    console.error(`[initiative-runner] Failed to update run ${runId}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Agent dispatch (placeholder)
// ---------------------------------------------------------------------------

/**
 * Dispatch work to an agent.
 *
 * TODO: Replace with real agent invocation — e.g., calling the swarm
 * orchestrator, sending a message to a queue, or invoking a serverless
 * function per agent.
 */
async function dispatchToAgent(
  agent: string,
  initiative: Initiative
): Promise<Record<string, unknown>> {
  console.log(
    `[initiative-runner] Dispatching to ${agent} for initiative "${initiative.title}" (${initiative.id})`
  );

  // Placeholder: simulate agent work
  // In production, this would call the agent's endpoint or queue a task.
  return {
    agent,
    initiative_id: initiative.id,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
    message: `Agent ${agent} received initiative "${initiative.title}".`,
  };
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

/**
 * Run an initiative end-to-end:
 * 1. Load the initiative from Supabase
 * 2. Transition status to in_progress
 * 3. Create run records for each recommended agent
 * 4. Dispatch to each agent sequentially
 * 5. Emit lifecycle events
 * 6. Transition to complete or failed
 */
export async function runInitiative(
  initiativeId: string
): Promise<{ success: boolean; runs: InitiativeRun[] }> {
  let initiative: Initiative;

  try {
    initiative = await loadInitiative(initiativeId);
  } catch (err) {
    throw new Error(
      `Cannot run initiative: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Validate current status allows execution
  if (initiative.status !== 'approved' && initiative.status !== 'draft') {
    throw new Error(
      `Initiative ${initiativeId} is in status "${initiative.status}" — ` +
      `must be "approved" or "draft" to run.`
    );
  }

  // Transition to in_progress
  await updateStatus(initiativeId, 'in_progress');

  // Emit started event
  await emitEvent('initiative.started', {
    initiative_id: initiativeId,
    brand_id: initiative.brand_id,
    type: initiative.type,
    title: initiative.title,
    agents: initiative.recommended_agents,
  });

  const runs: InitiativeRun[] = [];
  let allSucceeded = true;

  // Execute each agent step
  for (const agent of initiative.recommended_agents) {
    const run = await createRunRecord(initiativeId, agent);
    runs.push(run);

    try {
      await updateRunRecord(run.id, 'running');

      const result = await dispatchToAgent(agent, initiative);

      await updateRunRecord(run.id, 'complete', result);
      run.status = 'complete';
      run.result = result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await updateRunRecord(run.id, 'failed', { error: errorMessage });
      run.status = 'failed';
      run.result = { error: errorMessage };
      allSucceeded = false;

      console.error(
        `[initiative-runner] Agent ${agent} failed for initiative ${initiativeId}:`,
        errorMessage
      );
    }
  }

  // Transition to final status
  const finalStatus: InitiativeStatus = allSucceeded ? 'complete' : 'failed';
  await updateStatus(initiativeId, finalStatus);

  // Emit completed or failed event
  const eventType = allSucceeded
    ? 'initiative.completed'
    : 'initiative.failed';

  await emitEvent(eventType, {
    initiative_id: initiativeId,
    brand_id: initiative.brand_id,
    type: initiative.type,
    title: initiative.title,
    final_status: finalStatus,
    agent_results: runs.map((r) => ({
      agent: r.agent,
      status: r.status,
    })),
  });

  return { success: allSucceeded, runs };
}

export default runInitiative;
