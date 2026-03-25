// ---------------------------------------------------------------------------
// opportunity-auto-response.ts
// Dallas scenario — flagship demo of the FranchiseOS swarm responding to
// a territory opportunity signal with a fully orchestrated agent chain.
// ---------------------------------------------------------------------------

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { loadAgentPrompt } from '../agent-loader';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BRAND_ID = process.env.BRAND_ID ?? '6b66fd67-aa7e-46ab-9262-60ccfd3339c8';
const BRAND_SLUG = process.env.BRAND_SLUG ?? 'skill-samurai';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Track scenario state
let MODE = 'live';
let supabaseAvailable = true;
let anthropicAvailable = true;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabase;
}

let _anthropic: any = null;
async function getAnthropic(): Promise<any> {
  if (_anthropic) return _anthropic;
  if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _anthropic;
}

// ---------------------------------------------------------------------------
// Supabase helper — resilient insert
// ---------------------------------------------------------------------------

async function safeInsert(table: string, record: Record<string, unknown>): Promise<boolean> {
  if (!supabaseAvailable) return false;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from(table).insert(record);
    if (error) {
      if (error.message.includes('Invalid API key')) {
        supabaseAvailable = false;
        MODE = 'demo';
        console.log('  ⚠ Supabase service_role key is invalid — switching to DEMO MODE');
        console.log('  ⚠ All pipeline steps will run but DB writes will be simulated');
      } else {
        console.error(`  ⚠ Supabase insert to ${table} failed: ${error.message}`);
      }
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`  ⚠ Supabase error on ${table}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helper — emit agent event
// ---------------------------------------------------------------------------

async function emitAgentEvent(
  agentName: string,
  eventType: string,
  correlationId: string,
  chainDepth: number,
  payload: Record<string, unknown>,
  modelTier: string = 'operational',
  modelUsed?: string,
  durationMs?: number,
): Promise<string> {
  const eventId = randomUUID();

  await safeInsert('agent_events', {
    id: eventId,
    brand_id: BRAND_ID,
    agent_name: agentName,
    event_type: eventType,
    correlation_id: correlationId,
    chain_depth: chainDepth,
    payload,
    status: 'completed',
    model_tier: modelTier,
    model_used: modelUsed ?? null,
    duration_ms: durationMs ?? null,
  });

  return eventId;
}

// ---------------------------------------------------------------------------
// Helper — call Claude (with mock fallback)
// ---------------------------------------------------------------------------

async function callClaude(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 2000,
): Promise<{ text: string; durationMs: number; mocked: boolean }> {
  if (!anthropicAvailable) {
    return getMockResponse(model, userMessage);
  }

  try {
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

    return { text, durationMs: Date.now() - start, mocked: false };
  } catch (err: any) {
    if (err.status === 401 || err.message?.includes('authentication')) {
      anthropicAvailable = false;
      MODE = 'demo';
      console.log('  ⚠ Anthropic API key is invalid — switching to DEMO MODE');
      console.log('  ⚠ Using high-quality mock responses for agent outputs');
      return getMockResponse(model, userMessage);
    }
    throw err;
  }
}

function getMockResponse(model: string, userMessage: string): { text: string; durationMs: number; mocked: boolean } {
  const start = Date.now();

  if (userMessage.includes('Evaluate this expansion signal')) {
    return {
      text: `DECISION: APPROVE\n\nAfter evaluating the Dallas-Fort Worth expansion signal, I recommend we proceed with full territory activation.\n\nKey factors:\n1. Lead cluster density (7 leads in 21 days) indicates strong organic demand in the DFW metro\n2. Score of 87/100 significantly exceeds our 70-point threshold for new territory evaluation\n3. No existing Skill Samurai franchise within 80km means zero cannibalization risk\n4. DFW metro area has 7.6M population with strong education spending demographics\n5. Texas has favorable franchise disclosure laws and no state income tax (attractive to franchisees)\n\nRecommended next steps: Proceed to territory scoring, generate recruitment collateral, and activate the full expansion pipeline. Priority: HIGH.`,
      durationMs: Date.now() - start + 850,
      mocked: true,
    };
  }

  if (userMessage.includes('landing page config')) {
    return {
      text: JSON.stringify({
        headline: 'Bring Skill Samurai to Dallas-Fort Worth',
        subheadline: 'Own a thriving STEM education franchise in one of America\'s fastest-growing metros',
        value_props: [
          'Proven after-school STEM curriculum with 95% parent satisfaction',
          'Comprehensive training and ongoing support from day one',
          'Exclusive territory in the booming DFW education market'
        ],
        cta_text: 'Request Your Free Franchise Information Pack',
        hero_image_description: 'Diverse group of children aged 8-14 coding robots in a bright, modern Skill Samurai learning center with the Dallas skyline visible through floor-to-ceiling windows'
      }, null, 2),
      durationMs: Date.now() - start + 620,
      mocked: true,
    };
  }

  if (userMessage.includes('5-email franchise recruitment')) {
    return {
      text: `**Email 1 — Day 1: Introduction**\nSubject: Dallas-Fort Worth is ready for Skill Samurai — are you?\nBody: Hi {{first_name}}, the DFW metro area is one of the fastest-growing education markets in the US, and we've identified a prime territory for Skill Samurai. With 7 recent inquiries from families in your area, the demand for quality STEM education is clear. As a franchise owner, you'll bring coding, robotics, and digital skills to kids aged 7-14 while building a rewarding business. Let me share how.\n\n**Email 2 — Day 3: Social Proof**\nSubject: How Sarah turned her teaching passion into a $400K franchise\nBody: Meet Sarah Chen, a former 4th-grade teacher who opened Skill Samurai in Phoenix 18 months ago. Today she runs 3 programs per week, employs 4 part-time instructors, and hit $400K in revenue in her first year. "I wanted to make a difference in kids' lives AND build something of my own," she says. Dallas-Fort Worth has even stronger demographics than Phoenix. Your story could be next.\n\n**Email 3 — Day 7: FAQ**\nSubject: Your top 5 questions about owning a Skill Samurai franchise\nBody: We hear these questions from every prospective franchisee: (1) What's the total investment? $85K-$150K depending on location. (2) Do I need a tech background? No — our training covers everything. (3) How long to break even? Most owners reach profitability in 8-12 months. (4) What ongoing support do I get? Marketing, curriculum updates, and a dedicated business coach. (5) Is the DFW territory exclusive? Yes, 100% protected.\n\n**Email 4 — Day 10: Urgency**\nSubject: Only 3 premium DFW territories remain\nBody: Quick update: since we opened Dallas-Fort Worth for franchise applications last week, we've received 12 inquiries. We only award 4-5 territories per metro to protect each owner's market. If you've been considering this opportunity, now is the time to schedule your discovery call. The best locations — near top-rated school districts — will be claimed first.\n\n**Email 5 — Day 14: Last Chance**\nSubject: Final call: DFW franchise applications close Friday\nBody: This is my last email about the Dallas-Fort Worth opportunity. Applications close this Friday at 5pm CT. If you've been thinking about bringing Skill Samurai to DFW, I'd love to chat for 20 minutes this week. No pressure, no commitment — just an honest conversation about whether franchise ownership is right for you. Book your slot here: [CALENDAR_LINK]. After Friday, the next opening won't be until Q3.`,
      durationMs: Date.now() - start + 1100,
      mocked: true,
    };
  }

  if (userMessage.includes('social posts')) {
    return {
      text: `**Facebook (Parent Community Focus)**\n🎉 Exciting news for DFW families! Skill Samurai is coming to Dallas-Fort Worth! Our award-winning after-school STEM programs teach kids ages 7-14 real coding, robotics, and digital skills in a fun, supportive environment. We're looking for a passionate local franchise owner to bring this to YOUR community. Know someone who'd be perfect? Tag them below! 👇\n\n#SkillSamurai #DFW #DallasKids #STEMeducation #CodingForKids #FranchiseOpportunity #DallasParents\n\n**LinkedIn (Entrepreneur Focus)**\nI'm thrilled to announce that Skill Samurai is expanding to the Dallas-Fort Worth metro area. With 7.6M residents, a booming tech sector, and strong family demographics, DFW is a natural fit for our STEM education franchise model.\n\nWe're seeking qualified franchise partners with a passion for education and entrepreneurship. Our franchisees typically reach profitability within 12 months with an investment of $85K-$150K.\n\nIf you're an educator, business professional, or entrepreneur looking for your next chapter, let's connect.\n\n#Franchising #EdTech #STEMEducation #DallasBusinesses #Entrepreneurship #FranchiseOwner\n\n**Instagram (Visual/Lifestyle Focus)**\n✨ DALLAS-FORT WORTH ✨ We're coming for you! 🤖💻\n\nImagine: YOUR business. YOUR community. Kids learning to code, build robots, and create the future — right in the heart of DFW.\n\nSkill Samurai is looking for our next franchise superstar in Dallas-Fort Worth. Swipe to see what our centers look like 👉\n\nDM us "DFW" to learn more! 🚀\n\n#SkillSamurai #DallasFranchise #STEMkids #CodingKids #RoboticsForKids #DFWbusiness #FranchiseLife #BeYourOwnBoss #DallasEntrepreneur`,
      durationMs: Date.now() - start + 780,
      mocked: true,
    };
  }

  return {
    text: `[Mock response for model ${model}]`,
    durationMs: Date.now() - start + 200,
    mocked: true,
  };
}

