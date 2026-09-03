-- Tier catalog
CREATE TABLE public.license_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  install_limit integer,
  support_months integer NOT NULL DEFAULT 12,
  is_custom boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.license_products TO anon;
GRANT SELECT ON public.license_products TO authenticated;
GRANT ALL ON public.license_products TO service_role;

ALTER TABLE public.license_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active license products"
  ON public.license_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage license products"
  ON public.license_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Licenses
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  key_last4 text NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  user_id uuid,
  product_slug text NOT NULL,
  tier_name text NOT NULL,
  install_limit integer,
  status text NOT NULL DEFAULT 'active',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  support_expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  amount_cents integer,
  currency text DEFAULT 'usd',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_licenses_email ON public.licenses (lower(customer_email));
CREATE INDEX idx_licenses_user ON public.licenses (user_id);
CREATE INDEX idx_licenses_status ON public.licenses (status);

GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own licenses"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Admins read all licenses"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Activations (install slots)
CREATE TABLE public.license_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  domain text NOT NULL,
  fingerprint text,
  ip_address text,
  app_version text,
  is_production boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_license_activation_domain
  ON public.license_activations (license_id, lower(domain))
  WHERE status = 'active';
CREATE INDEX idx_license_activations_license ON public.license_activations (license_id);

GRANT SELECT ON public.license_activations TO authenticated;
GRANT ALL ON public.license_activations TO service_role;

ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own activations"
  ON public.license_activations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.id = license_activations.license_id
      AND (l.user_id = auth.uid() OR lower(l.customer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  ));

CREATE POLICY "Admins read all activations"
  ON public.license_activations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Purchases
CREATE TABLE public.license_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  product_slug text NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'paid',
  source text NOT NULL DEFAULT 'stripe',
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_license_purchases_email ON public.license_purchases (lower(customer_email));

GRANT SELECT ON public.license_purchases TO authenticated;
GRANT ALL ON public.license_purchases TO service_role;

ALTER TABLE public.license_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read purchases"
  ON public.license_purchases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers read own purchases"
  ON public.license_purchases FOR SELECT
  TO authenticated
  USING (lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Enterprise / sales enquiries
CREATE TABLE public.license_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  installs_needed text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.license_leads TO anon;
GRANT INSERT, SELECT ON public.license_leads TO authenticated;
GRANT ALL ON public.license_leads TO service_role;

ALTER TABLE public.license_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a sales lead"
  ON public.license_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins read leads"
  ON public.license_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update leads"
  ON public.license_leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER license_products_updated_at BEFORE UPDATE ON public.license_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER licenses_updated_at BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER license_activations_updated_at BEFORE UPDATE ON public.license_activations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
