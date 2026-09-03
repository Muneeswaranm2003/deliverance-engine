// Public licensing API used by self-hosted installations.
// Endpoints: POST { action: "activate" | "validate" | "deactivate", ... }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  cleanDomain,
  GRACE_PERIOD_DAYS,
  hashKey,
  isNonProductionDomain,
  normalizeKey,
  signActivationToken,
  supportActive,
} from "../_shared/license.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const signingSecret =
    Deno.env.get("LICENSE_SIGNING_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();
    const key = normalizeKey(String(body.license_key || ""));
    const domain = cleanDomain(String(body.domain || ""));
    const fingerprint = body.fingerprint ? String(body.fingerprint).slice(0, 128) : null;
    const appVersion = body.app_version ? String(body.app_version).slice(0, 40) : null;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    if (!["activate", "validate", "deactivate"].includes(action)) {
      return json({ valid: false, error: "Unknown action" }, 400);
    }
    if (!key) return json({ valid: false, error: "license_key is required" }, 400);
    if (!domain) return json({ valid: false, error: "domain is required" }, 400);

    const { data: license } = await supabase
      .from("licenses")
      .select("*")
      .eq("key_hash", await hashKey(key))
      .maybeSingle();

    if (!license) return json({ valid: false, error: "License key not found" }, 404);
    if (license.status === "revoked") {
      return json(
        { valid: false, status: "revoked", error: license.revoked_reason || "This license has been revoked." },
        403,
      );
    }

    const nonProd = isNonProductionDomain(domain);
    const entitlements = {
      tier: license.product_slug,
      tier_name: license.tier_name,
      install_limit: license.install_limit,
      updates_and_support_until: license.support_expires_at,
      updates_and_support_active: supportActive(license.support_expires_at),
      grace_period_days: GRACE_PERIOD_DAYS,
    };

    const { data: activeSlots } = await supabase
      .from("license_activations")
      .select("id, domain, is_production, last_seen_at")
      .eq("license_id", license.id)
      .eq("status", "active");

    const existing = (activeSlots ?? []).find((a) => cleanDomain(a.domain) === domain);

    if (action === "deactivate") {
      if (!existing) return json({ valid: true, deactivated: false, message: "No active install for this domain." });
      await supabase
        .from("license_activations")
        .update({ status: "released", deactivated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return json({ valid: true, deactivated: true });
    }

    if (action === "validate") {
      if (!existing) {
        return json({ valid: false, error: "This domain is not activated for the license.", entitlements }, 403);
      }
      await supabase
        .from("license_activations")
        .update({ last_seen_at: new Date().toISOString(), app_version: appVersion ?? existing_app(existing) })
        .eq("id", existing.id);
      return json({
        valid: true,
        status: license.status,
        entitlements,
        token: await signActivationToken(
          { lic: license.id, dom: domain, tier: license.product_slug },
          signingSecret,
        ),
      });
    }

    // activate
    if (existing) {
      await supabase
        .from("license_activations")
        .update({ last_seen_at: new Date().toISOString(), fingerprint, ip_address: ip, app_version: appVersion })
        .eq("id", existing.id);
    } else {
      const productionUsed = (activeSlots ?? []).filter((a) => a.is_production).length;
      const limit = license.install_limit;
      if (!nonProd && limit !== null && productionUsed >= limit) {
        return json(
          {
            valid: false,
            error: `All ${limit} installation slot${limit > 1 ? "s" : ""} are in use. Deactivate an existing install or upgrade your license.`,
            slots_used: productionUsed,
            entitlements,
          },
          409,
        );
      }
      const { error: insErr } = await supabase.from("license_activations").insert({
        license_id: license.id,
        domain,
        fingerprint,
        ip_address: ip,
        app_version: appVersion,
        is_production: !nonProd,
      });
      if (insErr) throw insErr;
    }

    return json({
      valid: true,
      status: license.status,
      is_production_slot: !nonProd,
      entitlements,
      token: await signActivationToken(
        { lic: license.id, dom: domain, tier: license.product_slug },
        signingSecret,
      ),
    });
  } catch (err) {
    console.error("license-api error:", err);
    return json({ valid: false, error: (err as Error)?.message ?? "Unexpected error" }, 500);
  }
});

function existing_app(row: Record<string, unknown>): string | null {
  return (row.app_version as string) ?? null;
}