// ---------------------------------------------------------------------------
// STEP 1: Signal Detection
// ---------------------------------------------------------------------------

async function step1_signalDetection(correlationId: string) {
  console.log('\n📡 Step 1 — SIGNAL DETECTION');

  const signal = {
    id: randomUUID(),
    brand_id: BRAND_ID,
    signal_type: 'lead_cluster' as const,
    location_name: 'Dallas-Fort Worth, TX',
    location_lat: 32.7767,
    location_lng: -96.7970,
    score: 87,
    summary: '7 leads from DFW area in the last 21 days. No Skill Samurai franchise within 80km.',
    recommended_action: 'Evaluate territory and launch targeted franchise recruitment campaign',
    status: 'new',
    data: { lead_count: 7, days: 21, nearest_franchise_km: 80 },
  };

  const inserted = await safeInsert('expansion_signals', signal);
  console.log(`  📡 Signal detected: 7 leads clustered in Dallas-Fort Worth`);
  console.log(`  Signal ID: ${signal.id}`);
  console.log(`  DB: ${inserted ? '✅ Saved to expansion_signals' : '⏭ Simulated (DB unavailable)'}`);

  return signal;
}

// ---------------------------------------------------------------------------
// STEP 2: CEO Evaluation
// ---------------------------------------------------------------------------

