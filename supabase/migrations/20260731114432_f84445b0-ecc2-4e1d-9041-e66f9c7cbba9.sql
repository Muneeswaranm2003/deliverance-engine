CREATE TABLE public.analytics_export_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'weekly',
  hour_utc integer NOT NULL DEFAULT 8,
  day_of_week integer NOT NULL DEFAULT 1,
  day_of_month integer NOT NULL DEFAULT 1,
  range_days integer NOT NULL DEFAULT 7,
  range_label text NOT NULL DEFAULT '7 days',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_error text,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_export_schedules_frequency_check CHECK (frequency IN ('daily','weekly','monthly')),
  CONSTRAINT analytics_export_schedules_hour_check CHECK (hour_utc BETWEEN 0 AND 23),
  CONSTRAINT analytics_export_schedules_dow_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT analytics_export_schedules_dom_check CHECK (day_of_month BETWEEN 1 AND 28),
  CONSTRAINT analytics_export_schedules_range_check CHECK (range_days BETWEEN 1 AND 365)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_export_schedules TO authenticated;
GRANT ALL ON public.analytics_export_schedules TO service_role;

ALTER TABLE public.analytics_export_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own export schedules"
  ON public.analytics_export_schedules FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_analytics_export_schedules_due
  ON public.analytics_export_schedules (next_run_at) WHERE enabled;

CREATE TRIGGER update_analytics_export_schedules_updated_at
  BEFORE UPDATE ON public.analytics_export_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();