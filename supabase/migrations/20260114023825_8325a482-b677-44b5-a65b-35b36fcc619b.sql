-- Add bounce/complaint tracking columns to email_logs
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bounce_type TEXT,
ADD COLUMN IF NOT EXISTS complaint_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS complaint_type TEXT;

-- Create email_events table for detailed webhook event tracking
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id UUID REFERENCES public.email_logs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_event_id TEXT,
  payload JSONB,
  bounce_type TEXT,
  bounce_reason TEXT,
  complaint_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_events
CREATE POLICY "Users can view events for their campaigns"
ON public.email_events
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = email_events.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Service role can insert email events"
ON public.email_events
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_email_events_email ON public.email_events(email);
CREATE INDEX idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_event_type ON public.email_events(event_type);

-- Enable realtime for email_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_events;