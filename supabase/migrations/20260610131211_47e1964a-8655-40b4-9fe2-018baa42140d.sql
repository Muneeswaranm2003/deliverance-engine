
CREATE TABLE public.ses_identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.ses_identities(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('domain','subdomain')),
  domain TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'us-east-1',
  verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Success','Failed','TemporaryFailure','NotStarted')),
  dkim_tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
  dkim_verification_status TEXT,
  spf_record TEXT,
  dmarc_record TEXT,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ses_identities TO authenticated;
GRANT ALL ON public.ses_identities TO service_role;

ALTER TABLE public.ses_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own SES identities"
  ON public.ses_identities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all SES identities"
  ON public.ses_identities
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ses_identities_updated_at
  BEFORE UPDATE ON public.ses_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ses_identities_user_id_idx ON public.ses_identities(user_id);
CREATE INDEX ses_identities_parent_id_idx ON public.ses_identities(parent_id);
