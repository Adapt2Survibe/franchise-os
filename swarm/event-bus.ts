// ---------------------------------------------------------------------------
// event-bus.ts
// Publish / subscribe event bus built on Supabase Realtime + agent_events table.
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentEvent {
  id?: string;
  event_type: string;
  brand_id: string;
  agent_name: string;
  correlation_id?: string;
  chain_depth?: number;
  payload: Record<string, unknown>;
  status?: string;
  model_tier?: string;
  created_at?: string;
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
// Publish
// ---------------------------------------------------------------------------

/**
 * Publish an event by inserting it into the `agent_events` table.
 * Returns the persisted event (with server-generated id and created_at).
 */
export async function publish(event: AgentEvent): Promise<AgentEvent> {
  const supabase = getClient();

  const row = {
    id: event.id ?? randomUUID(),
    event_type: event.event_type,
    brand_id: event.brand_id,
    agent_name: event.agent_name,
    correlation_id: event.correlation_id ?? null,
    chain_depth: event.chain_depth ?? 0,
    payload: event.payload,
    status: event.status ?? 'pending',
    model_tier: event.model_tier ?? null,
  };

  const { data, error } = await supabase
    .from('agent_events')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(
      `EventBus.publish failed for event_type "${event.event_type}": ${error.message} (code ${error.code})`
    );
  }

  return data as AgentEvent;
}

// ---------------------------------------------------------------------------
// Subscribe — filtered by event_type
// ---------------------------------------------------------------------------

/**
 * Subscribe to events of a specific type via Supabase Realtime.
 * Returns the RealtimeChannel so the caller can unsubscribe later.
 */
export function subscribe(
  eventType: string,
  handler: (event: AgentEvent) => void
): RealtimeChannel {
  const supabase = getClient();

  const channel = supabase
    .channel(`agent_events:event_type=${eventType}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_events',
        filter: `event_type=eq.${eventType}`,
      },
      (payload) => {
        try {
          handler(payload.new as AgentEvent);
        } catch (err) {
          console.error(
            `[EventBus] Handler error for event_type "${eventType}":`,
            err
          );
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(
          `[EventBus] Channel error for event_type "${eventType}".`
        );
      }
    });

  return channel;
}

// ---------------------------------------------------------------------------
// Subscribe all — filtered by brand_id
// ---------------------------------------------------------------------------

/**
 * Listen to every event for a given brand via Supabase Realtime.
 * Returns the RealtimeChannel for cleanup.
 */
export function subscribeAll(
  brandId: string,
  handler: (event: AgentEvent) => void
): RealtimeChannel {
  const supabase = getClient();

  const channel = supabase
    .channel(`agent_events:brand_id=${brandId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_events',
        filter: `brand_id=eq.${brandId}`,
      },
      (payload) => {
        try {
          handler(payload.new as AgentEvent);
        } catch (err) {
          console.error(
            `[EventBus] Handler error for brand "${brandId}":`,
            err
          );
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(
          `[EventBus] Channel error for brand "${brandId}".`
        );
      }
    });

  return channel;
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

/**
 * Cleanly remove a Realtime channel subscription.
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
  const supabase = getClient();

  try {
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error('[EventBus] Error removing channel:', err);
  }
}
