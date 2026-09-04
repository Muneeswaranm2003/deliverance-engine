// Creates a one-time Stripe Checkout session for a license tier.
// Falls back with a clear, machine-readable error when payments are not configured yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const body = await req.json().catch(() => ({}));
    const slug = String(body.product_slug || "");
    const email = String(body.customer_email || "").trim().toLowerCase();
    const origin = String(body.origin || req.headers.get("origin") || "");

    if (!slug || !email) return json({ error: "product_slug and customer_email are required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: product } = await supabase
      .from("license_products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!product) return json({ error: "Unknown license tier" }, 400);
    if (product.is_custom) return json({ error: "This tier is quoted by sales", code: "contact_sales" }, 400);

    if (!stripeKey) {
      return json(
        {
          code: "payments_unavailable",
          error:
            "Card checkout is not connected yet. Request the license and we will send a payment link and your key.",
        },
        503,
      );
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/license?purchase=success`);
    params.set("cancel_url", `${origin}/pricing?purchase=cancelled`);
    params.set("customer_email", email);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", product.currency);
    params.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
    params.set("line_items[0][price_data][product_data][name]", product.name);
    params.set(
      "line_items[0][price_data][product_data][description]",
      product.description ?? "Perpetual self-hosted license",
    );
    params.set("metadata[product_slug]", product.slug);
    params.set("metadata[customer_email]", email);
    params.set("payment_intent_data[metadata][product_slug]", product.slug);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await res.json();
    if (!res.ok) return json({ error: session?.error?.message ?? "Stripe error" }, 502);

    return json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("license-checkout error:", err);
    return json({ error: (err as Error)?.message ?? "Unexpected error" }, 500);
  }
});
