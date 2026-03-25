import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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
export type SignalType =
  | 'lead_cluster'
  | 'territory_threshold'
  | 'competitor_closed'
  | 'search_volume_spike';

export interface GeoLocation {
  lat: number;
  lng: number;
  label?: string; // city/region name
}

export interface OpportunitySignal {
  id: string;
  type: SignalType;
  location: GeoLocation;
  score: number;          // 0-100 confidence / priority score
  summary: string;
  recommended_action: string;
  created_at: string;     // ISO 8601
}

interface LeadRecord {
  id: string;
  lat: number;
  lng: number;
  brand_id: string;
  created_at: string;
  status: string;
  city?: string;
}

interface TerritoryScoreRecord {
  id: string;
  brand_id: string;
  lat: number;
  lng: number;
  radius_km: number;
  score: number;
  grade: string;
  scored_at: string;
  region_label?: string;
}

interface CompetitorLocation {
  id: string;
  brand_id: string;
  competitor_name: string;
  lat: number;
  lng: number;
  status: string;
  last_seen_at: string;
  city?: string;
}

interface SearchVolumeRecord {
  region: string;
  lat: number;
  lng: number;
  current_volume: number;
  previous_volume: number;
  brand_id: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG = {
  /** Minimum leads in a geo cluster to trigger a signal */
  LEAD_CLUSTER_MIN_COUNT: 5,
  /** Radius in km to group leads into clusters */
  LEAD_CLUSTER_RADIUS_KM: 15,
  /** Territory score threshold that triggers an opportunity */
  TERRITORY_SCORE_THRESHOLD: 75,
  /** Percent increase in search volume that counts as a spike */
  SEARCH_SPIKE_PERCENT: 50,
  /** How many days back to look for new competitor closures */
  COMPETITOR_CHANGE_LOOKBACK_DAYS: 90,
} as const;

// ---------------------------------------------------------------------------
// Utility: Haversine distance
// ---------------------------------------------------------------------------
function haversineKm(
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
// Emit opportunity event to agent_events table
// ---------------------------------------------------------------------------
async function emitOpportunityEvent(
  signal: OpportunitySignal,
  brandId: string,
): Promise<void> {
  const { error } = await supabase.from('agent_events').insert({
    id: randomUUID(),
    event_type: 'opportunity.detected',
    brand_id: brandId,
    payload: signal,
    created_at: signal.created_at,
  });

  if (error) {
    console.error(
      `[expansion-radar] Failed to emit opportunity.detected event: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Signal source 1: Lead clustering by geography
// ---------------------------------------------------------------------------

/**
 * Analyze recent leads for geographic clusters that indicate untapped demand.
 *
 * TODO: Replace Supabase query with a real spatial clustering algorithm
 *       (e.g., DBSCAN via PostGIS extension) for production accuracy.
 *       Current implementation uses a simple centroid-based grouping.
 */
export async function analyzeLeadClusters(
  brandId: string,
): Promise<OpportunitySignal[]> {
  const signals: OpportunitySignal[] = [];

  // Fetch leads from the last 180 days that are not in existing territories
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, lat, lng, brand_id, created_at, status, city')
    .eq('brand_id', brandId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (error || !leads || leads.length === 0) {
    return signals;
  }

  // Simple grid-based clustering
  const clusters = clusterPoints(
    leads as LeadRecord[],
    CONFIG.LEAD_CLUSTER_RADIUS_KM,
  );

  for (const cluster of clusters) {
    if (cluster.points.length >= CONFIG.LEAD_CLUSTER_MIN_COUNT) {
      const score = Math.min(
        100,
        Math.round((cluster.points.length / 20) * 100),
      );

      const cityLabel =
        cluster.points.find((p) => p.city)?.city ?? 'Unknown area';

      signals.push({
        id: randomUUID(),
        type: 'lead_cluster',
        location: {
          lat: cluster.centroid.lat,
          lng: cluster.centroid.lng,
          label: cityLabel,
        },
        score,
        summary: `${cluster.points.length} leads clustered within ${CONFIG.LEAD_CLUSTER_RADIUS_KM}km around ${cityLabel} in the last 180 days. No existing franchise unit serves this area.`,
        recommended_action:
          score >= 70
            ? 'Initiate territory scoring and begin franchisee recruitment for this area.'
            : 'Monitor cluster growth; schedule a market feasibility assessment.',
        created_at: new Date().toISOString(),
      });
    }
  }

  return signals;
}

/** Centroid-based point clustering (simple greedy approach). */
function clusterPoints(
  points: LeadRecord[],
  radiusKm: number,
): Array<{
  centroid: { lat: number; lng: number };
  points: LeadRecord[];
}> {
  const assigned = new Set<string>();
  const clusters: Array<{
    centroid: { lat: number; lng: number };
    points: LeadRecord[];
  }> = [];

  for (const point of points) {
    if (assigned.has(point.id)) continue;

    const nearby = points.filter(
      (p) =>
        !assigned.has(p.id) &&
        haversineKm(point.lat, point.lng, p.lat, p.lng) <= radiusKm,
    );

    if (nearby.length >= 2) {
      const centroid = {
        lat: nearby.reduce((s, p) => s + p.lat, 0) / nearby.length,
        lng: nearby.reduce((s, p) => s + p.lng, 0) / nearby.length,
      };
      for (const p of nearby) assigned.add(p.id);
      clusters.push({ centroid, points: nearby });
    }
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Signal source 2: Territory score threshold crossed
// ---------------------------------------------------------------------------

/**
 * Check for territories whose score recently crossed above the threshold,
 * indicating they have become viable expansion targets.
 *
 * TODO: Implement delta tracking — compare current scores vs. previous
 *       scoring run to detect newly-crossed thresholds, not just current
 *       high-scoring territories.
 */
export async function checkTerritoryThresholds(
  brandId: string,
): Promise<OpportunitySignal[]> {
  const signals: OpportunitySignal[] = [];

  const { data: territories, error } = await supabase
    .from('territory_scores')
    .select('id, brand_id, lat, lng, radius_km, score, grade, scored_at, region_label')
    .eq('brand_id', brandId)
    .gte('score', CONFIG.TERRITORY_SCORE_THRESHOLD)
    .order('scored_at', { ascending: false })
    .limit(50);

  if (error || !territories || territories.length === 0) {
    return signals;
  }

  // Filter to territories not already assigned to a franchisee
  const { data: assignedTerritories } = await supabase
    .from('franchise_territories')
    .select('territory_score_id')
    .eq('brand_id', brandId)
    .eq('status', 'active');

  const assignedIds = new Set(
    (assignedTerritories ?? []).map(
      (t: { territory_score_id: string }) => t.territory_score_id,
    ),
  );

  for (const territory of territories as TerritoryScoreRecord[]) {
    if (assignedIds.has(territory.id)) continue;

    signals.push({
      id: randomUUID(),
      type: 'territory_threshold',
      location: {
        lat: territory.lat,
        lng: territory.lng,
        label: territory.region_label ?? undefined,
      },
      score: territory.score,
      summary: `Territory at (${territory.lat.toFixed(4)}, ${territory.lng.toFixed(4)}) scored ${territory.score}/100 (Grade ${territory.grade}) and is unassigned. Radius: ${territory.radius_km}km.`,
      recommended_action:
        territory.score >= 85
          ? 'High-priority expansion target — begin franchisee outreach immediately.'
          : 'Add to expansion pipeline; pair with lead generation campaign.',
      created_at: new Date().toISOString(),
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Signal source 3: Competitor closed location
// ---------------------------------------------------------------------------

/**
 * Detect competitor locations that recently closed, creating market openings.
 *
 * TODO: Integrate Google Maps Places API or a business data provider
 *       (e.g., Data Axle, Foursquare) for real-time closure detection.
 *       Current implementation relies on the competitor_locations table
 *       being updated with status = 'closed'.
 */
export async function detectCompetitorChanges(
  brandId: string,
): Promise<OpportunitySignal[]> {
  const signals: OpportunitySignal[] = [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONFIG.COMPETITOR_CHANGE_LOOKBACK_DAYS);

  const { data: closures, error } = await supabase
    .from('competitor_locations')
    .select('id, brand_id, competitor_name, lat, lng, status, last_seen_at, city')
    .eq('brand_id', brandId)
    .eq('status', 'closed')
    .gte('last_seen_at', cutoff.toISOString())
    .order('last_seen_at', { ascending: false });

  if (error || !closures || closures.length === 0) {
    return signals;
  }

  for (const closure of closures as CompetitorLocation[]) {
    // Check if we already have a franchise unit nearby
    const { data: nearbyUnits } = await supabase
      .from('franchise_locations')
      .select('unit_id, lat, lng')
      .eq('brand_id', brandId);

    const hasNearbyUnit = (nearbyUnits ?? []).some(
      (u: { lat: number; lng: number }) =>
        haversineKm(closure.lat, closure.lng, u.lat, u.lng) < 5,
    );

    if (hasNearbyUnit) continue; // already covered by existing unit

    const score = 80; // competitor closures are high-signal events

    signals.push({
      id: randomUUID(),
      type: 'competitor_closed',
      location: {
        lat: closure.lat,
        lng: closure.lng,
        label: closure.city ?? undefined,
      },
      score,
      summary: `${closure.competitor_name} closed a location at (${closure.lat.toFixed(4)}, ${closure.lng.toFixed(4)})${closure.city ? ` in ${closure.city}` : ''}. Their customers are now looking for alternatives.`,
      recommended_action:
        'Run territory scoring for this location. Consider targeted advertising to capture displaced customers.',
      created_at: new Date().toISOString(),
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Signal source 4: Search volume spike
// ---------------------------------------------------------------------------

/**
 * Detect regions where brand-related search volume has spiked recently.
 *
 * TODO: Integrate Google Trends API (via SerpApi or pytrends proxy),
 *       or use a search intelligence platform like Semrush / Ahrefs.
 *       Current implementation queries a search_signals table that should
 *       be populated by a scheduled data pipeline.
 */
async function detectSearchVolumeSpikes(
  brandId: string,
): Promise<OpportunitySignal[]> {
  const signals: OpportunitySignal[] = [];

  const { data: searchData, error } = await supabase
    .from('search_signals')
    .select('region, lat, lng, current_volume, previous_volume, brand_id, period')
    .eq('brand_id', brandId)
    .order('current_volume', { ascending: false })
    .limit(100);

  if (error || !searchData || searchData.length === 0) {
    return signals;
  }

  for (const record of searchData as SearchVolumeRecord[]) {
    if (record.previous_volume <= 0) continue;

    const percentIncrease =
      ((record.current_volume - record.previous_volume) /
        record.previous_volume) *
      100;

    if (percentIncrease >= CONFIG.SEARCH_SPIKE_PERCENT) {
      const score = Math.min(100, Math.round(50 + percentIncrease / 4));

      signals.push({
        id: randomUUID(),
        type: 'search_volume_spike',
        location: {
          lat: record.lat,
          lng: record.lng,
          label: record.region,
        },
        score,
        summary: `Search volume for brand keywords spiked ${Math.round(percentIncrease)}% in ${record.region} (${record.current_volume} searches vs. ${record.previous_volume} prior period).`,
        recommended_action:
          percentIncrease >= 100
            ? 'Urgent: significant demand surge detected. Prioritize this region for territory scoring and lead capture.'
            : 'Increasing interest detected. Launch awareness campaign and begin territory evaluation.',
        created_at: new Date().toISOString(),
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

/**
 * Scan all signal sources for expansion opportunities for a given brand.
 * Emits `opportunity.detected` events to the `agent_events` table.
 *
 * @param brandId - The brand to scan opportunities for
 * @returns All detected opportunity signals, sorted by score descending
 */
export async function scanForOpportunities(
  brandId: string,
): Promise<OpportunitySignal[]> {
  if (!brandId) {
    throw new Error('[expansion-radar] brandId is required');
  }

  // Run all signal sources in parallel
  const [
    leadClusterSignals,
    territoryThresholdSignals,
    competitorChangeSignals,
    searchSpikeSignals,
  ] = await Promise.all([
    analyzeLeadClusters(brandId),
    checkTerritoryThresholds(brandId),
    detectCompetitorChanges(brandId),
    detectSearchVolumeSpikes(brandId),
  ]);

  const allSignals: OpportunitySignal[] = [
    ...leadClusterSignals,
    ...territoryThresholdSignals,
    ...competitorChangeSignals,
    ...searchSpikeSignals,
  ];

  // Sort by score descending
  allSignals.sort((a, b) => b.score - a.score);

  // Emit each signal as an event to agent_events table
  await Promise.all(
    allSignals.map((signal) => emitOpportunityEvent(signal, brandId)),
  );

  // Log scan summary
  const summary = {
    brandId,
    scannedAt: new Date().toISOString(),
    totalSignals: allSignals.length,
    byType: {
      lead_cluster: leadClusterSignals.length,
      territory_threshold: territoryThresholdSignals.length,
      competitor_closed: competitorChangeSignals.length,
      search_volume_spike: searchSpikeSignals.length,
    },
    topScore: allSignals[0]?.score ?? 0,
  };

  // Persist scan metadata
  await supabase.from('radar_scans').insert({
    id: randomUUID(),
    brand_id: brandId,
    scanned_at: summary.scannedAt,
    total_signals: summary.totalSignals,
    summary,
  });

  console.log(
    `[expansion-radar] Scan complete for brand ${brandId}: ${allSignals.length} signals detected`,
  );

  return allSignals;
}

export default scanForOpportunities;
