import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook event types
type ResendEventType = 
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked";

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Bounce specific
    bounce?: {
      type: "hard" | "soft";
      message: string;
    };
    // Click specific
    click?: {
      link: string;
      timestamp: string;
    };
    // Open specific
    open?: {
      timestamp: string;
      raw_user_agent: string;
    };
    // Complaint specific
    complaint?: {
      type: string;
      user_agent: string;
    };
    // Custom headers/tags we set when sending
    headers?: Record<string, string>;
    tags?: Record<string, string>;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the webhook payload
    const event: ResendWebhookEvent = await req.json();
    console.log("Received email webhook event:", JSON.stringify(event, null, 2));

    const eventType = event.type;
    const emailData = event.data;
    const recipientEmail = emailData.to[0]; // First recipient

    // Extract campaign_id and recipient_id from tags if available
    const campaignId = emailData.tags?.campaign_id || emailData.headers?.["X-Campaign-ID"];
    const recipientId = emailData.tags?.recipient_id || emailData.headers?.["X-Recipient-ID"];

    // Find the email log entry
    let emailLogQuery = supabase
      .from("email_logs")
      .select("id, campaign_id")
      .eq("email", recipientEmail);

    if (campaignId) {
      emailLogQuery = emailLogQuery.eq("campaign_id", campaignId);
    }

    const { data: emailLog } = await emailLogQuery.order("created_at", { ascending: false }).limit(1).single();

    const effectiveCampaignId = campaignId || emailLog?.campaign_id;

    // Store the event in email_events table
    const eventRecord = {
      email_log_id: emailLog?.id || null,
      campaign_id: effectiveCampaignId || null,
      email: recipientEmail,
      event_type: eventType,
      provider: "resend",
      provider_event_id: emailData.email_id,
      payload: emailData,
      bounce_type: emailData.bounce?.type || null,
      bounce_reason: emailData.bounce?.message || null,
      complaint_type: emailData.complaint?.type || null,
    };

    const { data: insertedEvent, error: insertError } = await supabase
      .from("email_events")
      .insert(eventRecord)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting email event:", insertError);
    }

    // Update email_logs based on event type
    if (emailLog?.id) {
      const now = new Date().toISOString();

      switch (eventType) {
        case "email.sent":
          await supabase
            .from("email_logs")
            .update({ status: "sent", sent_at: now })
            .eq("id", emailLog.id);
          break;

        case "email.delivered":
          await supabase
            .from("email_logs")
            .update({ status: "delivered", delivered_at: now })
            .eq("id", emailLog.id);
          break;

        case "email.opened":
          await supabase
            .from("email_logs")
            .update({ status: "opened", opened_at: now })
            .eq("id", emailLog.id);
          // Update contact engagement
          await updateContactEngagement(supabase, effectiveCampaignId, recipientEmail);
          break;

        case "email.clicked":
          await supabase
            .from("email_logs")
            .update({ status: "clicked", clicked_at: now })
            .eq("id", emailLog.id);
          // Update contact engagement
          await updateContactEngagement(supabase, effectiveCampaignId, recipientEmail);
          break;

        case "email.bounced":
          await supabase
            .from("email_logs")
            .update({
              status: "bounced",
              bounced_at: now,
              bounce_type: emailData.bounce?.type || "unknown",
              error_message: emailData.bounce?.message || "Email bounced",
            })
            .eq("id", emailLog.id);

          // Auto-suppress on hard bounce
          if (emailData.bounce?.type === "hard" && effectiveCampaignId) {
            await suppressContact(
              supabase,
              effectiveCampaignId,
              recipientEmail,
              "hard_bounce",
              emailData.bounce?.type,
              null,
              insertedEvent?.id,
              emailData.bounce?.message
            );
          }
          break;

        case "email.complained":
          await supabase
            .from("email_logs")
            .update({
              status: "failed",
              complaint_at: now,
              complaint_type: emailData.complaint?.type || "unknown",
              error_message: "Recipient marked email as spam",
            })
            .eq("id", emailLog.id);

          // Auto-suppress on spam complaint
          if (effectiveCampaignId) {
            await suppressContact(
              supabase,
              effectiveCampaignId,
              recipientEmail,
              "complaint",
              null,
              emailData.complaint?.type || null,
              insertedEvent?.id,
              "Recipient marked email as spam"
            );
          }
          break;

        case "email.delivery_delayed":
          console.log(`Delivery delayed for ${recipientEmail}`);
          break;
      }
    }

    // Trigger automations if applicable
    if (effectiveCampaignId) {
      await triggerAutomations(supabase, eventType, effectiveCampaignId, recipientEmail, insertedEvent?.id);
    }

    return new Response(
      JSON.stringify({ success: true, event_id: insertedEvent?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Email webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function suppressContact(
  supabase: any,
  campaignId: string,
  email: string,
  reason: "hard_bounce" | "soft_bounce" | "complaint" | "unsubscribe" | "manual",
  bounceType: string | null,
  complaintType: string | null,
  sourceEventId: string | undefined | null,
  notes: string | undefined | null
) {
  try {
    // Get campaign owner
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("user_id")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      console.error("Campaign not found for suppression");
      return;
    }

    // Add to suppression list (upsert to avoid duplicates)
    const { error: suppressError } = await supabase
      .from("suppression_list")
      .upsert({
        user_id: campaign.user_id,
        email: email.toLowerCase(),
        reason,
        source_campaign_id: campaignId,
        source_event_id: sourceEventId,
        bounce_type: bounceType,
        complaint_type: complaintType,
        notes,
        suppressed_at: new Date().toISOString(),
      }, { onConflict: "user_id,email" });

    if (suppressError) {
      console.error("Error adding to suppression list:", suppressError);
      return;
    }

    console.log(`Contact ${email} suppressed: ${reason}`);

    // Also update the contact if it exists
    await supabase
      .from("contacts")
      .update({
        suppressed: true,
        suppressed_at: new Date().toISOString(),
        suppression_reason: reason,
      })
      .eq("user_id", campaign.user_id)
      .eq("email", email.toLowerCase());

  } catch (error) {
    console.error("Error in suppressContact:", error);
  }
};

// Update contact engagement when they interact with emails
async function updateContactEngagement(
  supabase: any,
  campaignId: string | null | undefined,
  email: string
) {
  if (!campaignId) return;

  try {
    // Get campaign owner
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("user_id")
      .eq("id", campaignId)
      .single();

    if (!campaign) return;

    const now = new Date().toISOString();

    // Update contact's engagement data
    await supabase
      .from("contacts")
      .update({
        last_engaged_at: now,
        engagement_score: 100, // Reset to full score on engagement
        status: "active",
        inactive_since: null,
        reengagement_attempts: 0, // Reset re-engagement attempts
      })
      .eq("user_id", campaign.user_id)
      .eq("email", email.toLowerCase());

    // Also update any pending re-engagement campaigns
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", campaign.user_id)
      .eq("email", email.toLowerCase())
      .single();

    if (contact) {
      await supabase
        .from("re_engagement_campaigns")
        .update({
          status: "clicked",
          clicked_at: now
        })
        .eq("contact_id", contact.id)
        .in("status", ["pending", "sent"]);
    }

    console.log(`Contact engagement updated for ${email}`);
  } catch (error) {
    console.error("Error updating contact engagement:", error);
  }
}

async function triggerAutomations(
  supabase: any,
  eventType: string,
  campaignId: string,
  email: string,
  eventId?: string
) {
  // Map Resend events to automation triggers
  const triggerMap: Record<string, string> = {
    "email.opened": "email_opened",
    "email.clicked": "link_clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivered": "delivered",
  };

  const triggerType = triggerMap[eventType];
  if (!triggerType) return;

  // Get campaign owner
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("user_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) return;

  // Find matching automations
  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", campaign.user_id)
    .eq("trigger", triggerType)
    .eq("enabled", true);

  for (const automation of automations || []) {
    console.log(`Triggering automation: ${automation.name} for ${eventType}`);

    // Create webhook event record for tracking
    const { data: webhookEvent } = await supabase
      .from("webhook_events")
      .insert({
        campaign_id: campaignId,
        event_type: eventType,
        email: email,
        payload: { automation_trigger: true, email_event_id: eventId },
      })
      .select()
      .single();

    // Log automation execution
    await supabase.from("automation_logs").insert({
      automation_id: automation.id,
      webhook_event_id: webhookEvent?.id,
      status: "pending",
    });

    // Increment triggered count
    await supabase
      .from("automations")
      .update({ triggered_count: (automation.triggered_count || 0) + 1 })
      .eq("id", automation.id);

    // Execute action
    if (automation.action === "webhook" && automation.webhook_url) {
      try {
        await fetch(automation.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            automation_id: automation.id,
            automation_name: automation.name,
            event_type: eventType,
            campaign_id: campaignId,
            email: email,
            triggered_at: new Date().toISOString(),
          }),
        });

        await supabase
          .from("automation_logs")
          .update({ status: "completed" })
          .eq("automation_id", automation.id)
          .eq("webhook_event_id", webhookEvent?.id);

        await supabase
          .from("automations")
          .update({ completed_count: (automation.completed_count || 0) + 1 })
          .eq("id", automation.id);
      } catch (webhookError: any) {
        console.error("Automation webhook failed:", webhookError);
        await supabase
          .from("automation_logs")
          .update({
            status: "failed",
            error_message: webhookError.message || "Unknown error",
          })
          .eq("automation_id", automation.id)
          .eq("webhook_event_id", webhookEvent?.id);
      }
    } else {
      // Mark other actions as completed
      await supabase
        .from("automation_logs")
        .update({ status: "completed" })
        .eq("automation_id", automation.id)
        .eq("webhook_event_id", webhookEvent?.id);

      await supabase
        .from("automations")
        .update({ completed_count: (automation.completed_count || 0) + 1 })
        .eq("id", automation.id);
    }
  }
}

serve(handler);
