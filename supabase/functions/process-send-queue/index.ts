import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;
const STALE_MINUTES = 5;

const personalize = (tpl: string, job: any) =>
  (tpl || "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, job.first_name || "")
    .replace(/\{\{\s*last_name\s*\}\}/gi, job.last_name || "")
    .replace(/\{\{\s*company\s*\}\}/gi, job.company || "")
    .replace(/\{\{\s*email\s*\}\}/gi, job.email || "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const result = { claimed: 0, sent: 0, failed: 0 };

  try {
    // Recover jobs stuck in processing (worker crash / timeout)
    const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
    await supabase
      .from("campaign_send_jobs")
      .update({ status: "queued", locked_at: null })
      .eq("status", "processing")
      .lt("locked_at", staleCutoff);

    const { data: due, error: dueErr } = await supabase
      .from("campaign_send_jobs")
      .select("*")
      .eq("status", "queued")
      .lte("run_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (dueErr) throw dueErr;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = due.map((j: any) => j.id);
    const { data: claimed, error: claimErr } = await supabase
      .from("campaign_send_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "queued")
      .select("*");
    if (claimErr) throw claimErr;
    result.claimed = claimed?.length ?? 0;

    // Cache campaign content
    const campaignCache = new Map<string, any>();
    const getCampaign = async (id: string) => {
      if (!campaignCache.has(id)) {
        const { data } = await supabase
          .from("campaigns")
          .select("id, subject, content, sent_count")
          .eq("id", id)
          .maybeSingle();
        campaignCache.set(id, data);
      }
      return campaignCache.get(id);
    };

    const sentPerCampaign: Record<string, number> = {};

    for (const job of claimed || []) {
      const campaign = await getCampaign(job.campaign_id);
      if (!campaign) {
        await supabase
          .from("campaign_send_jobs")
          .update({ status: "failed", last_error: "Campaign no longer exists", locked_at: null })
          .eq("id", job.id);
        result.failed++;
        continue;
      }

      let ok = false;
      let error = "";
      let messageId: string | null = null;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: job.email,
            subject: personalize(campaign.subject, job),
            html: personalize(campaign.content, job),
            from_email: job.from_email,
            from_name: job.from_name,
            campaign_id: job.campaign_id,
            recipient_id: job.recipient_id,
            internal_user_id: job.user_id,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        ok = res.ok && payload?.success !== false;
        error = ok ? "" : payload?.error || `send-email returned ${res.status}`;
        messageId = payload?.messageId ?? null;
      } catch (err: any) {
        error = err?.message || String(err);
      }

      if (ok) {
        await supabase
          .from("campaign_send_jobs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: messageId,
            last_error: null,
            locked_at: null,
            attempts: job.attempts + 1,
          })
          .eq("id", job.id);
        sentPerCampaign[job.campaign_id] = (sentPerCampaign[job.campaign_id] || 0) + 1;
        result.sent++;
      } else {
        const attempts = job.attempts + 1;
        const exhausted = attempts >= job.max_attempts;
        await supabase
          .from("campaign_send_jobs")
          .update({
            status: exhausted ? "failed" : "queued",
            attempts,
            last_error: error.slice(0, 500),
            locked_at: null,
            // exponential backoff: 1m, 4m, 9m…
            run_at: new Date(Date.now() + attempts * attempts * 60_000).toISOString(),
          })
          .eq("id", job.id);
        result.failed++;
      }
    }

    // Update campaign progress and completion
    for (const campaignId of Object.keys(sentPerCampaign)) {
      const { count: sentCount } = await supabase
        .from("campaign_send_jobs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "sent");
      const { count: pending } = await supabase
        .from("campaign_send_jobs")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .in("status", ["queued", "processing"]);

      await supabase
        .from("campaigns")
        .update({ sent_count: sentCount ?? 0, ...(pending === 0 ? { status: "sent" } : {}) })
        .eq("id", campaignId);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("process-send-queue error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message, ...result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
