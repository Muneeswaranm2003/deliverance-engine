import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const DEFAULT_REGION = Deno.env.get("AWS_REGION") || "us-east-1";

// ───────────────── SigV4 helpers ─────────────────
async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)),
  );
}
async function sha256Hex(data: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toAmzDate(d: Date) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

async function sesRequest<T = any>(opts: {
  region: string;
  service: "ses" | "email";
  method: string;
  path: string;
  body?: any;
}): Promise<T> {
  const { region, service, method, path, body } = opts;
  const host = service === "email"
    ? `email.${region}.amazonaws.com` // v2 API
    : `email.${region}.amazonaws.com`;
  const url = `https://${host}${path}`;
  const payload = body ? JSON.stringify(body) : "";
  const { amzDate, dateStamp } = toAmzDate(new Date());
  const payloadHash = await sha256Hex(payload);

  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(new TextEncoder().encode("AWS4" + AWS_SECRET_ACCESS_KEY), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "ses");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = [...await hmac(kSigning, stringToSign)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const authorization =
    `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Host": host,
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHash,
      "Authorization": authorization,
    },
    body: payload || undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SES ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : ({} as T);
}

// ───────────────── handlers ─────────────────
function buildDnsRecords(domain: string, dkimTokens: string[]) {
  return {
    dkim: dkimTokens.map((t) => ({
      type: "CNAME",
      host: `${t}._domainkey.${domain}`,
      value: `${t}.dkim.amazonses.com`,
      ttl: 1800,
    })),
    spf: {
      type: "TXT",
      host: domain,
      value: "v=spf1 include:amazonses.com ~all",
      ttl: 1800,
    },
    dmarc: {
      type: "TXT",
      host: `_dmarc.${domain}`,
      value: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain,
      ttl: 1800,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Unauthorized");

    const { action, ...params } = await req.json();

    // ───── CREATE identity (domain or subdomain) ─────
    if (action === "create") {
      const { domain, parent_id, region } = params as {
        domain: string; parent_id?: string; region?: string;
      };
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
        throw new Error("Invalid domain");
      }
      const useRegion = region || DEFAULT_REGION;
      const identity_type = parent_id ? "subdomain" : "domain";

      // Create v2 email identity with DKIM signing enabled (Easy DKIM)
      const create = await sesRequest<{ DkimAttributes: { Tokens: string[] } }>({
        region: useRegion,
        service: "email",
        method: "POST",
        path: "/v2/email/identities",
        body: { EmailIdentity: domain },
      });
      const tokens = create.DkimAttributes?.Tokens ?? [];

      const { data, error } = await supabase
        .from("ses_identities")
        .insert({
          user_id: user.id,
          parent_id: parent_id ?? null,
          identity_type,
          domain,
          region: useRegion,
          dkim_tokens: tokens,
          verification_status: "Pending",
        })
        .select()
        .single();
      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          identity: data,
          dns_records: buildDnsRecords(domain, tokens),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ───── CHECK verification ─────
    if (action === "check") {
      const { id } = params as { id: string };
      const { data: row, error } = await supabase
        .from("ses_identities").select("*").eq("id", id).single();
      if (error || !row) throw new Error("Identity not found");

      const info = await sesRequest<any>({
        region: row.region,
        service: "email",
        method: "GET",
        path: `/v2/email/identities/${encodeURIComponent(row.domain)}`,
      });

      const dkim = info.DkimAttributes?.Status || null;
      // SES v2 returns a boolean VerifiedForSendingStatus.
      // Treat sending-verified OR DKIM=SUCCESS as success.
      const verification =
        info.VerifiedForSendingStatus === true || dkim === "SUCCESS"
          ? "Success"
          : dkim === "FAILED"
            ? "Failed"
            : "Pending";

      await supabase.from("ses_identities").update({
        verification_status: verification,
        dkim_verification_status: dkim,
        last_checked_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", id);

      return new Response(
        JSON.stringify({
          success: true,
          verification_status: verification,
          dkim_status: dkim,
          dns_records: buildDnsRecords(row.domain, row.dkim_tokens || []),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ───── DELETE identity (and AWS side) ─────
    if (action === "delete") {
      const { id } = params as { id: string };
      const { data: row } = await supabase
        .from("ses_identities").select("*").eq("id", id).single();
      if (row) {
        try {
          await sesRequest({
            region: row.region,
            service: "email",
            method: "DELETE",
            path: `/v2/email/identities/${encodeURIComponent(row.domain)}`,
          });
        } catch (_) { /* ignore if already gone */ }
        await supabase.from("ses_identities").delete().eq("id", id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ───── SEND email via SES v2 ─────
    if (action === "send") {
      const {
        from, to, subject, html, text,
        identity_id, parent_id, rotate, local_part,
      } = params as {
        from?: string; to: string; subject: string;
        html?: string; text?: string;
        identity_id?: string; parent_id?: string;
        rotate?: boolean; local_part?: string;
      };
      if (!to || !subject || (!html && !text)) {
        throw new Error("to, subject, and html/text required");
      }

      let region = DEFAULT_REGION;
      let chosen: any = null;

      if (rotate || parent_id) {
        // Pick the least-recently-used verified, active subdomain
        let q = supabase
          .from("ses_identities")
          .select("*")
          .eq("user_id", user.id)
          .eq("identity_type", "subdomain")
          .eq("is_active", true)
          .eq("verification_status", "Success")
          .order("last_used_at", { ascending: true, nullsFirst: true })
          .limit(1);
        if (parent_id) q = q.eq("parent_id", parent_id);
        const { data: pool } = await q;
        chosen = pool?.[0];
        if (!chosen) throw new Error("No verified active subdomain available for rotation");
      } else if (identity_id) {
        const { data: row } = await supabase
          .from("ses_identities").select("*").eq("id", identity_id).single();
        if (!row) throw new Error("Identity not found");
        if (row.verification_status !== "Success") throw new Error("Identity is not verified yet");
        chosen = row;
      }

      if (chosen) region = chosen.region;

      const fromAddress = from
        ? from
        : chosen
          ? `${local_part || "noreply"}@${chosen.domain}`
          : null;
      if (!fromAddress) throw new Error("from address (or rotate/identity_id) is required");

      const result = await sesRequest<{ MessageId: string }>({
        region,
        service: "email",
        method: "POST",
        path: "/v2/email/outbound-emails",
        body: {
          FromEmailAddress: fromAddress,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: {
                ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
                ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
              },
            },
          },
        },
      });

      if (chosen) {
        await supabase.from("ses_identities").update({
          last_used_at: new Date().toISOString(),
          send_count: (chosen.send_count || 0) + 1,
        }).eq("id", chosen.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message_id: result.MessageId,
          from: fromAddress,
          used_identity_id: chosen?.id ?? null,
          used_domain: chosen?.domain ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ───── TOGGLE active flag for rotation ─────
    if (action === "set_active") {
      const { id, is_active } = params as { id: string; is_active: boolean };
      const { error } = await supabase
        .from("ses_identities")
        .update({ is_active })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    console.error("ses-manage error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});