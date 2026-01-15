-- Add re-engagement tracking columns to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS last_engaged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS inactive_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reengagement_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reengagement_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create re_engagement_campaigns table to track re-engagement efforts
CREATE TABLE IF NOT EXISTS public.re_engagement_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, opened, clicked, failed, unsubscribed
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.re_engagement_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for re_engagement_campaigns
CREATE POLICY "Users can view their own re-engagement campaigns"
ON public.re_engagement_campaigns
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own re-engagement campaigns"
ON public.re_engagement_campaigns
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own re-engagement campaigns"
ON public.re_engagement_campaigns
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own re-engagement campaigns"
ON public.re_engagement_campaigns
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_engagement ON public.contacts(user_id, status, last_engaged_at);
CREATE INDEX IF NOT EXISTS idx_contacts_inactive ON public.contacts(user_id, inactive_since) WHERE inactive_since IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_engagement_campaigns_contact ON public.re_engagement_campaigns(contact_id);
CREATE INDEX IF NOT EXISTS idx_re_engagement_campaigns_user ON public.re_engagement_campaigns(user_id, status);

-- Add comment for documentation
COMMENT ON TABLE public.re_engagement_campaigns IS 'Tracks re-engagement attempts for inactive subscribers';