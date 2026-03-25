// ---------------------------------------------------------------------------
// agent-executor.ts
// Generic agent execution engine — loads agent persona, injects memory context,
// calls Claude, parses structured output, emits downstream events, stores memory.
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { beforeAgentRun, afterAgentRun } from './memory-middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DispatchRule {
  rule_id: string;
  trigger_event: string;
  target_agent: string;
  model_tier: 'strategic' | 'operational' | 'worker';
  priority: string;
  cooldown_seconds: number;
  preconditions: string[];
}

export interface AgentEvent {
  id: string;
  brand_id: string;
  agent_name: string;
  event_type: string;
  correlation_id?: string;
  chain_depth?: number;
  payload: Record<string, unknown>;
  status: string;
  model_tier?: string;
  model_used?: string;
  duration_ms?: number;
  result?: Record<string, unknown>;
  created_at?: string;
}

export interface ExecutionResult {
  agentName: string;
  model: string;
  response: string;
  durationMs: number;
  emittedEvents: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Model mapping
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  strategic: process.env.MODEL_STRATEGIC ?? 'claude-sonnet-4-6',
  operational: process.env.MODEL_OPERATIONAL ?? 'claude-sonnet-4-6',
  worker: process.env.MODEL_WORKER ?? 'claude-haiku-4-5-20251001',
};

// ---------------------------------------------------------------------------
// Agent persona loader
// ---------------------------------------------------------------------------

const AGENTS_DIR = path.resolve(__dirname, 'agents');

function loadAgentPersona(agentSlug: string): string {
  const agentPath = path.join(AGENTS_DIR, `${agentSlug}.md`);
  if (!fs.existsSync(agentPath)) {
    throw new Error(`Agent persona not found: ${agentSlug} (looked at ${agentPath})`);
  }
  return fs.readFileSync(agentPath, 'utf-8');
}

/**
 * Convert dispatch rule target_agent (e.g. "CEO_AGENT") to file slug (e.g. "ceo").
 */
