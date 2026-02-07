-- Add flow_config column to store the full multi-step flow as JSON
ALTER TABLE public.automations
ADD COLUMN flow_config jsonb DEFAULT NULL;

-- Add description column for the flow builder
ALTER TABLE public.automations
ADD COLUMN description text DEFAULT NULL;