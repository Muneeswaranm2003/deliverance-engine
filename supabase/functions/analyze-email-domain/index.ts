import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Well-known MX domain → provider mapping
const MX_PROVIDER_MAP: Record<string, string> = {
  "google.com": "Gmail / Google Workspace",
  "googlemail.com": "Gmail",
  "outlook.com": "Outlook / Microsoft 365",
  "microsoft.com": "Outlook / Microsoft 365",
  "protection.outlook.com": "Microsoft 365",
  "pphosted.com": "Proofpoint",
  "yahoodns.net": "Yahoo",
  "zoho.com": "Zoho Mail",
  "zoho.in": "Zoho Mail",
  "zoho.eu": "Zoho Mail",
  "messagelabs.com": "Broadcom (Symantec)",
  "mimecast.com": "Mimecast",
  "barracudanetworks.com": "Barracuda",
  "sophos.com": "Sophos",
  "secureserver.net": "GoDaddy",
  "emailsrvr.com": "Rackspace",
  "icloud.com": "iCloud Mail",
  "apple.com": "iCloud Mail",
  "fastmail.com": "Fastmail",
  "titan.email": "Titan Email",
  "hostinger.com": "Hostinger",
  "namecheap.com": "Namecheap",
  "ovh.net": "OVH",
  "ionos.com": "IONOS",
  "mail.ru": "Mail.ru",
  "yandex.net": "Yandex Mail",
  "yandex.ru": "Yandex Mail",
  "qq.com": "QQ Mail",
  "163.com": "NetEase 163",
};

function identifyProvider(mxRecords: string[]): string {
  for (const mx of mxRecords) {
    const mxLower = mx.toLowerCase();
    for (const [domain, provider] of Object.entries(MX_PROVIDER_MAP)) {
      if (mxLower.includes(domain)) {
        return provider;
      }
    }
  }
  return mxRecords.length > 0 ? "Custom / Self-hosted" : "Unknown";
}

function checkSpf(txtRecords: string[]): string {
  const spfRecord = txtRecords.find((r) =>
    r.toLowerCase().startsWith("v=spf1")
  );
  if (!spfRecord) return "missing";

  const lower = spfRecord.toLowerCase();

  // redirect= means SPF is delegated (valid configuration)
  if (lower.includes("redirect=")) return "pass";

  const hasFail = /-all/.test(lower);
  const hasSoftFail = /~all/.test(lower);
  const hasNeutral = /\?all/.test(lower);
  const hasPass = /\+all/.test(lower);

  if (hasFail) return "pass";
  if (hasSoftFail) return "softfail";
  if (hasNeutral) return "neutral";
  if (hasPass) return "permissive";

  return "incomplete";
}

async function dnsLookup(
  domain: string,
  type: string
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=${type}`,
      { headers: { Accept: "application/dns-json" } }
    );
    const data = await response.json();
    if (data.Answer) {
      return data.Answer.map((a: { data: string }) =>
        a.data.replace(/"/g, "").trim()
      );
    }
    return [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "emails array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate domains
    const domainMap = new Map<string, string[]>();
    for (const email of emails) {
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain) {
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(email);
      }
    }

    // Analyze each unique domain
    const results: Record<string, { email_provider: string; spf_status: string }> = {};

    await Promise.all(
      Array.from(domainMap.entries()).map(async ([domain, domainEmails]) => {
        const [mxRecords, txtRecords] = await Promise.all([
          dnsLookup(domain, "MX"),
          dnsLookup(domain, "TXT"),
        ]);

        const provider = identifyProvider(mxRecords);
        const spf = checkSpf(txtRecords);

        for (const email of domainEmails) {
          results[email] = { email_provider: provider, spf_status: spf };
        }
      })
    );

    // Update contacts in database
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updates = Object.entries(results).map(([email, data]) =>
      supabase
        .from("contacts")
        .update({ email_provider: data.email_provider, spf_status: data.spf_status })
        .eq("email", email)
    );

    await Promise.all(updates);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error analyzing email domains:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
