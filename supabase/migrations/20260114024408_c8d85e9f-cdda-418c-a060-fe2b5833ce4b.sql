-- Create suppression_list table for tracking suppressed emails
CREATE TABLE public.suppression_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'soft_bounce', 'complaint', 'unsubscribe', 'manual')),
  source_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source_event_id UUID,
  bounce_type TEXT,
  complaint_type TEXT,
  notes TEXT,
  suppressed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own suppression list"
ON public.suppression_list
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their suppression list"
ON public.suppression_list
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their suppression list"
ON public.suppression_list
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their suppression list"
ON public.suppression_list
FOR DELETE
USING (auth.uid() = user_id);

-- Service role policy for edge functions
CREATE POLICY "Service role can manage suppression list"
ON public.suppression_list
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_suppression_list_user_email ON public.suppression_list(user_id, email);
CREATE INDEX idx_suppression_list_reason ON public.suppression_list(reason);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppression_list;

-- Add suppressed column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS suppressed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suppression_reason TEXT;