-- Create email_settings table to store SMTP/API configuration
CREATE TABLE public.email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Provider type
  provider_type TEXT NOT NULL DEFAULT 'api' CHECK (provider_type IN ('api', 'smtp')),
  
  -- API Settings
  api_provider TEXT,
  api_key TEXT,
  api_from_email TEXT,
  api_from_name TEXT,
  
  -- SMTP Settings
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT DEFAULT 'tls' CHECK (smtp_encryption IN ('none', 'ssl', 'tls')),
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  
  -- IP Configuration
  use_dedicated_ip BOOLEAN DEFAULT false,
  ip_pool TEXT,
  enable_ip_warmup BOOLEAN DEFAULT false,
  daily_warmup_limit INTEGER DEFAULT 100,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own email settings"
ON public.email_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email settings"
ON public.email_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email settings"
ON public.email_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email settings"
ON public.email_settings
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_email_settings_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for email_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_settings;