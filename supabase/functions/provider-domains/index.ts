import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Multi-provider domain management.
 *
 * Currently supports Elastic Email (v4 REST API). The design is provider-keyed:
 * the caller passes a `provider` + `key_id` (an api_keys row), and this function
 * performs domain CRUD against that provider using the stored API key.
 *
 * Actions:
 *   list        → load domains for the provider
 *   create      → register a new domain on the provider
 *   get         → load one domain with its DNS records
 *   verify      → trigger / refresh verification on the provider
 *   delete      → remove a domain from the provider
 *   set_default → mark a domain as the account default
 */

interface ApiKeyRow {
  id: string;
  provider: string;
  api_key: string;
  endpoint_url: string | null;
  is_active: boolean;
}

// ───────────────────────── Elastic Email ─────────────────────────

const EE_BASE = "https://api.elasticemail.com/v4";

function eeHeaders(apiKey: string) {
  return { "X-ElasticEmail-ApiKey": apiKey, "Content-Type": "application/json" };
}

async function eeList(apiKey: string) {
  const res = await fetch(`${EE_BASE}/domains`, { headers: eeHeaders(apiKey) });
  const data = await res.json();
  if (!res.ok) throw new Error(eeError(data, res.status));
  return (data || []).map((d: any) => eeNormalise(d));
}