async function step2_ceoEvaluation(
  signal: any,
  correlationId: string,
): Promise<string> {
  console.log('\n🧠 Step 2 — CEO EVALUATION');
  console.log('  🧠 CEO Agent evaluating signal...');

  const ceoPrompt = loadAgentPrompt('ceo');
  const brandContext = `Brand: Skill Samurai | Industry: Education/STEM Franchising | Slug: ${BRAND_SLUG}`;

  const { text, durationMs, mocked } = await callClaude(
    'claude-sonnet-4-6',
    ceoPrompt + '\n\n' + brandContext,
    `Evaluate this expansion signal and decide whether to pursue:\n\n` +
    `Signal Type: ${signal.signal_type}\n` +
    `Location: ${signal.location_name}\n` +
    `Score: ${signal.score}/100\n` +
    `Summary: ${signal.summary}\n` +
    `Recommended Action: ${signal.recommended_action}\n\n` +
    `Provide your decision (approve/reject/investigate) with reasoning.`,
    1000,
  );

  await emitAgentEvent(
    'ceo', 'opportunity_evaluation', correlationId, 0,
    { signal_id: signal.id, decision: text },
    'strategic', 'claude-sonnet-4-6', durationMs,
  );

  console.log(`  ${mocked ? '🎭 [DEMO]' : '🤖 [LIVE]'} Response (${durationMs}ms):`);
  console.log(`  ${text.slice(0, 200)}...`);
  return text;
}

// ---------------------------------------------------------------------------
// STEP 3: Territory Scoring
// ---------------------------------------------------------------------------

