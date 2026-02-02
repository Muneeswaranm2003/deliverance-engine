-- Create sender domains table with ordering
CREATE TABLE public.sender_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1 CHECK (display_order >= 1 AND display_order <= 5),
  domain_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, display_order),
  UNIQUE(user_id, from_email)
);

-- Enable RLS
ALTER TABLE public.sender_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sender domains"
ON public.sender_domains
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sender domains"
ON public.sender_domains
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sender domains"
ON public.sender_domains
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sender domains"
ON public.sender_domains
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to enforce max 5 domains per user
CREATE OR REPLACE FUNCTION public.check_max_sender_domains()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.sender_domains WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 sender domains allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER enforce_max_sender_domains
BEFORE INSERT ON public.sender_domains
FOR EACH ROW
EXECUTE FUNCTION public.check_max_sender_domains();

-- Create updated_at trigger
CREATE TRIGGER update_sender_domains_updated_at
BEFORE UPDATE ON public.sender_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_sender_domains_user_order ON public.sender_domains(user_id, display_order);

-- Create campaign_sender_domains junction table for campaigns
CREATE TABLE public.campaign_sender_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sender_domain_id UUID NOT NULL REFERENCES public.sender_domains(id) ON DELETE CASCADE,
  send_order INTEGER NOT NULL DEFAULT 1 CHECK (send_order >= 1 AND send_order <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, send_order),
  UNIQUE(campaign_id, sender_domain_id)
);

-- Enable RLS
ALTER TABLE public.campaign_sender_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_sender_domains
CREATE POLICY "Users can view sender domains of their campaigns"
ON public.campaign_sender_domains
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = campaign_sender_domains.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can add sender domains to their campaigns"
ON public.campaign_sender_domains
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = campaign_sender_domains.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can delete sender domains from their campaigns"
ON public.campaign_sender_domains
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = campaign_sender_domains.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Create function to enforce max 5 sender domains per campaign
CREATE OR REPLACE FUNCTION public.check_max_campaign_sender_domains()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.campaign_sender_domains WHERE campaign_id = NEW.campaign_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 sender domains allowed per campaign';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER enforce_max_campaign_sender_domains
BEFORE INSERT ON public.campaign_sender_domains
FOR EACH ROW
EXECUTE FUNCTION public.check_max_campaign_sender_domains();