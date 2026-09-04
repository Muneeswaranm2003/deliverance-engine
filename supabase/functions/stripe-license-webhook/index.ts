// Stripe webhook: issues a license key after a successful one-time payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { generateLicenseKey, hashKey, keyParts } from "../_shared/license.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey);

  try {
    const raw = await req.text();
    const event = JSON.parse(raw);

    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = event.data.object;
    const email = (session.customer_details?.email ?? session.metadata?.customer_email ?? "")
      .trim()
      .toLowerCase();
    const slug = session.metadata?.product_slug;
    if (!email || !slug) throw new Error("Missing customer email or product slug on session");

    // idempotency
    const { data: existing } = await supabase
      .from("license_purchases")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: product } = await supabase
      .from("license_products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!product) throw new Error(`Unknown product ${slug}`);

    const key = generateLicenseKey();
    const { prefix, last4 } = keyParts(key);
    const supportExpires = new Date();
    supportExpires.setMonth(supportExpires.getMonth() + (product.support_months ?? 12));

    const { data: license, error } = await supabase
      .from("licenses")
      .insert({
        key_hash: await hashKey(key),
        key_prefix: prefix,
        key_last4: last4,
        customer_email: email,
        customer_name: session.customer_details?.name ?? null,
        product_slug: product.slug,
        tier_name: product.name,
        install_limit: product.install_limit,
        support_expires_at: supportExpires.toISOString(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        amount_cents: session.amount_total ?? product.price_cents,
        currency: session.currency ?? product.currency,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("license_purchases").insert({
      license_id: license.id,
      product_slug: product.slug,
      customer_email: email,
      customer_name: session.customer_details?.name ?? null,
      amount_cents: session.amount_total ?? product.price_cents,
      currency: session.currency ?? product.currency,
      status: "paid",
      source: "stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent ?? null,
      raw_payload: session,
    });

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Your ${product.name} is ready</h2>
        <p>Thanks for your purchase. Your perpetual license key:</p>
        <p style="font-size:18px;font-weight:700;letter-spacing:1px;background:#f1f5f9;padding:12px 16px;border-radius:8px;display:inline-block">${key}</p>
        <p>Installations included: <strong>${product.install_limit ?? "unlimited"}</strong><br/>
        Updates &amp; support until: <strong>${supportExpires.toDateString()}</strong></p>
        <p>Enter this key during setup of your self-hosted installation to activate it.</p>
        <p style="color:#64748b;font-size:13px">Store it safely — it is shown only once.</p>
      </div>`;
    await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject: `Your ${product.name} key`, html }),
    }).catch((e) => console.error("license email failed:", e));

    return new Response(JSON.stringify({ received: true, license_id: license.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-license-webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error)?.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
