ALTER TABLE public.analytics_export_schedules
  ADD COLUMN IF NOT EXISTS subject_template text,
  ADD COLUMN IF NOT EXISTS message_template text;