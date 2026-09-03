// Admin-only licensing operations: issue, revoke, restore, extend support, release a slot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateLicenseKey, hashKey, keyParts } from "../_shared/license.ts";

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

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "issue") {
      const email = String(body.customer_email || "").trim().toLowerCase();
      const slug = String(body.product_slug || "").trim();
      if (!email || !slug) return json({ error: "customer_email and product_slug are required" }, 400);

      const { data: product } = await admin
        .from("license_products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!product) return json({ error: "Unknown product" }, 400);

      const key = generateLicenseKey();
      const { prefix, last4 } = keyParts(key);
      const installLimit =
        body.install_limit === null || body.install_limit === undefined || body.install_limit === ""
          ? product.install_limit
          : Number(body.install_limit);
      const supportMonths = Number(body.support_months ?? product.support_months ?? 12);
      const supportExpires = new Date();
      supportExpires.setMonth(supportExpires.getMonth() + supportMonths);

      const { data: license, error } = await admin
        .from("licenses")
        .insert({
          key_hash: await hashKey(key),
          key_prefix: prefix,
          key_last4: last4,
          customer_email: email,
          customer_name: body.customer_name ?? null,
          product_slug: product.slug,
          tier_name: product.name,
          install_limit: Number.isFinite(installLimit) ? installLimit : null,
          support_expires_at: supportExpires.toISOString(),
          amount_cents: body.amount_cents ?? product.price_cents,
          currency: product.currency,
          notes: body.notes ?? "Issued manually by admin",
        })
        .select()
        .single();
      if (error) throw error;

      await admin.from("license_purchases").insert({
        license_id: license.id,
        product_slug: product.slug,
        customer_email: email,
        customer_name: body.customer_name ?? null,
        amount_cents: body.amount_cents ?? product.price_cents,
        currency: product.currency,
        status: "paid",
        source: "manual",
      });

      if (body.send_email !== false) {
        await sendLicenseEmail(url, serviceKey, email, key, product.name, supportExpires.toISOString());
      }

      // The plaintext key is returned exactly once.
      return json({ success: true, license_key: key, license });
    }

    if (action === "revoke" || action === "restore") {
      const id = String(body.license_id || "");
      if (!id) return json({ error: "license_id is required" }, 400);
      const patch =
        action === "revoke"
          ? {
              status: "revoked",
              revoked_at: new Date().toISOString(),
              revoked_reason: body.reason ?? "Revoked by admin",
            }
          : { status: "active", revoked_at: null, revoked_reason: null };
      const { error } = await admin.from("licenses").update(patch).eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "extend_support") {
      const id = String(body.license_id || "");
      const months = Number(body.months ?? 12);
      if (!id || !Number.isFinite(months)) return json({ error: "license_id and months are required" }, 400);
      const { data: lic } = await admin
        .from("licenses")
        .select("support_expires_at")
        .eq("id", id)
        .maybeSingle();
      if (!lic) return json({ error: "License not found" }, 404);
      const base = lic.support_expires_at && new Date(lic.support_expires_at) > new Date()
        ? new Date(lic.support_expires_at)
        : new Date();
      base.setMonth(base.getMonth() + months);
      const { error } = await admin
        .from("licenses")
        .update({ support_expires_at: base.toISOString() })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true, support_expires_at: base.toISOString() });
    }

    if (action === "release_slot") {
      const id = String(body.activation_id || "");
      if (!id) return json({ error: "activation_id is required" }, 400);
      const { error } = await admin
        .from("license_activations")
        .update({ status: "released", deactivated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "update_install_limit") {
      const id = String(body.license_id || "");
      const limitRaw = body.install_limit;
      if (!id) return json({ error: "license_id is required" }, 400);
      const limit = limitRaw === null || limitRaw === "" ? null : Number(limitRaw);
      const { error } = await admin.from("licenses").update({ install_limit: limit }).eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("license-admin error:", err);
    return json({ error: (err as Error)?.message ?? "Unexpected error" }, 500);
  }
});

async function sendLicenseEmail(
  url: string,
  serviceKey: string,
  to: string,
  key: string,
  tierName: string,
  supportExpiresAt: string,
) {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>Your ${tierName} is ready</h2>
      <p>Thanks for your purchase. Here is your perpetual license key:</p>
      <p style="font-size:18px;font-weight:700;letter-spacing:1px;background:#f1f5f9;padding:12px 16px;border-radius:8px;display:inline-block">${key}</p>
      <p>Updates and support are included until <strong>${new Date(supportExpiresAt).toDateString()}</strong>.
      The license itself is perpetual — your installation keeps working after that date.</p>
      <p>Activate your self-hosted installation by entering this key in the installer, or by calling the
      license activation endpoint with your domain.</p>
      <p style="color:#64748b;font-size:13px">Keep this key safe — it is shown only once.</p>
    </div>`;
  try {
    await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: `Your ${tierName} key`, html }),
    });
  } catch (e) {
    console.error("license email failed:", e);
  }
}
