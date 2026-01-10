-- Create automations table to persist automation rules
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('campaign', 'followup')),
  trigger TEXT NOT NULL,
  action TEXT NOT NULL,
  delay TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  triggered_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook_events table to log incoming events
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email TEXT NOT NULL,
  recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create automation_logs to track automation executions
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
  webhook_event_id UUID REFERENCES public.webhook_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for automations
CREATE POLICY "Users can view their own automations"
ON public.automations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automations"
ON public.automations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automations"
ON public.automations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automations"
ON public.automations FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for webhook_events (users can view events for their campaigns)
CREATE POLICY "Users can view events for their campaigns"
ON public.webhook_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = webhook_events.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Allow edge function to insert webhook events (using service role)
CREATE POLICY "Service role can insert webhook events"
ON public.webhook_events FOR INSERT
WITH CHECK (true);

-- RLS policies for automation_logs
CREATE POLICY "Users can view logs for their automations"
ON public.automation_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM automations
  WHERE automations.id = automation_logs.automation_id
  AND automations.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_automations_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster webhook event lookups
CREATE INDEX idx_webhook_events_campaign_id ON public.webhook_events(campaign_id);
CREATE INDEX idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs(automation_id);