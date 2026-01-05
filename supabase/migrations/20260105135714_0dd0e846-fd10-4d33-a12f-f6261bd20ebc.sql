-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create campaign status enum
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled');

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  schedule_type TEXT NOT NULL DEFAULT 'now',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',
  batch_size INTEGER DEFAULT 50,
  batch_delay INTEGER DEFAULT 60,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.campaigns FOR DELETE
USING (auth.uid() = user_id);

-- Create contacts table (reusable recipients)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON public.contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts FOR DELETE
USING (auth.uid() = user_id);

-- Create campaign_recipients junction table
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients of their campaigns"
ON public.campaign_recipients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_recipients.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add recipients to their campaigns"
ON public.campaign_recipients FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_recipients.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete recipients from their campaigns"
ON public.campaign_recipients FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = campaign_recipients.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Create email_logs table
CREATE TYPE public.email_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');

CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status email_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their campaigns"
ON public.email_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = email_logs.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create logs for their campaigns"
ON public.email_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = email_logs.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_email_logs_campaign_id ON public.email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);