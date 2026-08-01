import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Schedule {
  id: string;
  user_id: string;
  name: string;
  recipients: string[];
  frequency: "daily" | "weekly" | "monthly";
  hour_utc: number;
  day_of_week: number;
  day_of_month: number;
  range_days: number;
  range_label: string;
  enabled: boolean;
  subject_template?: string | null;
  message_template?: string | null;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ── helpers ──────────────────────────────────────────────────────────

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: unknown[]) => cells.map(esc).join(",");
const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const renderTemplate = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
    key in vars ? String(vars[key as keyof typeof vars]) : m,
  );

export function computeNextRun(s: Pick<Schedule, "frequency" | "hour_utc" | "day_of_week" | "day_of_month">, from = new Date()): Date {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(s.hour_utc);
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  if (s.frequency === "weekly") {
    while (next.getUTCDay() !== s.day_of_week) next.setUTCDate(next.getUTCDate() + 1);
  } else if (s.frequency === "monthly") {
    while (next.getUTCDate() !== s.day_of_month) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

async function buildReport(schedule: Schedule) {
  const to = new Date();
  const from = new Date(to.getTime() - (schedule.range_days - 1) * 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const uid = schedule.user_id;

  const inRange = (q: any) => q.gte("created_at", fromIso).lte("created_at", toIso);

  const [campaignsRes, contactsRes, sentRes, automationsRes, openedRes, recentRes] = await Promise.all([
    inRange(admin.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", uid)),
    inRange(admin.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", uid)),
    inRange(admin.from("email_logs").select("id, campaigns!inner(user_id)", { count: "exact", head: true }).eq("status", "sent").eq("campaigns.user_id", uid)),
    inRange(admin.from("automations").select("id", { count: "exact", head: true }).eq("enabled", true).eq("user_id", uid)),
    inRange(admin.from("email_logs").select("id, campaigns!inner(user_id)", { count: "exact", head: true }).not("opened_at", "is", null).eq("campaigns.user_id", uid)),
    inRange(admin.from("campaigns").select("*").eq("user_id", uid)).order("created_at", { ascending: false }).limit(25),
  ]);

  const sent = sentRes.count || 0;
  const opened = openedRes.count || 0;
  const stats = {
    campaigns: campaignsRes.count || 0,
    contacts: contactsRes.count || 0,
    emailsSent: sent,
    automations: automationsRes.count || 0,
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
  };
  const campaigns = (recentRes.data as any[]) || [];

  const vars = {
    name: schedule.name,
    range: schedule.range_label,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    campaigns: stats.campaigns,
    contacts: stats.contacts,
    emails_sent: stats.emailsSent,
    open_rate: `${stats.openRate}%`,
  };

  const subject = schedule.subject_template?.trim()
    ? renderTemplate(schedule.subject_template, vars)
    : `${schedule.name} — ${schedule.range_label} analytics`;

  const intro = schedule.message_template?.trim()
    ? renderTemplate(schedule.message_template, vars)
    : `Analytics for the last ${schedule.range_label} (${vars.from} → ${vars.to})`;

  const lines: string[] = [];
  lines.push(row(["Dashboard export"]));
  lines.push(row(["Range", schedule.range_label]));
  lines.push(row(["From", fromIso]));
  lines.push(row(["To", toIso]));
  lines.push("");
  lines.push(row(["Metric", "Value"]));
  lines.push(row(["Campaigns", stats.campaigns]));
  lines.push(row(["New Contacts", stats.contacts]));
  lines.push(row(["Emails Sent", stats.emailsSent]));
  lines.push(row(["Active Automations", stats.automations]));
  lines.push(row(["Open Rate (%)", stats.openRate]));
  lines.push("");
  lines.push(row(["Recent Campaigns"]));
  lines.push(row(["Name", "Subject", "Status", "Sender Email", "Recipients", "Sent", "Created At"]));
  campaigns.forEach((c) => {
    lines.push(row([c.name, c.subject, c.status, c.sender_email, c.total_recipients ?? 0, c.sent_count ?? 0, c.created_at]));
  });
  const csv = lines.join("\n");

  const metricRow = (label: string, value: string | number) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#475569">${escHtml(label)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#0f172a">${escHtml(String(value))}</td></tr>`;

  const campaignRows = campaigns.slice(0, 10).map((c) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${escHtml(c.name ?? "")}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${escHtml(c.status ?? "")}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${c.sent_count ?? 0}/${c.total_recipients ?? 0}</td></tr>`
  ).join("");

  const html = `<!doctype html><html><body style="background:#ffffff;margin:0;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px">${escHtml(schedule.name)}</h1>
    <p style="color:#64748b;margin:0 0 20px;font-size:13px;white-space:pre-wrap">${escHtml(intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${metricRow("Campaigns", stats.campaigns)}
      ${metricRow("New Contacts", stats.contacts)}
      ${metricRow("Emails Sent", stats.emailsSent)}
      ${metricRow("Active Automations", stats.automations)}
      ${metricRow("Open Rate", `${stats.openRate}%`)}
    </table>
    ${campaigns.length ? `<h2 style="font-size:15px;color:#0f172a;margin:24px 0 8px">Recent campaigns</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${campaignRows}</table>` : ""}
    <pre style="margin-top:24px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;color:#334155;white-space:pre-wrap;overflow-x:auto">${escHtml(csv)}</pre>
    <p style="color:#94a3b8;font-size:11px;margin-top:16px">Copy the block above into a .csv file for spreadsheet analysis.</p>
  </div></body></html>`;

  return { html, csv, stats, subject };
}

async function runSchedule(schedule: Schedule) {
  const recipients = (schedule.recipients || []).filter((r) => !!r);
  if (recipients.length === 0) throw new Error("No recipients configured");

  const { html, subject } = await buildReport(schedule);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipients,
      subject,
      html,
      internal_user_id: schedule.user_id,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `send-email failed (${res.status})`);
  }
  return data;
}

// ── handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const scheduleId = typeof body.schedule_id === "string" ? body.schedule_id : null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    // ── Manual "send now" for one schedule (requires the owner's session) ──
    if (scheduleId) {
      const { data: authData } = await admin.auth.getUser(token);
      const user = authData?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: schedule } = await admin
        .from("analytics_export_schedules")
        .select("*")
        .eq("id", scheduleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!schedule) {
        return new Response(JSON.stringify({ error: "Schedule not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        await runSchedule(schedule as Schedule);
        await admin.from("analytics_export_schedules")
          .update({ last_run_at: new Date().toISOString(), last_error: null })
          .eq("id", scheduleId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await admin.from("analytics_export_schedules").update({ last_error: message }).eq("id", scheduleId);
        return new Response(JSON.stringify({ success: false, error: message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Cron mode: process every due schedule ──
    const now = new Date();
    const { data: due, error } = await admin
      .from("analytics_export_schedules")
      .select("*")
      .eq("enabled", true)
      .lte("next_run_at", now.toISOString())
      .limit(50);
    if (error) throw error;

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const schedule of (due || []) as Schedule[]) {
      let lastError: string | null = null;
      try {
        await runSchedule(schedule);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await admin.from("analytics_export_schedules").update({
        last_run_at: now.toISOString(),
        last_error: lastError,
        next_run_at: computeNextRun(schedule, now).toISOString(),
      }).eq("id", schedule.id);
      results.push({ id: schedule.id, ok: !lastError, error: lastError || undefined });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("process-analytics-exports error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});