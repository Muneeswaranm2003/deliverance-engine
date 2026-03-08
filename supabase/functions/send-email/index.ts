import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  campaign_id?: string;
  recipient_id?: string;
}

interface ApiKey {
  id: string;
  provider: string;
  api_key: string;
  endpoint_url: string | null;
  priority: number;
  is_active: boolean;
  daily_limit: number | null;
  emails_sent_today: number;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Provider send functions ──────────────────────────────────────────

async function sendViaResend(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.message || data?.error?.message || JSON.stringify(data) };
  return { success: true, messageId: data.id };
}

async function sendViaSendGrid(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: to.map(email => ({ email })) }],
      from: { email: from.match(/<(.+)>/)?.[1] || from, name: from.match(/^(.+?)\s*</)?.[1] || undefined },
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        { type: "text/html", value: html },
      ],
    }),
  });
  if (res.status === 202 || res.status === 200) return { success: true, messageId: res.headers.get("x-message-id") || undefined };
  const data = await res.text();
  return { success: false, error: `SendGrid error (${res.status}): ${data}` };
}

async function sendViaMailgun(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  // Extract domain from from address
  const fromEmail = from.match(/<(.+)>/)?.[1] || from;
  const domain = fromEmail.split("@")[1];
  const formData = new FormData();
  formData.append("from", from);
  to.forEach(t => formData.append("to", t));
  formData.append("subject", subject);
  formData.append("html", html);
  if (text) formData.append("text", text);

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.message || JSON.stringify(data) };
  return { success: true, messageId: data.id };
}

async function sendViaPostmark(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "X-Postmark-Server-Token": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      From: from,
      To: to.join(","),
      Subject: subject,
      HtmlBody: html,
      TextBody: text || "",
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.Message || JSON.stringify(data) };
  return { success: true, messageId: data.MessageID };
}

async function sendViaAmazonSES(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  // apiKey format: "ACCESS_KEY_ID:SECRET_ACCESS_KEY:REGION"
  const parts = apiKey.split(":");
  if (parts.length < 3) return { success: false, error: "SES API key format: ACCESS_KEY_ID:SECRET_ACCESS_KEY:REGION" };
  
  const [accessKeyId, secretAccessKey, region] = parts;
  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

  // Use SES v2 simple email
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Access-Key": accessKeyId,
      "X-Amz-Secret-Key": secretAccessKey,
    },
    body: JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: to },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: { Html: { Data: html }, ...(text ? { Text: { Data: text } } : {}) },
        },
      },
    }),
  });
  
  if (!res.ok) {
    const data = await res.text();
    return { success: false, error: `SES error (${res.status}): ${data}` };
  }
  const data = await res.json();
  return { success: true, messageId: data.MessageId };
}

async function sendViaSparkPost(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch("https://api.sparkpost.com/api/v1/transmissions", {
    method: "POST",
    headers: { "Authorization": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      recipients: to.map(email => ({ address: { email } })),
      content: {
        from: from,
        subject,
        html,
        ...(text ? { text } : {}),
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.errors?.[0]?.message || JSON.stringify(data) };
  return { success: true, messageId: data?.results?.id };
}

async function sendViaMandrill(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const fromEmail = from.match(/<(.+)>/)?.[1] || from;
  const fromName = from.match(/^(.+?)\s*</)?.[1] || "";
  const res = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      message: {
        from_email: fromEmail,
        from_name: fromName,
        to: to.map(email => ({ email, type: "to" })),
        subject,
        html,
        ...(text ? { text } : {}),
      },
    }),
  });
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.status === "sent") return { success: true, messageId: data[0]._id };
  if (Array.isArray(data) && data[0]?.reject_reason) return { success: false, error: `Mandrill rejected: ${data[0].reject_reason}` };
  return { success: false, error: JSON.stringify(data) };
}

async function sendViaBrevo(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const fromEmail = from.match(/<(.+)>/)?.[1] || from;
  const fromName = from.match(/^(.+?)\s*</)?.[1] || undefined;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: to.map(email => ({ email })),
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.message || JSON.stringify(data) };
  return { success: true, messageId: data.messageId };
}

