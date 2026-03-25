import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL environment variable');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TerritoryScoringInput {
  lat: number;
  lng: number;
  radius_km: number;
  brandId: string;
}

export type TerritoryGrade = 'A' | 'B' | 'C' | 'D';

export interface DimensionScore {
  raw: number;        // raw metric value
  normalized: number; // 0-100 normalized score
  weight: number;     // weight applied in composite
  weighted: number;   // normalized * weight
  details: string;
}

export interface TerritoryBreakdown {
  populationDensity: DimensionScore;
  medianIncome: DimensionScore;
  competitorProximity: DimensionScore;
  franchiseSaturation: DimensionScore;
  trafficSearchSignal: DimensionScore;
}

export interface TerritoryScoringOutput {
  score: number;
  grade: TerritoryGrade;
  breakdown: TerritoryBreakdown;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Scoring weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS = {
  populationDensity: 0.25,
  medianIncome: 0.20,
  competitorProximity: 0.20,
  franchiseSaturation: 0.20,
  trafficSearchSignal: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Grade thresholds
// ---------------------------------------------------------------------------
function gradeFromScore(score: number): TerritoryGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Utility: Haversine distance in km
// ---------------------------------------------------------------------------
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Data fetchers (placeholder implementations)
// ---------------------------------------------------------------------------

/**
 * Fetch population density (people per sq km) for a circular territory.
 *
 * TODO: Replace with real Census Bureau API call
 *       https://api.census.gov/data — use ACS 5-year population estimates
 *       or a third-party provider like Esri Demographics / Precisely.
 */
async function fetchPopulationDensity(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<number> {
  // Placeholder: query Supabase for cached census data if available
  const { data } = await supabase
    .from('census_data')
    .select('population_density')
    .gte('lat', lat - radiusKm / 111)
    .lte('lat', lat + radiusKm / 111)
    .gte('lng', lng - radiusKm / (111 * Math.cos((lat * Math.PI) / 180)))
    .lte('lng', lng + radiusKm / (111 * Math.cos((lat * Math.PI) / 180)));

  if (data && data.length > 0) {
    const avg =
      data.reduce(
        (sum: number, row: { population_density: number }) =>
          sum + row.population_density,
        0,
      ) / data.length;
    return avg;
  }

  // TODO: Fall back to Census API when no cached data exists
  // Simulated value — moderate suburban density
  return 1200 + Math.random() * 3000;
}

/**
 * Fetch median household income for the territory area.
 *
 * TODO: Replace with Census ACS median household income endpoint
 *       or a commercial demographics provider.
 */
async function fetchMedianIncome(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<number> {
  const { data } = await supabase
    .from('census_data')
    .select('median_income')
    .gte('lat', lat - radiusKm / 111)
    .lte('lat', lat + radiusKm / 111)
    .gte('lng', lng - radiusKm / (111 * Math.cos((lat * Math.PI) / 180)))
    .lte('lng', lng + radiusKm / (111 * Math.cos((lat * Math.PI) / 180)));

  if (data && data.length > 0) {
    const avg =
      data.reduce(
        (sum: number, row: { median_income: number }) =>
          sum + row.median_income,
        0,
      ) / data.length;
    return avg;
  }

  // TODO: Fall back to Census API
  return 55000 + Math.random() * 60000;
}

/**
 * Fetch competitor locations near the territory center.
 *
 * TODO: Replace with Google Maps Places API (Nearby Search)
 *       or Yelp Fusion API to pull competing businesses.
 */
async function fetchCompetitorLocations(
  lat: number,
  lng: number,
  radiusKm: number,
  brandId: string,
): Promise<Array<{ lat: number; lng: number; name: string }>> {
  // Try Supabase first — brands may store known competitor locations
  const { data } = await supabase
    .from('competitor_locations')
    .select('lat, lng, name')
    .eq('brand_id', brandId);

  if (data && data.length > 0) {
    // Filter to those within the radius
    return data.filter(
      (c: { lat: number; lng: number; name: string }) =>
        haversineKm(lat, lng, c.lat, c.lng) <= radiusKm * 2,
    );
  }

  // TODO: Call Google Maps Places API for nearby competitors
  return [];
}

/**
 * Fetch existing franchise locations for the brand near the territory.
 *
 * TODO: This should always be stored in the franchise-os database.
 *       Ensure the `franchise_locations` table is populated.
 */
async function fetchExistingFranchises(
  lat: number,
  lng: number,
  radiusKm: number,
  brandId: string,
): Promise<Array<{ lat: number; lng: number; unit_id: string }>> {
  const { data } = await supabase
    .from('franchise_locations')
    .select('lat, lng, unit_id')
    .eq('brand_id', brandId);

  if (data && data.length > 0) {
    return data.filter(
      (f: { lat: number; lng: number; unit_id: string }) =>
        haversineKm(lat, lng, f.lat, f.lng) <= radiusKm * 3,
    );
  }

  return [];
}

/**
 * Fetch traffic & search-signal data for the territory.
 *
 * TODO: Replace with Google Trends API (pytrends proxy or SerpApi),
 *       Google Maps traffic layer data, or a foot-traffic provider
 *       like Placer.ai or SafeGraph.
 */
async function fetchTrafficSearchSignals(
  lat: number,
  lng: number,
  radiusKm: number,
  brandId: string,
): Promise<{ searchVolume: number; footTrafficIndex: number }> {
  const { data } = await supabase
    .from('search_signals')
    .select('search_volume, foot_traffic_index')
    .eq('brand_id', brandId)
    .gte('lat', lat - radiusKm / 111)
    .lte('lat', lat + radiusKm / 111)
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      searchVolume: data.search_volume,
      footTrafficIndex: data.foot_traffic_index,
    };
  }

  // TODO: Call real traffic/search API
  return {
    searchVolume: Math.floor(500 + Math.random() * 9500),
    footTrafficIndex: Math.floor(20 + Math.random() * 80),
  };
}

// ---------------------------------------------------------------------------
// Scoring helper functions (one per dimension)
// ---------------------------------------------------------------------------

/**
 * Score population density on a 0-100 scale.
 * Higher density = higher score (capped at ~5000 ppl/sq km = 100).
 */
export function scorePopulationDensity(density: number): DimensionScore {
  const maxDensity = 5000;
  const normalized = Math.min(100, (density / maxDensity) * 100);
  const weight = WEIGHTS.populationDensity;
  return {
    raw: Math.round(density),
    normalized: Math.round(normalized * 10) / 10,
    weight,
    weighted: Math.round(normalized * weight * 10) / 10,
    details:
      density >= 3000
        ? 'High population density — strong consumer base'
        : density >= 1500
          ? 'Moderate population density — adequate consumer base'
          : 'Low population density — limited walk-in potential',
  };
}

/**
 * Score median income on a 0-100 scale.
 * Sweet spot: $60k-$120k maps to highest scores.
 * Below $40k or above $200k both score lower (different reasons).
 */
export function scoreMedianIncome(income: number): DimensionScore {
  let normalized: number;
  if (income < 30000) {
    normalized = (income / 30000) * 30;
  } else if (income < 60000) {
    normalized = 30 + ((income - 30000) / 30000) * 40;
  } else if (income <= 120000) {
    normalized = 70 + ((income - 60000) / 60000) * 30;
  } else if (income <= 200000) {
    // Still good but slightly diminishing — luxury pricing may be needed
    normalized = 90 + ((200000 - income) / 80000) * 10;
  } else {
    normalized = 75; // ultra-high income areas can work but are niche
  }

  const weight = WEIGHTS.medianIncome;
  return {
    raw: Math.round(income),
    normalized: Math.round(normalized * 10) / 10,
    weight,
    weighted: Math.round(normalized * weight * 10) / 10,
    details:
      income >= 60000 && income <= 120000
        ? 'Ideal income bracket for franchise consumer base'
        : income < 40000
          ? 'Below-average income — price sensitivity risk'
          : 'High income area — premium positioning possible',
  };
}

/**
 * Score competitor proximity on a 0-100 scale.
 * Fewer nearby competitors = higher score.
 * Some competition is healthy (validates market), zero is slightly penalized.
 */
export function scoreCompetitorProximity(
  competitors: Array<{ lat: number; lng: number; name: string }>,
  lat: number,
  lng: number,
  radiusKm: number,
): DimensionScore {
  const withinRadius = competitors.filter(
    (c) => haversineKm(lat, lng, c.lat, c.lng) <= radiusKm,
  );
  const count = withinRadius.length;

  let normalized: number;
  if (count === 0) {
    normalized = 85; // no competition — great, slight penalty for unvalidated market
  } else if (count <= 2) {
    normalized = 95; // light competition — market validated, room to capture share
  } else if (count <= 5) {
    normalized = 70;
  } else if (count <= 10) {
    normalized = 40;
  } else {
    normalized = Math.max(10, 40 - (count - 10) * 3);
  }

  const weight = WEIGHTS.competitorProximity;
  return {
    raw: count,
    normalized: Math.round(normalized * 10) / 10,
    weight,
    weighted: Math.round(normalized * weight * 10) / 10,
    details:
      count <= 2
        ? `${count} competitor(s) nearby — market validated with room to grow`
        : count <= 5
          ? `${count} competitors nearby — moderate competition`
          : `${count} competitors nearby — saturated competitive landscape`,
  };
}

/**
 * Score franchise saturation on a 0-100 scale.
 * Fewer existing same-brand locations nearby = higher score (more white space).
 */
export function scoreFranchiseSaturation(
  existingUnits: Array<{ lat: number; lng: number; unit_id: string }>,
  lat: number,
  lng: number,
  radiusKm: number,
): DimensionScore {
  const nearby = existingUnits.filter(
    (f) => haversineKm(lat, lng, f.lat, f.lng) <= radiusKm * 2,
  );
  const count = nearby.length;

  let normalized: number;
  if (count === 0) {
    normalized = 100;
  } else if (count === 1) {
    normalized = 75;
  } else if (count <= 3) {
    normalized = 50;
  } else {
    normalized = Math.max(5, 50 - count * 10);
  }

  const weight = WEIGHTS.franchiseSaturation;
  return {
    raw: count,
    normalized: Math.round(normalized * 10) / 10,
    weight,
    weighted: Math.round(normalized * weight * 10) / 10,
    details:
      count === 0
        ? 'No existing franchise units in territory — full white-space opportunity'
        : count <= 2
          ? `${count} existing unit(s) within extended radius — some overlap risk`
          : `${count} existing units nearby — territory likely saturated`,
  };
}

/**
 * Score traffic & search signals on a 0-100 scale.
 * Composite of search volume and foot-traffic index.
 */
export function scoreTrafficSearchSignal(signals: {
  searchVolume: number;
  footTrafficIndex: number;
}): DimensionScore {
  // Search volume: assume 10000 is excellent
  const searchNorm = Math.min(100, (signals.searchVolume / 10000) * 100);
  // Foot traffic index: already on a 0-100-ish scale
  const trafficNorm = Math.min(100, signals.footTrafficIndex);

  const normalized = searchNorm * 0.5 + trafficNorm * 0.5;
  const weight = WEIGHTS.trafficSearchSignal;

  return {
    raw: signals.searchVolume,
    normalized: Math.round(normalized * 10) / 10,
    weight,
    weighted: Math.round(normalized * weight * 10) / 10,
    details:
      normalized >= 70
        ? 'Strong search interest and foot traffic in area'
        : normalized >= 40
          ? 'Moderate consumer interest signals'
          : 'Weak demand signals — marketing investment needed',
  };
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------
function generateRecommendation(
  grade: TerritoryGrade,
  breakdown: TerritoryBreakdown,
): string {
  const weakest = (
    Object.entries(breakdown) as [keyof TerritoryBreakdown, DimensionScore][]
  ).sort((a, b) => a[1].normalized - b[1].normalized)[0];

  const strongest = (
    Object.entries(breakdown) as [keyof TerritoryBreakdown, DimensionScore][]
  ).sort((a, b) => b[1].normalized - a[1].normalized)[0];

  const dimensionLabels: Record<keyof TerritoryBreakdown, string> = {
    populationDensity: 'population density',
    medianIncome: 'median income',
    competitorProximity: 'competitor landscape',
    franchiseSaturation: 'franchise saturation',
    trafficSearchSignal: 'traffic/search signals',
  };

  switch (grade) {
    case 'A':
      return (
        `Strong territory candidate. ${dimensionLabels[strongest[0]]} is a key strength ` +
        `(${strongest[1].normalized}/100). Recommend proceeding to detailed site selection and ` +
        `franchise disclosure process.`
      );
    case 'B':
      return (
        `Viable territory with room for optimization. ` +
        `Strongest factor: ${dimensionLabels[strongest[0]]} (${strongest[1].normalized}/100). ` +
        `Address ${dimensionLabels[weakest[0]]} (${weakest[1].normalized}/100) before committing. ` +
        `Consider a targeted marketing study.`
      );
    case 'C':
      return (
        `Below-average territory. Primary concern: ${dimensionLabels[weakest[0]]} ` +
        `scored ${weakest[1].normalized}/100. Recommend further market research before ` +
        `investment. May be viable with significant marketing budget.`
      );
    case 'D':
      return (
        `Territory not recommended at this time. Multiple dimensions scored poorly, ` +
        `especially ${dimensionLabels[weakest[0]]} (${weakest[1].normalized}/100). ` +
        `Re-evaluate if market conditions change.`
      );
  }
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------
export async function scoreTerritory(
  input: TerritoryScoringInput,
): Promise<TerritoryScoringOutput> {
  const { lat, lng, radius_km, brandId } = input;

  // Fetch all data dimensions in parallel
  const [
    populationDensity,
    medianIncome,
    competitors,
    existingFranchises,
    trafficSignals,
  ] = await Promise.all([
    fetchPopulationDensity(lat, lng, radius_km),
    fetchMedianIncome(lat, lng, radius_km),
    fetchCompetitorLocations(lat, lng, radius_km, brandId),
    fetchExistingFranchises(lat, lng, radius_km, brandId),
    fetchTrafficSearchSignals(lat, lng, radius_km, brandId),
  ]);

  // Score each dimension
  const breakdown: TerritoryBreakdown = {
    populationDensity: scorePopulationDensity(populationDensity),
    medianIncome: scoreMedianIncome(medianIncome),
    competitorProximity: scoreCompetitorProximity(
      competitors,
      lat,
      lng,
      radius_km,
    ),
    franchiseSaturation: scoreFranchiseSaturation(
      existingFranchises,
      lat,
      lng,
      radius_km,
    ),
    trafficSearchSignal: scoreTrafficSearchSignal(trafficSignals),
  };

  // Composite score = sum of weighted scores
  const score = Math.round(
    breakdown.populationDensity.weighted +
      breakdown.medianIncome.weighted +
      breakdown.competitorProximity.weighted +
      breakdown.franchiseSaturation.weighted +
      breakdown.trafficSearchSignal.weighted,
  );

  const grade = gradeFromScore(score);
  const recommendation = generateRecommendation(grade, breakdown);

  // Persist scoring result to Supabase for analytics
  await supabase.from('territory_scores').insert({
    brand_id: brandId,
    lat,
    lng,
    radius_km,
    score,
    grade,
    breakdown,
    recommendation,
    scored_at: new Date().toISOString(),
  });

  return { score, grade, breakdown, recommendation };
}

export default scoreTerritory;
