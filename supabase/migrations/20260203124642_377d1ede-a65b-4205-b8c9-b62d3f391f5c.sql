-- Create list_segments table to store saved contact segments
CREATE TABLE public.list_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.list_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own segments"
ON public.list_segments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own segments"
ON public.list_segments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own segments"
ON public.list_segments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own segments"
ON public.list_segments FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_list_segments_updated_at
BEFORE UPDATE ON public.list_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_list_segments_user_id ON public.list_segments(user_id);