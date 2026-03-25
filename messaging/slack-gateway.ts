import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpportunitySignal {
  id: string;
  type: string;
  location: {
    city: string;
    state: string;
    lat: number;
    lng: number;
  };
  score: number;
  summary: string;
  recommended_action: string;
  created_at: string;
}

type AlertLevel = "info" | "warning" | "critical";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string; emoji?: boolean }>;
  fields?: Array<{ type: string; text: string }>;
}

// ---------------------------------------------------------------------------
// Supabase client (singleton)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL environment variable');

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getWebhookUrl(brandId: string): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("brands")
    .select("config")
    .eq("id", brandId)
    .single();

  if (error) {
    throw new Error(
      `Failed to fetch brand ${brandId}: ${error.message}`
    );
  }

  const webhookUrl: string | undefined = data?.config?.slack_webhook_url;

  if (!webhookUrl) {
    throw new Error(
      `Brand ${brandId} does not have a Slack webhook URL configured (config.slack_webhook_url).`
    );
  }

  return webhookUrl;
}

async function postToSlack(
  webhookUrl: string,
  blocks: SlackBlock[],
  text: string
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, blocks }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Slack webhook returned ${response.status}: ${body}`
    );
  }

  return { ok: true, status: response.status };
}

function levelEmoji(level: AlertLevel): string {
  switch (level) {
    case "info":
      return ":information_source:";
    case "warning":
      return ":warning:";
    case "critical":
      return ":rotating_light:";
  }
}

function levelColor(level: AlertLevel): string {
  switch (level) {
    case "info":
      return "#36a64f";
    case "warning":
      return "#ff9900";
    case "critical":
      return "#ff0000";
  }
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return ":large_green_square:".repeat(filled) + ":white_large_square:".repeat(empty);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a general alert to a brand's Slack channel.
 */
export async function sendAlert(
  brandId: string,
  message: string,
  level: AlertLevel
): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = await getWebhookUrl(brandId);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${level.toUpperCase()} Alert`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${levelEmoji(level)} *${level.toUpperCase()}*\n\n${message}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Brand: \`${brandId}\` | ${new Date().toISOString()}`,
        },
      ],
    },
  ];

  const fallbackText = `[${level.toUpperCase()}] ${message}`;
  return postToSlack(webhookUrl, blocks, fallbackText);
}

/**
 * Send an agent activity update to a brand's Slack channel.
 */
export async function sendAgentUpdate(
  brandId: string,
  agentName: string,
  action: string,
  result: string
): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = await getWebhookUrl(brandId);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: ":robot_face: Agent Update",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Agent:*\n${agentName}` },
        { type: "mrkdwn", text: `*Action:*\n${action}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Result:*\n${result}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Brand: \`${brandId}\` | ${new Date().toISOString()}`,
        },
      ],
    },
  ];

  const fallbackText = `[Agent: ${agentName}] ${action} -> ${result}`;
  return postToSlack(webhookUrl, blocks, fallbackText);
}

/**
 * Send an opportunity signal alert to a brand's Slack channel.
 */
export async function sendOpportunityAlert(
  brandId: string,
  signal: OpportunitySignal
): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = await getWebhookUrl(brandId);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: ":dart: New Opportunity Signal",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Type:*\n${signal.type}` },
        {
          type: "mrkdwn",
          text: `*Location:*\n${signal.location.city}, ${signal.location.state}`,
        },
        {
          type: "mrkdwn",
          text: `*Score:*\n${signal.score}/100  ${scoreBar(signal.score)}`,
        },
        {
          type: "mrkdwn",
          text: `*Coordinates:*\n${signal.location.lat}, ${signal.location.lng}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Summary:*\n${signal.summary}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Recommended Action:*\n${signal.recommended_action}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Signal ID: \`${signal.id}\` | Brand: \`${brandId}\` | ${signal.created_at}`,
        },
      ],
    },
  ];

  const fallbackText = `[Opportunity] ${signal.type} in ${signal.location.city}, ${signal.location.state} (score: ${signal.score})`;
  return postToSlack(webhookUrl, blocks, fallbackText);
}
