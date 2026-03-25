import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  [key: string]: string;
}

export interface TerritoryRule {
  type: "zip" | "radius" | "county" | "state" | "custom";
  value: string;
  exclusive: boolean;
  description?: string;
}

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  required: boolean;
  order: number;
  description?: string;
}

export interface BrandConfig {
  colors: BrandColors;
  voice_tone: string;
  territory_rules: TerritoryRule[];
  royalty_rate: number;
  onboarding_checklist: OnboardingChecklistItem[];
  [key: string]: unknown;
}

export type BrandStatus = "active" | "inactive" | "pending" | "suspended";

export interface Brand {
  id: string;
  name: string;
  slug: string;
  clerk_org_id: string;
  config: BrandConfig;
  status: BrandStatus;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Validation helper (re-exported from config-validator for convenience)
// ---------------------------------------------------------------------------

export interface BrandValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Supabase client singleton
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

function getClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Brand config validation (lightweight — full schema lives in config-validator)
// ---------------------------------------------------------------------------

export function validateBrandConfig(brand: Brand): BrandValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!brand.id) errors.push("Brand id is required.");
  if (!brand.name) errors.push("Brand name is required.");
  if (!brand.slug) errors.push("Brand slug is required.");
  if (!brand.clerk_org_id) errors.push("clerk_org_id is required.");

  const cfg = brand.config;

  if (!cfg) {
    errors.push("Brand config object is missing.");
    return { valid: errors.length === 0, errors, warnings };
  }

  if (!cfg.colors || typeof cfg.colors !== "object") {
    errors.push("config.colors is required and must be an object.");
  } else {
    if (!cfg.colors.primary) errors.push("config.colors.primary is required.");
    if (!cfg.colors.secondary)
      warnings.push("config.colors.secondary is missing — will fall back to primary.");
  }

  if (!cfg.voice_tone || typeof cfg.voice_tone !== "string") {
    errors.push("config.voice_tone is required and must be a string.");
  }

  if (!Array.isArray(cfg.territory_rules)) {
    errors.push("config.territory_rules must be an array.");
  } else if (cfg.territory_rules.length === 0) {
    warnings.push("config.territory_rules is empty — no territory protection defined.");
  }

  if (cfg.royalty_rate == null || typeof cfg.royalty_rate !== "number") {
    errors.push("config.royalty_rate is required and must be a number.");
  } else if (cfg.royalty_rate < 0 || cfg.royalty_rate > 100) {
    errors.push("config.royalty_rate must be between 0 and 100.");
  }

  if (!Array.isArray(cfg.onboarding_checklist)) {
    errors.push("config.onboarding_checklist must be an array.");
  } else if (cfg.onboarding_checklist.length === 0) {
    warnings.push("config.onboarding_checklist is empty — no onboarding steps defined.");
  }

  if (!brand.status) {
    warnings.push("Brand status is not set.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load a brand by its unique slug (e.g. "acme-burgers").
 */
export async function loadBrand(slug: string): Promise<Brand> {
  if (!slug || typeof slug !== "string") {
    throw new Error("A valid slug string is required.");
  }

  const supabase = getClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .single();

  if (error) {
    throw new Error(
      `Failed to load brand by slug "${slug}": ${error.message} (code ${error.code})`
    );
  }

  if (!data) {
    throw new Error(`No brand found with slug "${slug}".`);
  }

  return data as Brand;
}

/**
 * Load a brand by the Clerk organisation ID it is linked to.
 */
export async function loadBrandByOrg(clerkOrgId: string): Promise<Brand> {
  if (!clerkOrgId || typeof clerkOrgId !== "string") {
    throw new Error("A valid clerkOrgId string is required.");
  }

  const supabase = getClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("clerk_org_id", clerkOrgId.trim())
    .single();

  if (error) {
    throw new Error(
      `Failed to load brand by clerk_org_id "${clerkOrgId}": ${error.message} (code ${error.code})`
    );
  }

  if (!data) {
    throw new Error(`No brand found with clerk_org_id "${clerkOrgId}".`);
  }

  return data as Brand;
}
