import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

/**
 * The ordered list of onboarding steps every franchisee must complete.
 */
export const ONBOARDING_STEPS = [
  "territory_assignment",
  "document_signing",
  "training_schedule",
  "system_access",
  "launch_checklist",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

export interface StepRecord {
  step: OnboardingStep;
  status: StepStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface OnboardingStatus {
  franchisee_id: string;
  brand_id: string;
  current_step: OnboardingStep | "completed";
  steps: StepRecord[];
  started_at: string;
  completed_at: string | null;
  percent_complete: number;
}

export interface AgentEvent {
  id?: string;
  franchisee_id: string;
  brand_id: string;
  event_type: string;
  step: OnboardingStep;
  payload: Record<string, unknown>;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY in your environment."
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Event emitter helper
// ---------------------------------------------------------------------------

async function emitEvent(
  supabase: SupabaseClient,
  event: Omit<AgentEvent, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase.from("agent_events").insert({
    franchisee_id: event.franchisee_id,
    brand_id: event.brand_id,
    event_type: event.event_type,
    step: event.step,
    payload: event.payload,
  });

  if (error) {
    throw new Error(`Failed to emit agent event "${event.event_type}": ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialSteps(): StepRecord[] {
  return ONBOARDING_STEPS.map((step) => ({
    step,
    status: "pending" as StepStatus,
    started_at: null,
    completed_at: null,
  }));
}

function computePercent(steps: StepRecord[]): number {
  const completed = steps.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;
  return Math.round((completed / steps.length) * 100);
}

function determineCurrentStep(steps: StepRecord[]): OnboardingStep | "completed" {
  for (const s of steps) {
    if (s.status !== "completed" && s.status !== "skipped") {
      return s.step;
    }
  }
  return "completed";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the onboarding flow for a new franchisee.
 * Creates the `franchisee_onboarding` row and emits the first event.
 */
export async function startOnboarding(
  franchiseeId: string,
  brandId: string
): Promise<OnboardingStatus> {
  if (!franchiseeId) throw new Error("franchiseeId is required.");
  if (!brandId) throw new Error("brandId is required.");

  const supabase = getClient();
  const now = new Date().toISOString();
  const steps = buildInitialSteps();

  // Mark the first step as in_progress
  steps[0].status = "in_progress";
  steps[0].started_at = now;

  const record: OnboardingStatus = {
    franchisee_id: franchiseeId,
    brand_id: brandId,
    current_step: ONBOARDING_STEPS[0],
    steps,
    started_at: now,
    completed_at: null,
    percent_complete: 0,
  };

  // Upsert so re-calling is idempotent
  const { error } = await supabase.from("franchisee_onboarding").upsert(
    {
      franchisee_id: record.franchisee_id,
      brand_id: record.brand_id,
      current_step: record.current_step,
      steps: record.steps,
      started_at: record.started_at,
      completed_at: record.completed_at,
      percent_complete: record.percent_complete,
    },
    { onConflict: "franchisee_id" }
  );

  if (error) {
    throw new Error(`Failed to create onboarding record: ${error.message}`);
  }

  // Emit start event
  await emitEvent(supabase, {
    franchisee_id: franchiseeId,
    brand_id: brandId,
    event_type: "onboarding_started",
    step: ONBOARDING_STEPS[0],
    payload: { started_at: now },
  });

  return record;
}

/**
 * Mark the given step as completed and advance to the next step.
 * Emits a `step_completed` event (and `onboarding_completed` if it was the last step).
 */
export async function advanceStep(
  franchiseeId: string,
  step: OnboardingStep
): Promise<OnboardingStatus> {
  if (!franchiseeId) throw new Error("franchiseeId is required.");
  if (!ONBOARDING_STEPS.includes(step)) {
    throw new Error(
      `Invalid step "${step}". Must be one of: ${ONBOARDING_STEPS.join(", ")}.`
    );
  }

  const supabase = getClient();
  const now = new Date().toISOString();

  // Fetch current record
  const { data: existing, error: fetchError } = await supabase
    .from("franchisee_onboarding")
    .select("*")
    .eq("franchisee_id", franchiseeId)
    .single();

  if (fetchError || !existing) {
    throw new Error(
      `No onboarding record found for franchisee "${franchiseeId}". Call startOnboarding first.`
    );
  }

  const steps: StepRecord[] = existing.steps as StepRecord[];

  // Find and update the target step
  const stepIndex = steps.findIndex((s) => s.step === step);
  if (stepIndex === -1) {
    throw new Error(`Step "${step}" not found in onboarding record.`);
  }

  if (steps[stepIndex].status === "completed") {
    throw new Error(`Step "${step}" is already completed.`);
  }

  steps[stepIndex].status = "completed";
  steps[stepIndex].completed_at = now;

  // Advance the next pending step to in_progress
  const nextIndex = stepIndex + 1;
  if (nextIndex < steps.length) {
    steps[nextIndex].status = "in_progress";
    steps[nextIndex].started_at = now;
  }

  const currentStep = determineCurrentStep(steps);
  const percentComplete = computePercent(steps);
  const isComplete = currentStep === "completed";

  const { error: updateError } = await supabase
    .from("franchisee_onboarding")
    .update({
      current_step: currentStep,
      steps,
      percent_complete: percentComplete,
      completed_at: isComplete ? now : null,
    })
    .eq("franchisee_id", franchiseeId);

  if (updateError) {
    throw new Error(`Failed to update onboarding record: ${updateError.message}`);
  }

  // Emit step_completed event
  await emitEvent(supabase, {
    franchisee_id: franchiseeId,
    brand_id: existing.brand_id as string,
    event_type: "step_completed",
    step,
    payload: { completed_at: now, percent_complete: percentComplete },
  });

  // Emit onboarding_completed if done
  if (isComplete) {
    await emitEvent(supabase, {
      franchisee_id: franchiseeId,
      brand_id: existing.brand_id as string,
      event_type: "onboarding_completed",
      step,
      payload: { completed_at: now },
    });
  }

  return {
    franchisee_id: franchiseeId,
    brand_id: existing.brand_id as string,
    current_step: currentStep,
    steps,
    started_at: existing.started_at as string,
    completed_at: isComplete ? now : null,
    percent_complete: percentComplete,
  };
}

/**
 * Retrieve the current onboarding status for a franchisee.
 */
export async function getOnboardingStatus(
  franchiseeId: string
): Promise<OnboardingStatus> {
  if (!franchiseeId) throw new Error("franchiseeId is required.");

  const supabase = getClient();

  const { data, error } = await supabase
    .from("franchisee_onboarding")
    .select("*")
    .eq("franchisee_id", franchiseeId)
    .single();

  if (error || !data) {
    throw new Error(
      `No onboarding record found for franchisee "${franchiseeId}": ${error?.message ?? "not found"}.`
    );
  }

  return {
    franchisee_id: data.franchisee_id as string,
    brand_id: data.brand_id as string,
    current_step: data.current_step as OnboardingStep | "completed",
    steps: data.steps as StepRecord[],
    started_at: data.started_at as string,
    completed_at: (data.completed_at as string) ?? null,
    percent_complete: data.percent_complete as number,
  };
}
