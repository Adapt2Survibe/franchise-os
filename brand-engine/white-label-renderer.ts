// ---------------------------------------------------------------------------
// white-label-renderer.ts
// Apply brand config to UI — generates CSS variables and voice context
// for white-labelled rendering and agent prompts.
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  config: {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
      [key: string]: string | undefined;
    };
    voice_tone?: string;
    [key: string]: unknown;
  };
}

async function fetchBrand(brandId: string): Promise<BrandRow> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, config')
    .eq('id', brandId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load brand "${brandId}": ${error.message} (code ${error.code})`
    );
  }

  if (!data) {
    throw new Error(`No brand found with id "${brandId}".`);
  }

  return data as BrandRow;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CSS variables object from a brand's color config.
 *
 * Example return value:
 * ```
 * {
 *   '--brand-primary': '#1E40AF',
 *   '--brand-secondary': '#1E293B',
 *   '--brand-accent': '#F59E0B',
 *   '--brand-background': '#FFFFFF',
 *   '--brand-text': '#111827',
 *   '--brand-name': 'Skill Samurai',
 * }
 * ```
 */
export async function getBrandTheme(
  brandId: string
): Promise<Record<string, string>> {
  const brand = await fetchBrand(brandId);
  const colors = brand.config?.colors ?? {};

  // Sensible defaults for missing colors
  const theme: Record<string, string> = {
    '--brand-primary': colors.primary ?? '#1E40AF',
    '--brand-secondary': colors.secondary ?? colors.primary ?? '#1E293B',
    '--brand-accent': colors.accent ?? '#F59E0B',
    '--brand-background': colors.background ?? '#FFFFFF',
    '--brand-text': colors.text ?? '#111827',
    '--brand-name': brand.name,
  };

  // Include any additional custom colors defined in the config
  for (const [key, value] of Object.entries(colors)) {
    if (value && !['primary', 'secondary', 'accent', 'background', 'text'].includes(key)) {
      theme[`--brand-${key}`] = value;
    }
  }

  return theme;
}

/**
 * Generate a brand voice context string suitable for injecting into
 * agent system prompts. Loads the brand config and extracts voice_tone
 * along with brand identity information.
 *
 * Example return:
 * ```
 * Brand: Skill Samurai
 * Voice & Tone: Professional, empowering, education-focused.
 * Primary Color: #1E40AF
 * ```
 */
export async function getBrandVoiceContext(
  brandId: string
): Promise<string> {
  const brand = await fetchBrand(brandId);
  const config = brand.config ?? {};
  const colors = config.colors ?? {};

  const lines: string[] = [
    `Brand: ${brand.name}`,
    `Slug: ${brand.slug}`,
  ];

  if (config.voice_tone) {
    lines.push(`Voice & Tone: ${config.voice_tone}`);
  }

  if (colors.primary) {
    lines.push(`Primary Color: ${colors.primary}`);
  }

  if (colors.secondary) {
    lines.push(`Secondary Color: ${colors.secondary}`);
  }

  if (colors.accent) {
    lines.push(`Accent Color: ${colors.accent}`);
  }

  // Include any other top-level config keys that are strings (e.g. tagline)
  for (const [key, value] of Object.entries(config)) {
    if (
      typeof value === 'string' &&
      !['voice_tone'].includes(key) &&
      key !== 'colors'
    ) {
      lines.push(`${key.replace(/_/g, ' ')}: ${value}`);
    }
  }

  return lines.join('\n');
}
