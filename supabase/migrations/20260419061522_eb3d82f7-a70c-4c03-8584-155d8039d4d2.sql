-- SMTP Servers
CREATE TABLE public.smtp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Primary SMTP',
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  encryption TEXT NOT NULL DEFAULT 'tls' CHECK (encryption IN ('none','tls','ssl','starttls')),
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER,
  emails_sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smtp servers" ON public.smtp_servers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own smtp servers" ON public.smtp_servers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own smtp servers" ON public.smtp_servers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own smtp servers" ON public.smtp_servers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER smtp_servers_updated_at BEFORE UPDATE ON public.smtp_servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Routing Rules
CREATE TABLE public.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  match_type TEXT NOT NULL CHECK (match_type IN ('recipient_domain','campaign_id','volume_threshold','always')),
  match_value TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('api_key','smtp_server','ip_pool')),
  target_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own routing rules" ON public.routing_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own routing rules" ON public.routing_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own routing rules" ON public.routing_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own routing rules" ON public.routing_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER routing_rules_updated_at BEFORE UPDATE ON public.routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DNS Check Results
CREATE TABLE public.dns_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('SPF','DKIM','DMARC','MX','PTR','BIMI','MTA-STS')),
  status TEXT NOT NULL CHECK (status IN ('pass','warning','fail','unknown')),
  value TEXT,
  recommendation TEXT,
  selector TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dns_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dns checks" ON public.dns_check_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own dns checks" ON public.dns_check_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dns checks" ON public.dns_check_results FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dns_checks_user_domain ON public.dns_check_results(user_id, domain, checked_at DESC);

-- IP rDNS Checks
CREATE TABLE public.ip_rdns_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_pool_id UUID,
  ip_address TEXT NOT NULL,
  ptr_record TEXT,
  expected_hostname TEXT,
  status TEXT NOT NULL CHECK (status IN ('valid','missing','mismatch','error')),
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_rdns_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rdns checks" ON public.ip_rdns_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own rdns checks" ON public.ip_rdns_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rdns checks" ON public.ip_rdns_checks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_rdns_checks_user_pool ON public.ip_rdns_checks(user_id, ip_pool_id, checked_at DESC);