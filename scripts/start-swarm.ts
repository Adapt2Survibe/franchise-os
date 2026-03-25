/**
 * start-swarm.ts — Swarm Startup Script
 *
 * Boots the FranchiseOS agent swarm for a specific brand.
 * Polls the agent_events table for pending events and dispatches
 * them to the appropriate agent based on dispatch-rules.json.
 *
 * Usage:
 *   npx tsx scripts/start-swarm.ts --brand=kumon
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { executeAgent, targetAgentToSlug } from "../swarm/agent-executor";
import type { DispatchRule as ExecutorDispatchRule } from "../swarm/agent-executor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentDefinition {
  fileName: string;
  name: string;
  tier: string;
  model: string;
}

interface DispatchRule {
  rule_id: string;
  trigger_event: string;
  target_agent: string;
  model_tier: string;
  priority: string;
  cooldown_seconds: number;
  preconditions: string[];
}

interface DispatchRulesFile {
  version: string;
  max_chain_depth: number;
  max_concurrent_agents: number;
  default_cooldown_seconds: number;
  rules: DispatchRule[];
}

interface AgentEvent {
  id: string;
  brand_id: string;
  agent_name: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLLING_INTERVAL_MS = 5_000;

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

const SWARM_DIR = path.resolve(__dirname, "..", "swarm");
const AGENTS_DIR = path.join(SWARM_DIR, "agents");
const DISPATCH_RULES_PATH = path.join(SWARM_DIR, "dispatch-rules.json");

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseBrandArg(): string {
  const brandArg = process.argv.find((a) => a.startsWith("--brand="));
  if (!brandArg) {
    console.error("Usage: npx tsx scripts/start-swarm.ts --brand=SLUG");
    process.exit(1);
  }
  return brandArg.split("=")[1];
}

// ---------------------------------------------------------------------------
// YAML Frontmatter Parser (regex-based, no external library)
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) {
      frontmatter[kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  return frontmatter;
}

// ---------------------------------------------------------------------------
// Load Agent Definitions
// ---------------------------------------------------------------------------

function loadAgentDefinitions(): AgentDefinition[] {
  if (!fs.existsSync(AGENTS_DIR)) {
    console.error(`Agent definitions directory not found: ${AGENTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  const agents: AgentDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(AGENTS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(content);

    agents.push({
      fileName: file,
      name: fm.name ?? path.basename(file, ".md"),
      tier: fm.tier ?? "unknown",
      model: fm.model ?? "unknown",
    });
  }

  console.log(`[swarm] Loaded ${agents.length} agent definitions from ${AGENTS_DIR}`);
  return agents;
}

// ---------------------------------------------------------------------------
// Load Dispatch Rules
// ---------------------------------------------------------------------------

function loadDispatchRules(): DispatchRulesFile {
  if (!fs.existsSync(DISPATCH_RULES_PATH)) {
    console.error(`Dispatch rules not found: ${DISPATCH_RULES_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DISPATCH_RULES_PATH, "utf-8");
  const rules: DispatchRulesFile = JSON.parse(raw);
  console.log(
    `[swarm] Loaded ${rules.rules.length} dispatch rules (v${rules.version})`
  );
  return rules;
}

// ---------------------------------------------------------------------------
// Event Processing
// ---------------------------------------------------------------------------

async function processEvent(
  supabase: SupabaseClient,
  event: AgentEvent,
  dispatchRules: DispatchRulesFile,
  agents: AgentDefinition[]
): Promise<void> {
  // Find all matching dispatch rules for this trigger event
  const matchingRules = dispatchRules.rules.filter(
    (r) => r.trigger_event === event.event_type
  );

  if (matchingRules.length === 0) {
    console.warn(
      `[swarm] No dispatch rules matched for event: ${event.event_type} (event_id=${event.id})`
    );
    // Mark as completed even if no rules match — avoid reprocessing
    await supabase
      .from("agent_events")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", event.id);
    return;
  }

  // Mark event as processing
  const { error: updateError } = await supabase
    .from("agent_events")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", event.id);

  if (updateError) {
    console.error(
      `[swarm] Failed to mark event ${event.id} as processing:`,
      updateError.message
    );
    return;
  }

  // Dispatch to each matching rule/agent
  for (const rule of matchingRules) {
    const agentSlug = targetAgentToSlug(rule.target_agent);
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] Dispatching ${event.event_type} → ${agentSlug} (${rule.model_tier})`
    );

    try {
      const result = await executeAgent(
        {
          id: event.id,
          brand_id: event.brand_id,
          agent_name: agentSlug,
          event_type: event.event_type,
          correlation_id: (event as any).correlation_id ?? event.id,
          chain_depth: (event as any).chain_depth ?? 0,
          payload: event.payload,
          status: event.status,
        },
        rule as ExecutorDispatchRule,
      );

      if (result.error) {
        console.error(`[swarm] Agent ${agentSlug} returned error: ${result.error}`);
      } else {
        console.log(
          `[swarm] Agent ${agentSlug} completed in ${result.durationMs}ms` +
          (result.emittedEvents.length > 0
            ? ` — emitted ${result.emittedEvents.length} downstream event(s)`
            : '')
        );
      }
    } catch (err: any) {
      console.error(`[swarm] Fatal error executing ${agentSlug}: ${err.message}`);
      // Mark event as error and continue with next rule
      await supabase
        .from("agent_events")
        .update({ status: "error", error: err.message })
        .eq("id", event.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Polling Loop
// ---------------------------------------------------------------------------

async function pollForEvents(
  supabase: SupabaseClient,
  brandId: string,
  dispatchRules: DispatchRulesFile,
  agents: AgentDefinition[]
): Promise<void> {
  const { data: events, error } = await supabase
    .from("agent_events")
    .select("*")
    .eq("status", "pending")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[swarm] Error polling agent_events:", error.message);
    return;
  }

  if (!events || events.length === 0) {
    return;
  }

  console.log(`[swarm] Found ${events.length} pending event(s) for brand_id="${brandId}"`);

  for (const event of events as AgentEvent[]) {
    await processEvent(supabase, event, dispatchRules, agents);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const brand = parseBrandArg();

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  FranchiseOS Swarm Controller`);
  console.log(`  Brand: ${brand}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log("═══════════════════════════════════════════════════════════");

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[swarm] SUPABASE_SERVICE_ROLE_KEY is not set. Set it in your environment."
    );
    process.exit(1);
  }

  // Load configuration
  const agents = loadAgentDefinitions();
  const dispatchRules = loadDispatchRules();

  // Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve brand slug to brand_id (UUID)
  const { data: brandRow, error: brandError } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brand)
    .single();

  if (brandError || !brandRow) {
    console.error(`[swarm] Brand "${brand}" not found in database. Run bootstrap-brand.ts first.`);
    process.exit(1);
  }

  const brandId = brandRow.id as string;
  console.log(`[swarm] Resolved brand "${brand}" → ${brandId}`);

  console.log(
    `[swarm] Connected. Polling agent_events every ${POLLING_INTERVAL_MS / 1000}s for brand="${brand}"…`
  );

  // Graceful shutdown
  let running = true;

  const shutdown = (signal: string) => {
    console.log(`\n[swarm] Received ${signal}. Shutting down gracefully…`);
    running = false;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Polling loop
  while (running) {
    try {
      await pollForEvents(supabase, brandId, dispatchRules, agents);
    } catch (err) {
      console.error("[swarm] Unexpected error during poll cycle:", err);
    }

    // Wait for the next polling interval, but break early if shutting down
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, POLLING_INTERVAL_MS);
      if (!running) {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  console.log("[swarm] Swarm controller stopped.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[swarm] Fatal error:", err);
  process.exit(1);
});
