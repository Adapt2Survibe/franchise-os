import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyWebhookPayload(
  req: NextRequest
): Promise<Record<string, unknown> | null> {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null;
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return null;
  }

  try {
    const body = await req.text();
    const wh = new Webhook(secret);
    const payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return payload as Record<string, unknown>;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Verify webhook signature and extract payload
  const event = await verifyWebhookPayload(req);
  if (!event) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabase();
    const { type, data } = event as { type: string; data: Record<string, unknown> };

    switch (type) {
      case "organization.created": {
        const { id: clerkOrgId, name, slug } = data as { id: string; name?: string; slug?: string };

        const { error } = await supabase.from("brands").insert({
          clerk_org_id: clerkOrgId,
          name: name ?? slug ?? "Untitled Brand",
          slug: slug ?? null,
          config: {},
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Error creating brand from webhook:", error);
          return NextResponse.json(
            { error: "Failed to create brand" },
            { status: 500 }
          );
        }

        console.log(`Brand created for Clerk org ${clerkOrgId}: ${name}`);
        break;
      }

      case "organization.updated": {
        const { id: clerkOrgId, name, public_metadata } = data as { id: string; name?: string; public_metadata?: Record<string, unknown> };

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (name) updatePayload.name = name;
        if (public_metadata) updatePayload.config = public_metadata;

        const { error } = await supabase
          .from("brands")
          .update(updatePayload)
          .eq("clerk_org_id", clerkOrgId);

        if (error) {
          console.error("Error updating brand from webhook:", error);
          return NextResponse.json(
            { error: "Failed to update brand" },
            { status: 500 }
          );
        }

        console.log(`Brand updated for Clerk org ${clerkOrgId}`);
        break;
      }

      case "organizationMembership.created": {
        const { organization, public_user_data, role } = data as {
          organization?: { id: string };
          public_user_data?: { identifier?: string };
          role?: string;
        };

        console.log(
          `New membership: user ${public_user_data?.identifier ?? "unknown"} joined org ${organization?.id ?? "unknown"} as ${role}`
        );

        // Optionally log to agent_events for audit trail
        if (organization?.id) {
          const { data: brand } = await supabase
            .from("brands")
            .select("id")
            .eq("clerk_org_id", organization.id)
            .single();

          if (brand) {
            await supabase.from("agent_events").insert({
              brand_id: brand.id,
              agent_name: "system",
              event_type: "membership_created",
              payload: {
                user_identifier: public_user_data?.identifier,
                role,
                clerk_org_id: organization.id,
              },
              status: "completed",
              created_at: new Date().toISOString(),
            });
          }
        }

        break;
      }

      default:
        console.log(`Unhandled Clerk webhook event type: ${type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
