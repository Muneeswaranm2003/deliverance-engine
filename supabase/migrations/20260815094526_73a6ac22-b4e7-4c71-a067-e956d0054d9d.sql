CREATE TABLE public.campaign_send_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  from_name text NOT NULL,
  from_email text NOT NULL,
  sender_domain text,
  provider text,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_send_jobs TO authenticated;
GRANT ALL ON public.campaign_send_jobs TO service_role;

ALTER TABLE public.campaign_send_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own send jobs"
ON public.campaign_send_jobs FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_send_jobs_due ON public.campaign_send_jobs (status, run_at);
CREATE INDEX idx_send_jobs_campaign ON public.campaign_send_jobs (campaign_id, status);

CREATE TRIGGER update_campaign_send_jobs_updated_at
BEFORE UPDATE ON public.campaign_send_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();