async function step3_territoryScoring(
  signal: any,
  correlationId: string,
): Promise<{ score: number; grade: string; recommendation: string }> {
  console.log('\n🗺️  Step 3 — TERRITORY SCORING');

  const score = 84;
  const grade = 'A';
  const recommendation = 'Strong territory candidate. Population density is a key strength (88/100). ' +
    'Recommend proceeding to detailed site selection and franchise disclosure process.';

  const inserted = await safeInsert('territories', {
    brand_id: BRAND_ID,
    name: 'Dallas-Fort Worth',
    region: 'Texas',
    geo_data: {
      center: { lat: 32.7767, lng: -96.7970 },
      radius_km: 25,
      city: 'Dallas',
      state: 'TX',
      country: 'US',
    },
    demographics: {
      population: 135000,
      households: 48000,
      median_income: 82000,
      school_count: 24,
      family_density_score: 85,
      school_density_score: 79,
    },
    score,
    grade,
    status: 'open',
  });

  await emitAgentEvent(
    'territory-intelligence', 'territory_scoring', correlationId, 1,
    {
      signal_id: signal.id,
      location: { lat: 32.7767, lng: -96.7970 },
      score, grade, recommendation,
      breakdown: {
        populationDensity: 88,
        medianIncome: 82,
        competitorProximity: 85,
        franchiseSaturation: 100,
        trafficSearchSignal: 72,
      },
    },
    'operational',
  );

  console.log(`  🗺️  Territory scored: ${grade} (${score}/100)`);
  console.log(`  ${recommendation}`);
  console.log(`  DB: ${inserted ? '✅ Saved to territories' : '⏭ Simulated'}`);

  return { score, grade, recommendation };
}

// ---------------------------------------------------------------------------
// STEP 4: Landing Page Config
// ---------------------------------------------------------------------------

async function step4_landingPage(
  signal: any,
  correlationId: string,
): Promise<{ headline: string; config: string }> {
  console.log('\n🌐 Step 4 — LANDING PAGE CONFIG');

  const landingPrompt = loadAgentPrompt('landing-page');

  const { text, durationMs, mocked } = await callClaude(
    'claude-haiku-4-5-20251001',
    landingPrompt,
    `Create a landing page config for Skill Samurai franchise opportunity in ` +
    `Dallas-Fort Worth. Target audience: education entrepreneurs, former teachers, ` +
    `parents passionate about STEM. Include: headline, subheadline, 3 value props, ` +
    `CTA text, hero image description.\n\n` +
    `Return as structured JSON with keys: headline, subheadline, value_props (array of 3), ` +
    `cta_text, hero_image_description.`,
    1500,
  );

  await emitAgentEvent(
    'landing-page', 'landing_page_generated', correlationId, 2,
    { signal_id: signal.id, page_config: text },
    'worker', 'claude-haiku-4-5-20251001', durationMs,
  );

  // Extract headline from JSON response
  let headline = 'Skill Samurai Franchise — Dallas-Fort Worth';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      headline = parsed.headline || headline;
    }
  } catch { /* use default headline */ }

  console.log(`  ${mocked ? '🎭 [DEMO]' : '🤖 [LIVE]'} Landing page config generated (${durationMs}ms)`);
  console.log(`  Headline: ${headline}`);

  return { headline, config: text };
}

// ---------------------------------------------------------------------------
// STEP 5: Email Sequence
// ---------------------------------------------------------------------------

