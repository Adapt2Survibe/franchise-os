// ---------------------------------------------------------------------------
// brand-switcher.ts
// Multi-brand support with in-memory caching (5-minute TTL).
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandConfig {
  id: string;
  name: string;
  slug: string;
  clerk_org_id: string;
  config: Record<string, unknown>;
  status: string;
}

interface CacheEntry {
  brand: BrandConfig;
  expiresAt: number;
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
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Cache keyed by brand id */
const cacheById = new Map<string, CacheEntry>();

/** Secondary indexes for fast lookup */
const orgIdToId = new Map<string, string>();
const slugToId = new Map<string, string>();

function cacheSet(brand: BrandConfig): void {
  const entry: CacheEntry = {
    brand,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  cacheById.set(brand.id, entry);
  if (brand.clerk_org_id) orgIdToId.set(brand.clerk_org_id, brand.id);
  if (brand.slug) slugToId.set(brand.slug, brand.id);
}

function cacheGet(brandId: string): BrandConfig | null {
  const entry = cacheById.get(brandId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    // Expired — evict
    cacheById.delete(brandId);
    return null;
  }

  return entry.brand;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a brand by its Clerk organisation ID. Uses cache with 5-minute TTL.
 */
export async function getBrandByOrg(
  clerkOrgId: string
): Promise<BrandConfig> {
  if (!clerkOrgId || typeof clerkOrgId !== 'string') {
    throw new Error('A valid clerkOrgId string is required.');
  }

  // Check cache via secondary index
  const cachedId = orgIdToId.get(clerkOrgId);
  if (cachedId) {
    const cached = cacheGet(cachedId);
    if (cached) return cached;
  }

  // Cache miss — fetch from Supabase
  const supabase = getClient();

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('clerk_org_id', clerkOrgId.trim())
    .single();

  if (error) {
    throw new Error(
      `Failed to load brand by clerk_org_id "${clerkOrgId}": ${error.message} (code ${error.code})`
    );
  }

  if (!data) {
    throw new Error(`No brand found with clerk_org_id "${clerkOrgId}".`);
  }

  const brand = data as BrandConfig;
  cacheSet(brand);

  return brand;
}

/**
 * Get a brand by its slug. Uses cache with 5-minute TTL.
 */
export async function getBrandBySlug(slug: string): Promise<BrandConfig> {
  if (!slug || typeof slug !== 'string') {
    throw new Error('A valid slug string is required.');
  }

  const normalizedSlug = slug.trim().toLowerCase();

  // Check cache via secondary index
  const cachedId = slugToId.get(normalizedSlug);
  if (cachedId) {
    const cached = cacheGet(cachedId);
    if (cached) return cached;
  }

  // Cache miss — fetch from Supabase
  const supabase = getClient();

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', normalizedSlug)
    .single();

  if (error) {
    throw new Error(
      `Failed to load brand by slug "${slug}": ${error.message} (code ${error.code})`
    );
  }

  if (!data) {
    throw new Error(`No brand found with slug "${slug}".`);
  }

  const brand = data as BrandConfig;
  cacheSet(brand);

  return brand;
}

/**
 * Invalidate a specific brand from the cache.
 */
export function invalidateCache(brandId: string): void {
  const entry = cacheById.get(brandId);
  if (entry) {
    // Remove secondary index entries
    if (entry.brand.clerk_org_id) orgIdToId.delete(entry.brand.clerk_org_id);
    if (entry.brand.slug) slugToId.delete(entry.brand.slug);
    cacheById.delete(brandId);
  }
}

/**
 * Clear all cached brands.
 */
export function clearCache(): void {
  cacheById.clear();
  orgIdToId.clear();
  slugToId.clear();
}