async function eeCreate(apiKey: string, domain: string, setDefault: boolean) {
  const res = await fetch(`${EE_BASE}/domains`, {
    method: "POST",
    headers: eeHeaders(apiKey),
    body: JSON.stringify({ Domain: domain, SetAsDefault: setDefault }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(eeError(text ? JSON.parse(text) : null, res.status));
  return eeGet(apiKey, domain);
}

async function eeGet(apiKey: string, domain: string) {
  const res = await fetch(`${EE_BASE}/domains/${encodeURIComponent(domain)}`, {
    headers: eeHeaders(apiKey),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(eeError(data, res.status));
  return eeNormalise(data, true);
}

async function eeVerify(apiKey: string, domain: string) {
  // Body is the tracking verification type; "None" performs a standard DNS re-check.
  const res = await fetch(`${EE_BASE}/domains/${encodeURIComponent(domain)}/verification`, {
    method: "PUT",
    headers: eeHeaders(apiKey),
    body: JSON.stringify("None"),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(eeError(data, res.status));
  return eeNormalise(data, true);
}

async function eeDelete(apiKey: string, domain: string) {
  const res = await fetch(`${EE_BASE}/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
    headers: eeHeaders(apiKey),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(eeError(data, res.status));
  }
  return { success: true };
}

async function eeSetDefault(apiKey: string, domain: string) {
  const res = await fetch(`${EE_BASE}/domains/${encodeURIComponent(domain)}/default`, {
    method: "PATCH",
    headers: eeHeaders(apiKey),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(eeError(data, res.status));
  }
  return { success: true };
}

function eeError(data: any, status: number): string {
  const msg =
    (typeof data === "string" && data) ||
    data?.Error ||
    data?.error ||
    data?.message ||
    `Elastic Email error (${status})`;
  // Elastic Email returns a 401 with "APIKey Expired" / "InvalidApiKey" for bad keys.
  const lower = String(msg).toLowerCase();
  if (lower.includes("apikey") && (lower.includes("expired") || lower.includes("invalid"))) {
    return "Your Elastic Email API key is invalid or expired. Update it in the API Keys tab.";
  }
  if (lower.includes("domain already exists") || lower.includes("already added")) {
    return "This domain is already added to your Elastic Email account.";
  }
  return String(msg);
}

interface NormalisedDomain {
  domain: string;
  provider: string;
  default: boolean;
  verified: boolean;
  spf: boolean;
  dkim: boolean;
  mx: boolean;
  dmarc: boolean;
  tracking: boolean;
  validation_log: string | null;
  dns_records: DnsRecord[];
}

interface DnsRecord {
  type: string;
  host: string;
  value: string;
  ttl: number;
  note?: string;
}

/** Build the DNS records a user must add for an Elastic Email domain. */
function eeDnsRecords(d: any): DnsRecord[] {
  const domain: string = d?.Domain || "";
  const recs: DnsRecord[] = [];
  const dkimVerified = !!d?.Dkim;

  // DKIM — Elastic Email returns the exact record to publish for unverified
  // domains. For already-verified domains it omits the key, so we show a note
  // instead of a misleading placeholder.
  const dkim = d?.DKIMRecord;
  if (dkim && (dkim.HostName || dkim.Selector) && dkim.PublicKey) {
    recs.push({
      type: "TXT",
      host: dkim.HostName || `${dkim.Selector}._domainkey.${domain}`,
      value: `v=DKIM1; k=rsa; p=${dkim.PublicKey}`,
      ttl: 1800,
      note: "DKIM signing record",
    });
  } else if (dkimVerified) {
    recs.push({
      type: "TXT",
      host: `api._domainkey.${domain}`,
      value: "✓ DKIM already verified on Elastic Email",
      ttl: 1800,
      note: "No action needed",
    });
  } else {
    // Fallback selector used by Elastic Email (new / unverified domain).
    recs.push({
      type: "TXT",
      host: `api._domainkey.${domain}`,
      value: "v=DKIM1; k=rsa; p=<copy from Elastic Email dashboard>",
      ttl: 1800,
      note: "DKIM — open the domain in Elastic Email to copy the exact public key",
    });
  }

  // SPF
  recs.push({
    type: "TXT",
    host: domain,
    value: "v=spf1 include:_spf.elasticemail.com ~all",
    ttl: 1800,
    note: "SPF authorisation",
  });

  // Tracking CNAME (link tracking domain)
  recs.push({
    type: "CNAME",
    host: `tracking.${domain}`,
    value: "api.elasticemail.com",
    ttl: 1800,
    note: "Link / open tracking domain",
  });

  // DMARC (recommended, optional)
  recs.push({
    type: "TXT",
    host: `_dmarc.${domain}`,
    value: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain,
    ttl: 1800,
    note: "DMARC policy (recommended)",
  });

  return recs;
}

function eeNormalise(d: any, withDns = false): NormalisedDomain {
  const verified =
    !!d?.Spf && !!d?.Dkim && (!!d?.IsRewriteDomainValid || d?.Verify === false);
  return {
    domain: d?.Domain || "",
    provider: "elastic_email",
    default: !!d?.DefaultDomain,
    verified,
    spf: !!d?.Spf,
    dkim: !!d?.Dkim,
    mx: !!d?.MX,
    dmarc: !!d?.DMARC,
    tracking: !!d?.IsRewriteDomainValid,
    validation_log: d?.ValidationLog || null,
    dns_records: withDns ? eeDnsRecords(d) : [],
  };
}

// ───────────────────────── dispatch ─────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  elastic_email: "Elastic Email",
};

async function getApiKey(
  supabase: any,
  userId: string,
  keyId: string,
): Promise<ApiKeyRow> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, provider, api_key, endpoint_url, is_active")
    .eq("id", keyId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("API key not found. Add it in the API Keys tab first.");
  if (!data.is_active) throw new Error("This API key is disabled. Enable it in the API Keys tab.");
  return data as ApiKeyRow;
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

    const { action, provider, key_id, domain, set_default } = await req.json() as {
      action: string;
      provider?: string;
      key_id?: string;
      domain?: string;
      set_default?: boolean;
    };

    const prov = (provider || "elastic_email").toLowerCase();
    if (!key_id) throw new Error("key_id is required (an api_keys row id)");
    const keyRow = await getApiKey(supabase, user.id, key_id);
    if (keyRow.provider !== prov && !(prov === "elastic_email" && keyRow.provider === "elastic_email")) {
      throw new Error(`Selected API key is for "${keyRow.provider}", not "${prov}".`);
    }

    let result: any;
    switch (action) {
      case "list":
        if (prov === "elastic_email") result = await eeList(keyRow.api_key);
        else throw new Error(`Domain listing not supported for provider "${prov}"`);
        break;
      case "create": {
        if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("Invalid domain");
        if (prov === "elastic_email") result = await eeCreate(keyRow.api_key, domain, !!set_default);
        else throw new Error(`Domain creation not supported for provider "${prov}"`);
        break;
      }
      case "get": {
        if (!domain) throw new Error("domain is required");
        if (prov === "elastic_email") result = await eeGet(keyRow.api_key, domain);
        else throw new Error(`Domain lookup not supported for provider "${prov}"`);
        break;
      }
      case "verify": {
        if (!domain) throw new Error("domain is required");
        if (prov === "elastic_email") result = await eeVerify(keyRow.api_key, domain);
        else throw new Error(`Domain verification not supported for provider "${prov}"`);
        break;
      }
      case "delete": {
        if (!domain) throw new Error("domain is required");
        if (prov === "elastic_email") result = await eeDelete(keyRow.api_key, domain);
        else throw new Error(`Domain deletion not supported for provider "${prov}"`);
        break;
      }
      case "set_default": {
        if (!domain) throw new Error("domain is required");
        if (prov === "elastic_email") result = await eeSetDefault(keyRow.api_key, domain);
        else throw new Error(`Set-default not supported for provider "${prov}"`);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, provider: prov, label: PROVIDER_LABEL[prov] || prov, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("provider-domains error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