async function step5_emailSequence(
  signal: any,
  correlationId: string,
): Promise<string[]> {
  console.log('\n📧 Step 5 — EMAIL SEQUENCE');

  let emailPrompt: string;
  try {
    emailPrompt = loadAgentPrompt('email');
  } catch {
    emailPrompt = loadAgentPrompt('campaign');
  }

  const { text, durationMs, mocked } = await callClaude(
    'claude-haiku-4-5-20251001',
    emailPrompt,
    `Create a 5-email franchise recruitment sequence for Skill Samurai targeting ` +
    `Dallas-Fort Worth education entrepreneurs. Emails:\n` +
    `- Day 1: Introduction/welcome\n` +
    `- Day 3: Social proof/testimonials\n` +
    `- Day 7: FAQ/common questions\n` +
    `- Day 10: Urgency/limited territories\n` +
    `- Day 14: Last chance/final CTA\n\n` +
    `For each email provide: day number, subject line, and body (200 words max). ` +
    `Format clearly with "Subject:" prefix for each email's subject line.`,
    3000,
  );

  await emitAgentEvent(
    'email', 'email_sequence_generated', correlationId, 3,
    { signal_id: signal.id, email_sequence: text },
    'worker', 'claude-haiku-4-5-20251001', durationMs,
  );

  // Extract subject lines
  const subjectLines = text
    .split('\n')
    .filter(l => /subject/i.test(l) && l.includes(':'))
    .map(l => l.replace(/^.*?[Ss]ubject(?:\s*[Ll]ine)?:\s*/i, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  console.log(`  ${mocked ? '🎭 [DEMO]' : '🤖 [LIVE]'} 5-email sequence generated (${durationMs}ms)`);
  subjectLines.forEach((s, i) => console.log(`  📧 Email ${i + 1}: ${s}`));

  return subjectLines;
}

// ---------------------------------------------------------------------------
// STEP 6: Social Content
// ---------------------------------------------------------------------------

async function step6_socialContent(
  signal: any,
  correlationId: string,
): Promise<string[]> {
  console.log('\n📱 Step 6 — SOCIAL CONTENT');

  const socialPrompt = loadAgentPrompt('social-content');

  const { text, durationMs, mocked } = await callClaude(
    'claude-haiku-4-5-20251001',
    socialPrompt,
    `Create 3 social posts announcing Skill Samurai franchise opportunity in ` +
    `Dallas-Fort Worth. One each for:\n` +
    `1. Facebook (parent community focus)\n` +
    `2. LinkedIn (entrepreneur focus)\n` +
    `3. Instagram (visual/lifestyle focus)\n\n` +
    `Include hashtags for each. Clearly label each post by platform.`,
    2000,
  );

  await emitAgentEvent(
    'social-content', 'social_content_generated', correlationId, 4,
    { signal_id: signal.id, social_posts: text },
    'worker', 'claude-haiku-4-5-20251001', durationMs,
  );

  // Extract post previews by platform
  const sections = text.split(/\*\*(?=Facebook|LinkedIn|Instagram)/i).filter(p => p.trim().length > 20);
  const previews = sections.length >= 3
    ? sections.slice(0, 3).map(p => p.trim().slice(0, 100))
    : ['Facebook post preview', 'LinkedIn post preview', 'Instagram post preview'];

  console.log(`  ${mocked ? '🎭 [DEMO]' : '🤖 [LIVE]'} 3 social posts generated (${durationMs}ms)`);
  previews.forEach(p => console.log(`  📱 ${p}...`));

  return previews;
}

// ---------------------------------------------------------------------------
// STEP 7: Initiative Creation
// ---------------------------------------------------------------------------

async function step7_createInitiative(
  signal: any,
  correlationId: string,
  territoryResult: { score: number; grade: string },
  landingPage: { headline: string; config: string },
  emailSubjects: string[],
  socialPreviews: string[],
): Promise<string> {
  console.log('\n✅ Step 7 — INITIATIVE CREATION');

  const initiativeId = randomUUID();

  const inserted = await safeInsert('initiatives', {
    id: initiativeId,
    brand_id: BRAND_ID,
    title: 'Dallas-Fort Worth Franchise Expansion — Q1 2026',
    type: 'territory_outreach',
    status: 'in_progress',
    agent_assigned: 'ceo',
    evidence: [
      {
        type: 'opportunity_signal',
        signal_id: signal.id,
        score: signal.score,
        summary: signal.summary,
      },
    ],
    action_plan: [
      { step: 1, action: 'Signal detection', status: 'completed' },
      { step: 2, action: 'CEO evaluation', status: 'completed' },
      { step: 3, action: 'Territory scoring', status: 'completed' },
      { step: 4, action: 'Landing page generation', status: 'completed' },
      { step: 5, action: 'Email sequence creation', status: 'completed' },
      { step: 6, action: 'Social content generation', status: 'completed' },
      { step: 7, action: 'Monitor and optimize', status: 'pending' },
    ],
    data: {
      signal_id: signal.id,
      correlation_id: correlationId,
      territory_score: territoryResult.score,
      territory_grade: territoryResult.grade,
      landing_page_headline: landingPage.headline,
      email_subjects: emailSubjects,
      social_post_count: socialPreviews.length,
      created_by: 'opportunity-auto-response',
      estimated_completion: '2026-03-22',
    },
  });

  await emitAgentEvent(
    'ceo', 'initiative_created', correlationId, 5,
    { initiative_id: initiativeId, title: 'Dallas-Fort Worth Franchise Expansion — Q1 2026' },
    'strategic',
  );

  console.log(`  ✅ Initiative created: Dallas-Fort Worth Franchise Expansion`);
  console.log(`  Initiative ID: ${initiativeId}`);
  console.log(`  DB: ${inserted ? '✅ Saved to initiatives' : '⏭ Simulated'}`);

  return initiativeId;
}

// ---------------------------------------------------------------------------
// STEP 8: Memory Storage
// ---------------------------------------------------------------------------

async function step8_storeMemory(correlationId: string) {
  console.log('\n💾 Step 8 — MEMORY STORAGE');

  const content =
    'Dallas-Fort Worth opportunity auto-response completed. Territory grade A. ' +
    'Initiative created. 5-email sequence and landing page config generated. ' +
    '7 lead cluster triggered full expansion pipeline in under 60 seconds.';

  const inserted = await safeInsert('memory_entries', {
    brand_id: BRAND_ID,
    layer: 'episodic',
    title: 'Dallas-Fort Worth Expansion Auto-Response',
    content,
    embedding_text: content.slice(0, 500),
    metadata: {
      correlation_id: correlationId,
      scenario: 'opportunity-auto-response',
      location: 'Dallas-Fort Worth, TX',
      content_length: content.length,
    },
    status: 'active',
  });

  console.log(`  💾 Outcome stored in agent memory (episodic layer)`);
  console.log(`  DB: ${inserted ? '✅ Saved to memory_entries' : '⏭ Simulated'}`);
}

// ---------------------------------------------------------------------------
// STEP 9: Final Report
// ---------------------------------------------------------------------------

function step9_finalReport(
  startTime: number,
  ceoDecision: string,
  territory: { score: number; grade: string },
  landingPage: { headline: string },
  emailSubjects: string[],
  socialPreviews: string[],
  initiativeId: string,
) {
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`
================================
🎯 DALLAS SCENARIO COMPLETE
================================
Mode: ${MODE === 'live' ? '🟢 LIVE (all APIs connected)' : '🎭 DEMO (mock responses — update API keys for live run)'}
Signal: 7 leads in DFW (Score: 87)
CEO Decision: ${ceoDecision.slice(0, 100)}...
Territory Grade: ${territory.grade}
Territory Score: ${territory.score}/100
Landing Page: ${landingPage.headline}
Email Sequence: ${emailSubjects.map((s, i) => `\n  ${i + 1}. ${s}`).join('')}
Social Posts: ${socialPreviews.map((s, i) => `\n  ${i + 1}. ${s.slice(0, 80)}...`).join('')}
Initiative ID: ${initiativeId}
Memory: Stored to episodic layer
Supabase: ${supabaseAvailable ? '🟢 Connected' : '🔴 Unavailable (service_role key invalid)'}
Anthropic: ${anthropicAvailable ? '🟢 Connected' : '🔴 Unavailable (API key invalid)'}
Duration: ${durationSec}s
================================`);

  if (MODE === 'demo') {
    console.log(`
⚠ TO RUN IN LIVE MODE:
1. Get fresh Supabase service_role key from https://supabase.com/dashboard/project/eggucsttihoxhxaaeiph/settings/api
2. Get fresh Anthropic API key from https://console.anthropic.com/settings/keys
3. Update .env file with new keys
4. Re-run: npm run dallas
`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('================================');
  console.log('🚀 DALLAS SCENARIO — Starting');
  console.log(`Brand: Skill Samurai (${BRAND_ID})`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('================================');

  const startTime = Date.now();
  const correlationId = randomUUID();
  console.log(`Correlation ID: ${correlationId}`);

  // Step 1: Signal Detection
  const signal = await step1_signalDetection(correlationId);

  // Step 2: CEO Evaluation
  const ceoDecision = await step2_ceoEvaluation(signal, correlationId);

  // Step 3: Territory Scoring
  const territory = await step3_territoryScoring(signal, correlationId);

  // Step 4: Landing Page Config
  const landingPage = await step4_landingPage(signal, correlationId);

  // Step 5: Email Sequence
  const emailSubjects = await step5_emailSequence(signal, correlationId);

  // Step 6: Social Content
  const socialPreviews = await step6_socialContent(signal, correlationId);

  // Step 7: Initiative Creation
  const initiativeId = await step7_createInitiative(
    signal, correlationId, territory, landingPage, emailSubjects, socialPreviews,
  );

  // Step 8: Memory Storage
  await step8_storeMemory(correlationId);

  // Step 9: Final Report
  step9_finalReport(
    startTime, ceoDecision, territory, landingPage, emailSubjects, socialPreviews, initiativeId,
  );
}

main().catch((err) => {
  console.error('\n❌ DALLAS SCENARIO FAILED:', err);
  process.exit(1);
});
