
-- Table for multiple API keys with rotation/failover support
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  api_key text NOT NULL,
  label text NOT NULL DEFAULT 'Primary',
  priority integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  daily_limit integer DEFAULT NULL,
  emails_sent_today integer NOT NULL DEFAULT 0,
  last_reset_at timestamp with time zone DEFAULT now(),
  last_error text DEFAULT NULL,
  last_used_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own api keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own api keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own api keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

-- Table for IP pools management
CREATE TABLE public.ip_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pool_name text NOT NULL,
  description text DEFAULT NULL,
  ips text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  warmup_enabled boolean DEFAULT false,
  warmup_phase integer DEFAULT 1,
  warmup_daily_limit integer DEFAULT 100,
  warmup_start_date date DEFAULT NULL,
  warmup_schedule jsonb DEFAULT '[{"day":1,"limit":50},{"day":2,"limit":100},{"day":3,"limit":200},{"day":4,"limit":400},{"day":5,"limit":800},{"day":6,"limit":1500},{"day":7,"limit":3000}]'::jsonb,
  reputation_score numeric(5,2) DEFAULT 100.00,
  last_reputation_check timestamp with time zone DEFAULT NULL,
  blacklist_status text DEFAULT 'clean',
  total_sent integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_complaints integer DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0.00,
  complaint_rate numeric(5,2) DEFAULT 0.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ip pools" ON public.ip_pools FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ip pools" ON public.ip_pools FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ip pools" ON public.ip_pools FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ip pools" ON public.ip_pools FOR DELETE USING (auth.uid() = user_id);
