import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnqueueBody {
  campaign_id: string;
  from_name: string;
  /** Full sender addresses, e.g. ["noreply@a.com", "noreply@b.com"] */
  sender_emails: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization header required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "Invalid authentication" }, 401);
    const userId = authData.user.id;

    const body = (await req.json()) as EnqueueBody;
    const campaignId = String(body?.campaign_id || "");
    const fromName = String(body?.from_name || "").trim();
    const senders = Array.from(
      new Set((body?.sender_emails || []).map((s) => String(s).trim().toLowerCase()).filter((s) => s.includes("@"))),
    );

    if (!campaignId) return json({ error: "campaign_id is required" }, 400);
    if (!fromName) return json({ error: "from_name is required" }, 400);
    if (senders.length === 0) return json({ error: "At least one sender email is required" }, 400);

    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, user_id, status")
      .eq("id", campaignId)
      .eq("user_id", userId)
      .maybeSingle();
    if (campErr) throw campErr;
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.status === "sending") return json({ error: "Campaign is already sending" }, 409);

    // Clear any leftover queued jobs for this campaign
    await supabase
      .from("campaign_send_jobs")
      .delete()
      .eq("campaign_id", campaignId)
      .in("status", ["queued", "failed"]);

    const { data: recipients, error: recErr } = await supabase
      .from("campaign_recipients")
      .select("id, email, first_name, last_name, company")
      .eq("campaign_id", campaignId);
    if (recErr) throw recErr;
    if (!recipients || recipients.length === 0) return json({ error: "Campaign has no recipients" }, 400);

    // Skip suppressed addresses
    const { data: suppressed } = await supabase
      .from("suppression_list")
      .select("email")
      .eq("user_id", userId);
    const blocked = new Set((suppressed || []).map((s: any) => String(s.email).toLowerCase()));

    const jobs = recipients
      .filter((r: any) => !blocked.has(String(r.email).toLowerCase()))
      .map((r: any, index: number) => {
        // Even round-robin split across the configured sender addresses
        const fromEmail = senders[index % senders.length];
        return {
          campaign_id: campaignId,
          user_id: userId,
          recipient_id: r.id,
          email: r.email,
          first_name: r.first_name,
          last_name: r.last_name,
          company: r.company,
          from_name: fromName,
          from_email: fromEmail,
          sender_domain: fromEmail.split("@")[1] || null,
          status: "queued",
        };
      });

    if (jobs.length === 0) return json({ error: "All recipients are suppressed" }, 400);

    for (let i = 0; i < jobs.length; i += 500) {
      const { error } = await supabase.from("campaign_send_jobs").insert(jobs.slice(i, i + 500));
      if (error) throw error;
    }

    await supabase
      .from("campaigns")
      .update({ status: "sending", total_recipients: jobs.length, sent_count: 0 })
      .eq("id", campaignId);

    const perSender: Record<string, number> = {};
    for (const j of jobs) perSender[j.from_email] = (perSender[j.from_email] || 0) + 1;

    return json({ success: true, queued: jobs.length, senders: perSender });
  } catch (err: any) {
    console.error("enqueue-campaign error:", err);
    return json({ error: err?.message || "Unexpected error" }, 500);
  }
});
