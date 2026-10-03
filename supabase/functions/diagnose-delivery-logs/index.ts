import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createResponsesCall } from "../_shared/responses.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const MAX_CHARS = 60_000;

const SYSTEM = `You are a senior email deliverability engineer helping an admin of a self-hosted mail server (an MTA that relays through SMTP providers like Amazon SES, Elastic Email or their own servers).
The admin pastes delivery log entries (SMTP responses, bounce messages, queue JSON, events.log lines).
Respond in concise Markdown with these sections:
## Summary — 1-3 sentences on what is going wrong.
## Likely causes — ranked, each with confidence (high/medium/low) and the specific log evidence (quote SMTP codes/text).
## Fixes — numbered, concrete steps (DNS records with example values, config fields like mta.routes[].transport, rate limits, suppression, warm-up, credentials). Mark which fixes are urgent.
## Affected recipients — group by recipient domain or error type when useful.
If the logs look healthy, say so. Never invent log lines. Keep the whole answer under 600 words.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json(401, { error: "Please sign in to use the log diagnosis." });

  let body: { logs?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request body" });
  }
  const logs = String(body.logs ?? "").trim();
  if (!logs) return json(400, { error: "Paste at least one log entry." });
  if (logs.length > MAX_CHARS) {
    return json(400, { error: `Logs are too long (${logs.length} characters). Paste at most ${MAX_CHARS}.` });
  }
  const context = String(body.context ?? "").slice(0, 2000);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json(500, { error: "AI is not configured for this project." });

  try {
    const { result } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${context ? `Setup notes from the admin:\n${context}\n\n` : ""}Delivery log entries:\n\`\`\`\n${logs}\n\`\`\``,
        },
      ],
    );
    const text = (await result.text).trim();
    if (!text) return json(502, { error: "The AI returned no diagnosis. Try again with different log entries." });
    return json(200, { diagnosis: text });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return json(499, { error: "Cancelled" });
    const status = Number((err as { statusCode?: number }).statusCode) || 500;
    const raw = (err as { responseBody?: string }).responseBody;
    let message = (err as Error)?.message || "Diagnosis failed";
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      message = parsed?.message || parsed?.error?.message || parsed?.error || message;
    } catch { /* keep message */ }
    if (status === 429) message = "Too many requests right now. Please wait a minute and try again.";
    if (status === 402) message = message || "AI credits are used up. Add credits in your workspace billing settings.";
    console.error("diagnose-delivery-logs", status, message);
    return json(status, { error: String(message) });
  }
});