async function sendViaElasticEmail(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch("https://api.elasticemail.com/v4/emails/transactional", {
    method: "POST",
    headers: { "X-ElasticEmail-ApiKey": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      Recipients: { To: to },
      Content: {
        From: from,
        Subject: subject,
        Body: [
          { ContentType: "HTML", Content: html },
          ...(text ? [{ ContentType: "PlainText", Content: text }] : []),
        ],
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: JSON.stringify(data) };
  return { success: true, messageId: data.TransactionID || data.MessageID };
}

async function sendViaMailjet(apiKey: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  // apiKey format: "API_KEY:SECRET_KEY"
  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(apiKey)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [{
        From: { Email: from.match(/<(.+)>/)?.[1] || from, Name: from.match(/^(.+?)\s*</)?.[1] || undefined },
        To: to.map(email => ({ Email: email })),
        Subject: subject,
        HTMLPart: html,
        ...(text ? { TextPart: text } : {}),
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: JSON.stringify(data) };
  return { success: true, messageId: data?.Messages?.[0]?.To?.[0]?.MessageID };
}

async function sendViaCustom(apiKey: string, endpointUrl: string, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.error || data?.message || JSON.stringify(data) };
  return { success: true, messageId: data.id || data.messageId || data.message_id };
}

// ── Route to provider ────────────────────────────────────────────────

async function sendWithProvider(key: ApiKey, from: string, to: string[], subject: string, html: string, text?: string): Promise<SendResult> {
  const provider = key.provider.toLowerCase();
  switch (provider) {
    case "resend": return sendViaResend(key.api_key, from, to, subject, html, text);
    case "sendgrid": return sendViaSendGrid(key.api_key, from, to, subject, html, text);
    case "mailgun": return sendViaMailgun(key.api_key, from, to, subject, html, text);
    case "postmark": return sendViaPostmark(key.api_key, from, to, subject, html, text);
    case "amazon_ses": return sendViaAmazonSES(key.api_key, from, to, subject, html, text);
    case "sparkpost": return sendViaSparkPost(key.api_key, from, to, subject, html, text);
    case "mandrill": return sendViaMandrill(key.api_key, from, to, subject, html, text);
    case "brevo": return sendViaBrevo(key.api_key, from, to, subject, html, text);
    case "elastic_email": return sendViaElasticEmail(key.api_key, from, to, subject, html, text);
    case "mailjet": return sendViaMailjet(key.api_key, from, to, subject, html, text);
    case "smtp2go":
      // SMTP2GO has a REST API
      return sendViaCustom(key.api_key, "https://api.smtp2go.com/v3/email/send", from, to, subject, html, text);
    case "socketlabs":
      return sendViaCustom(key.api_key, key.endpoint_url || "https://inject.socketlabs.com/api/v1/email", from, to, subject, html, text);
    case "pepipost":
      return sendViaCustom(key.api_key, "https://emailapi.netcorecloud.net/v5.1/mail/send", from, to, subject, html, text);
    case "custom":
      if (!key.endpoint_url) return { success: false, error: "Custom provider requires an endpoint URL" };
      return sendViaCustom(key.api_key, key.endpoint_url, from, to, subject, html, text);
    default:
      return { success: false, error: `Unknown provider: ${key.provider}` };
  }
}

// ── Main handler ─────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRequest: EmailRequest = await req.json();
    const recipientEmails = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];

    // Check suppression list
    const { data: suppressedEmails } = await supabase
      .from("suppression_list")
      .select("email")
      .eq("user_id", user.id)
      .in("email", recipientEmails.map(e => e.toLowerCase()));

    const suppressedSet = new Set((suppressedEmails || []).map(s => s.email.toLowerCase()));
    const validRecipients = recipientEmails.filter(e => !suppressedSet.has(e.toLowerCase()));

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "All recipients are suppressed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active API keys ordered by priority
    const { data: apiKeys, error: keysError } = await supabase
      .from("api_keys")
      .select("id, provider, api_key, endpoint_url, priority, is_active, daily_limit, emails_sent_today")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (keysError) {
      console.error("Error fetching API keys:", keysError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch API keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeys || apiKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active API keys configured. Go to Settings → API Keys to add one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build "from" string
    const fromEmail = emailRequest.from_email || "noreply@example.com";
    const fromName = emailRequest.from_name || "MailForge";
    const from = `${fromName} <${fromEmail}>`;

    // Try each key in priority order (failover)
    let result: SendResult = { success: false, error: "No API keys available" };
    let usedKeyId: string | null = null;

    for (const key of apiKeys) {
      // Check daily limit
      if (key.daily_limit && key.emails_sent_today >= key.daily_limit) {
        console.log(`API key ${key.id} (${key.provider}) reached daily limit, trying next...`);
        continue;
      }

      try {
        result = await sendWithProvider(key as ApiKey, from, validRecipients, emailRequest.subject, emailRequest.html, emailRequest.text);
        usedKeyId = key.id;

        if (result.success) {
          // Update usage stats
          await supabase
            .from("api_keys")
            .update({
              emails_sent_today: key.emails_sent_today + 1,
              last_used_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", key.id);
          break;
        } else {
          // Log error on key, try next
          console.error(`Provider ${key.provider} failed: ${result.error}`);
          await supabase
            .from("api_keys")
            .update({ last_error: result.error })
            .eq("id", key.id);
        }
      } catch (err: any) {
        console.error(`Provider ${key.provider} threw:`, err);
        await supabase
          .from("api_keys")
          .update({ last_error: err.message })
          .eq("id", key.id);
        result = { success: false, error: err.message };
      }
    }

    // Log the email send attempt
    if (emailRequest.campaign_id) {
      await supabase.from("email_logs").insert({
        campaign_id: emailRequest.campaign_id,
        recipient_id: emailRequest.recipient_id || null,
        email: validRecipients[0],
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      });
    }

    return new Response(
      JSON.stringify(result.success ? { success: true, messageId: result.messageId } : { success: false, error: result.error }),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