export function targetAgentToSlug(targetAgent: string): string {
  return targetAgent
    .replace(/_AGENT$/i, '')
    .replace(/_/g, '-')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Downstream event mapping
// ---------------------------------------------------------------------------

/**
 * Maps agent slugs to the events they emit after execution.
 * These trigger downstream agents via dispatch rules.
 */
const AGENT_OUTPUT_EVENTS: Record<string, string> = {
  'ceo': 'opportunity_evaluated',
  'market-opportunity': 'market.opportunity.detected',
  'territory-intelligence': 'territory.scored',
  'lead-intelligence': 'lead.scored',
  'sales-pipeline': 'discovery.call.completed',
  'campaign': 'campaign.approved',
  'content-strategy': 'content.strategy.created',
  'landing-page': 'landing_page.generated',
  'email': 'email_campaign.generated',
  'social-content': 'social_content.generated',
  'initiative': 'initiative.created',
  'onboarding': 'onboarding.started',
  'coaching': 'coaching.session.completed',
  'pattern-detection': 'pattern.detected',
  'learning': 'learning.captured',
  'memory-curator': 'memory.curated',
  'report': 'report.generated',
  'cro': 'revenue.strategy.updated',
  'cmo': 'marketing.strategy.updated',
  'coo': 'operations.directive.issued',
};

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabase;
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

let _anthropic: any = null;

async function getAnthropic(): Promise<any> {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

async function callClaude(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
): Promise<{ text: string; durationMs: number }> {
  const anthropic = await getAnthropic();
  const start = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  return { text, durationMs: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Emit downstream event
// ---------------------------------------------------------------------------

async function emitDownstreamEvent(
  agentSlug: string,
  brandId: string,
  correlationId: string,
  chainDepth: number,
  agentResponse: string,
  triggerEventType: string,
): Promise<string | null> {
  const outputEventType = AGENT_OUTPUT_EVENTS[agentSlug];
  if (!outputEventType) {
    console.log(`[executor] No output event mapped for agent "${agentSlug}" — chain ends here`);
    return null;
  }

  // Don't exceed max chain depth
  if (chainDepth >= 10) {
    console.warn(`[executor] Max chain depth (10) reached — not emitting downstream event`);
    return null;
  }

  const supabase = getSupabase();
  const eventId = randomUUID();

  const { error } = await supabase.from('agent_events').insert({
    id: eventId,
    brand_id: brandId,
    agent_name: agentSlug,
    event_type: outputEventType,
    correlation_id: correlationId,
    chain_depth: chainDepth + 1,
    payload: {
      source_agent: agentSlug,
      source_event: triggerEventType,
      agent_output: agentResponse.slice(0, 5000),
    },
    status: 'pending',
  });

  if (error) {
    console.error(`[executor] Failed to emit downstream event "${outputEventType}":`, error.message);
    return null;
  }

  console.log(`[executor] Emitted downstream event: ${outputEventType} (id=${eventId}, chain_depth=${chainDepth + 1})`);
  return eventId;
}

// ---------------------------------------------------------------------------
// Main execution function
// ---------------------------------------------------------------------------

/**
 * Execute an agent against a triggered event.
 *
 * Full pipeline:
 * 1. Load agent persona from swarm/agents/{slug}.md
 * 2. Load memory context via memory-middleware
 * 3. Compose system prompt (persona + memory)
 * 4. Call Claude with the event payload as user message
 * 5. Store execution result in agent_events
 * 6. Store episodic memory via afterAgentRun
 * 7. Emit downstream event for agent chaining
 */
export async function executeAgent(
  event: AgentEvent,
  rule: DispatchRule,
): Promise<ExecutionResult> {
  const agentSlug = targetAgentToSlug(rule.target_agent);
  const model = MODEL_MAP[rule.model_tier] ?? MODEL_MAP.operational;
  const correlationId = event.correlation_id ?? event.id;
  const chainDepth = event.chain_depth ?? 0;

  console.log(`[executor] ▶ Executing ${agentSlug} (model=${model}, tier=${rule.model_tier}, chain_depth=${chainDepth})`);

  const emittedEvents: string[] = [];

  try {
    // 1. Load agent persona
    const persona = loadAgentPersona(agentSlug);

    // 2. Load memory context
    let memoryContext: string;
    try {
      memoryContext = await beforeAgentRun(agentSlug, event.brand_id);
    } catch (err: any) {
      console.warn(`[executor] Memory context load failed (continuing without): ${err.message}`);
      memoryContext = `[Memory unavailable for agent "${agentSlug}"]`;
    }

    // 3. Compose system prompt
    const systemPrompt = [
      persona,
      '',
      '--- MEMORY CONTEXT ---',
      memoryContext,
      '',
      '--- INSTRUCTIONS ---',
      'You are being invoked by the FranchiseOS swarm in response to a real event.',
      'Analyze the event data below and provide your response.',
      'Be specific, actionable, and grounded in the data provided.',
      `Your response will be recorded and may trigger downstream agents.`,
      '',
      'If your analysis leads to a recommendation that requires action by another agent,',
      'clearly state what action is needed and why.',
    ].join('\n');

    // 4. Compose user message from event payload
    const userMessage = [
      `EVENT TYPE: ${event.event_type}`,
      `EVENT ID: ${event.id}`,
      `BRAND ID: ${event.brand_id}`,
      `CORRELATION ID: ${correlationId}`,
      `CHAIN DEPTH: ${chainDepth}`,
      '',
      'EVENT PAYLOAD:',
      JSON.stringify(event.payload, null, 2),
    ].join('\n');

    // 5. Call Claude
    const { text, durationMs } = await callClaude(model, systemPrompt, userMessage);

    console.log(`[executor] ✓ ${agentSlug} responded in ${durationMs}ms (${text.length} chars)`);

    // 6. Update event with result
    const supabase = getSupabase();
    await supabase
      .from('agent_events')
      .update({
        status: 'completed',
        result: { response: text.slice(0, 10000) },
        model_tier: rule.model_tier,
        model_used: model,
        duration_ms: durationMs,
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    // 7. Store episodic memory
    try {
      await afterAgentRun(agentSlug, event.brand_id, {
        action: event.event_type,
        outcome: text.slice(0, 1000),
        data: {
          correlation_id: correlationId,
          chain_depth: chainDepth,
          model_used: model,
          duration_ms: durationMs,
          trigger_event: event.event_type,
        },
      });
    } catch (err: any) {
      console.warn(`[executor] Memory storage failed (non-fatal): ${err.message}`);
    }

    // 8. Emit downstream event for agent chaining
    const downstreamId = await emitDownstreamEvent(
      agentSlug,
      event.brand_id,
      correlationId,
      chainDepth,
      text,
      event.event_type,
    );
    if (downstreamId) {
      emittedEvents.push(downstreamId);
    }

    return {
      agentName: agentSlug,
      model,
      response: text,
      durationMs,
      emittedEvents,
    };
  } catch (err: any) {
    const errorMsg = err.message ?? String(err);
    console.error(`[executor] ✗ ${agentSlug} failed: ${errorMsg}`);

    // Mark event as errored
    try {
      const supabase = getSupabase();
      await supabase
        .from('agent_events')
        .update({
          status: 'error',
          error: errorMsg.slice(0, 2000),
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id);
    } catch {
      // Best-effort error recording
    }

    return {
      agentName: agentSlug,
      model,
      response: '',
      durationMs: 0,
      emittedEvents,
      error: errorMsg,
    };
  }
}
