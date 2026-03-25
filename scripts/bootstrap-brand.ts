/**
 * bootstrap-brand.ts — Brand Bootstrap Script
 *
 * Creates the folder structure, template files, and Supabase records
 * needed to onboard a new franchise brand into FranchiseOS.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-brand.ts --brand=kumon --name="Kumon Learning"
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

const BRANDS_DIR = path.resolve(__dirname, "..", "brands");

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(): { brand: string; name: string } {
  const brandArg = process.argv.find((a) => a.startsWith("--brand="));
  const nameArg = process.argv.find((a) => a.startsWith("--name="));

  if (!brandArg || !nameArg) {
    console.error(
      'Usage: npx tsx scripts/bootstrap-brand.ts --brand=SLUG --name="Brand Name"'
    );
    process.exit(1);
  }

  return {
    brand: brandArg.split("=")[1],
    name: nameArg.split("=").slice(1).join("=").replace(/^"|"$/g, ""),
  };
}

// ---------------------------------------------------------------------------
// Template Generators
// ---------------------------------------------------------------------------

function brandJsonTemplate(slug: string, name: string): string {
  return JSON.stringify(
    {
      name,
      slug,
      colors: {
        primary: "#2563EB",
        secondary: "#1E40AF",
        accent: "#F59E0B",
        background: "#FFFFFF",
        text: "#111827",
      },
      voice_tone: "professional, approachable, confident",
      territory_rules: {
        min_population: 50000,
        max_radius_km: 15,
        min_school_density: 3,
        exclusive: true,
      },
      royalty_rate: 0.06,
      onboarding_checklist: [
        "Sign franchise agreement",
        "Complete brand training",
        "Set up location",
        "Configure POS system",
        "Launch local marketing",
        "Grand opening event",
        "First 30-day review",
      ],
      created_at: new Date().toISOString(),
      active: true,
    },
    null,
    2
  );
}

function brandVoiceTemplate(name: string): string {
  return `# ${name} — Brand Voice Guide

## Tone
- Professional yet approachable
- Confident without being arrogant
- Warm and encouraging
- Results-oriented

## Personality
- We are a trusted partner, not a corporate overlord
- We celebrate franchisee wins publicly
- We address challenges directly and constructively
- We use data to tell stories, not intimidate

## Dos
- Use "we" and "our" to build community
- Lead with benefits, not features
- Include specific numbers and results when available
- Address the franchisee as a business owner, not an employee
- Be concise — respect people's time

## Don'ts
- Never use jargon without explanation
- Never talk down to franchisees
- Avoid passive voice in calls to action
- Don't overpromise — set realistic expectations
- Never publicly compare franchisee performance
`;
}

function territoryRulesTemplate(): string {
  return JSON.stringify(
    {
      min_population: 50000,
      max_radius_km: 15,
      min_school_density: 3,
      overlap_policy: "exclusive",
      evaluation_criteria: [
        { factor: "population_density", weight: 0.3, min_threshold: 1000, unit: "per_sq_km" },
        { factor: "median_household_income", weight: 0.25, min_threshold: 55000, unit: "usd" },
        { factor: "school_count", weight: 0.2, min_threshold: 3, unit: "count" },
        { factor: "competitor_density", weight: 0.15, max_threshold: 5, unit: "count" },
        { factor: "growth_rate", weight: 0.1, min_threshold: 0.01, unit: "percentage" },
      ],
      scoring: { min_score_to_approve: 70, max_score: 100 },
    },
    null,
    2
  );
}

function marketingPlaybookTemplate(name: string): string {
  return `# ${name} — Marketing Playbook

## Channels
### Digital
- **Paid Search**: Google Ads targeting franchise opportunity keywords
- **Social Media**: LinkedIn for B2B, Facebook/Instagram for consumer awareness
- **Email**: Nurture sequences for leads at each funnel stage
- **Content Marketing**: Blog posts, case studies, franchisee success stories
- **SEO**: Local SEO for each territory, national brand pages

### Traditional
- **Trade Shows**: Franchise expos and industry conferences
- **Print**: Industry publications and local newspapers
- **Direct Mail**: Targeted campaigns to qualified prospects
- **Referral Program**: Existing franchisee referral incentives

## Messaging Framework
### Prospect Awareness
- Lead with the market opportunity and brand strength
- Highlight low failure rate and strong support system

### Prospect Consideration
- Share unit economics and ROI projections
- Feature franchisee testimonials and success stories

### Prospect Decision
- Provide territory availability and exclusivity details
- Outline onboarding timeline and support structure

## Campaign Cadence
- **Weekly**: Social media content, email nurture touches
- **Monthly**: Performance reports, new content assets
- **Quarterly**: Campaign strategy review, budget reallocation
- **Annually**: Brand refresh, annual marketing plan
`;
}

function growthStrategyTemplate(name: string): string {
  return JSON.stringify(
    {
      brand: name,
      target_units: { year_1: 10, year_3: 50, year_5: 150 },
      priority_markets: [
        { region: "Northeast US", priority: "high", target_units: 5, notes: "Dense population, high income demographics" },
        { region: "Southeast US", priority: "medium", target_units: 3, notes: "Growing population, lower competition" },
        { region: "West Coast US", priority: "medium", target_units: 2, notes: "High demand, premium pricing possible" },
      ],
      ideal_franchisee_persona: {
        background: ["Business management experience", "Sales or marketing background", "Community involvement"],
        financial_requirements: { min_net_worth: 500000, min_liquid_capital: 150000, currency: "USD" },
        traits: ["Entrepreneurial mindset", "Strong work ethic", "Community-oriented", "Coachable", "Financially disciplined"],
      },
      expansion_model: "concentric",
      multi_unit_target_percentage: 0.3,
    },
    null,
    2
  );
}

function idealFranchiseeTemplate(name: string): string {
  return `# ${name} — Ideal Franchisee Profile

## Background
- 5+ years of business management or ownership experience
- Track record of leading teams of 5+ people
- Sales, marketing, or operations background preferred
- College degree preferred but not required
- Experience in the brand's industry is a plus, not a requirement

## Skills
- **Leadership**: Ability to hire, train, and motivate a local team
- **Sales**: Comfortable with consultative selling and community outreach
- **Financial Management**: Can read P&L statements and manage budgets
- **Operations**: Detail-oriented with ability to follow systems
- **Communication**: Strong verbal and written communication

## Values
- **Community First**: Genuinely cares about serving the local community
- **Growth Mindset**: Committed to continuous learning and improvement
- **Brand Alignment**: Believes in the brand mission and values
- **Collaboration**: Willing to share best practices with other franchisees
- **Integrity**: Operates with transparency and ethical standards

## Financial Requirements
- Minimum net worth: $500,000
- Minimum liquid capital: $150,000
- Ability to secure financing for remaining investment
- Comfortable with 18-24 month ramp to profitability

## Red Flags
- Unwilling to follow established systems
- Purely passive investment mindset
- History of litigation with business partners
- Unrealistic financial expectations
- No connection to the local community
`;
}

// ---------------------------------------------------------------------------
// File Creation
// ---------------------------------------------------------------------------

function createBrandFiles(slug: string, name: string): string {
  const brandDir = path.join(BRANDS_DIR, slug);

  if (fs.existsSync(brandDir)) {
    console.warn(`[bootstrap] Brand directory already exists: ${brandDir}`);
    console.warn("[bootstrap] Continuing — existing files will be overwritten.");
  }

  fs.mkdirSync(brandDir, { recursive: true });

  const files: Array<{ name: string; content: string }> = [
    { name: "brand.json", content: brandJsonTemplate(slug, name) },
    { name: "brand_voice.md", content: brandVoiceTemplate(name) },
    { name: "territory_rules.json", content: territoryRulesTemplate() },
    { name: "marketing_playbook.md", content: marketingPlaybookTemplate(name) },
    { name: "growth_strategy.json", content: growthStrategyTemplate(name) },
    { name: "ideal_franchisee.md", content: idealFranchiseeTemplate(name) },
  ];

  for (const file of files) {
    const filePath = path.join(brandDir, file.name);
    fs.writeFileSync(filePath, file.content, "utf-8");
    console.log(`  Created ${filePath}`);
  }

  return brandDir;
}

// ---------------------------------------------------------------------------
// Supabase Seeding
// ---------------------------------------------------------------------------

async function seedBrandRecord(slug: string, name: string): Promise<void> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[bootstrap] SUPABASE_SERVICE_ROLE_KEY not set — skipping database seeding."
    );
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Insert brand record
  const { error: brandError } = await supabase.from("brands").upsert(
    {
      slug,
      name,
      status: "active",
      config: {
        colors: { primary: "#2563EB", secondary: "#1E40AF", accent: "#F59E0B" },
        voice_tone: "professional, approachable, confident",
        royalty_rate: 0.06,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" }
  );

  if (brandError) {
    console.error("[bootstrap] Failed to insert brand record:", brandError.message);
  } else {
    console.log(`  Inserted brand record into Supabase (slug="${slug}")`);
  }

  // Resolve brand_id for territory insertion
  const { data: brandRow } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!brandRow) {
    console.error("[bootstrap] Could not resolve brand_id for territory seeding.");
    return;
  }

  // Seed one example territory
  const { error: territoryError } = await supabase.from("territories").insert({
    brand_id: brandRow.id,
    name: `${name} — Downtown Metro`,
    region: "Example Region",
    status: "open",
    score: 82,
    grade: "A",
    geo_data: {
      center: { lat: 40.7128, lng: -74.006 },
      radius_km: 12,
      city: "Metro",
      state: "NY",
      country: "US",
    },
    demographics: {
      population: 125000,
      households: 45000,
      median_income: 72000,
      school_count: 14,
      family_density_score: 78,
      school_density_score: 72,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (territoryError) {
    console.error("[bootstrap] Failed to seed territory:", territoryError.message);
  } else {
    console.log(`  Seeded example territory "Downtown Metro" for brand="${slug}"`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { brand, name } = parseArgs();

  console.log("===================================================");
  console.log(`  FranchiseOS — Brand Bootstrap`);
  console.log(`  Brand Slug: ${brand}`);
  console.log(`  Brand Name: ${name}`);
  console.log("===================================================");
  console.log();

  console.log("[bootstrap] Creating brand directory and template files...");
  const brandDir = createBrandFiles(brand, name);
  console.log();

  console.log("[bootstrap] Seeding Supabase records...");
  await seedBrandRecord(brand, name);
  console.log();

  console.log("===================================================");
  console.log("  Setup complete!");
  console.log("===================================================");
  console.log();
  console.log("Next steps:");
  console.log(`  1. Review and customize files in ${brandDir}`);
  console.log(`  2. Update brand.json with actual brand colors and settings`);
  console.log(`  3. Edit brand_voice.md to match the brand's tone`);
  console.log(`  4. Configure territory_rules.json for real market criteria`);
  console.log(`  5. Start the swarm: npx tsx scripts/start-swarm.ts --brand=${brand}`);
  console.log();
}

main().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});
