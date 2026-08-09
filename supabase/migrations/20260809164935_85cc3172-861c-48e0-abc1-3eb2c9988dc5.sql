CREATE OR REPLACE FUNCTION public.validate_campaign_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- system-managed timestamps
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();

  IF NEW.created_at < timestamptz '2000-01-01' OR NEW.created_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Invalid campaign created_at value: %', NEW.created_at;
  END IF;

  -- timezone validation
  IF NEW.timezone IS NULL OR btrim(NEW.timezone) = '' THEN
    NEW.timezone := 'UTC';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid campaign timezone: %', NEW.timezone;
  END IF;

  -- scheduled_at rules
  IF NEW.schedule_type = 'scheduled' THEN
    IF NEW.scheduled_at IS NULL THEN
      RAISE EXCEPTION 'A scheduled campaign requires a valid scheduled_at timestamp';
    END IF;
    IF NEW.scheduled_at < timestamptz '2000-01-01'
       OR NEW.scheduled_at > now() + interval '5 years' THEN
      RAISE EXCEPTION 'scheduled_at % is outside the allowed range', NEW.scheduled_at;
    END IF;
    -- only enforce "future" when newly scheduling
    IF NEW.status IN ('draft','scheduled')
       AND (TG_OP = 'INSERT' OR OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at)
       AND NEW.scheduled_at < now() - interval '5 minutes' THEN
      RAISE EXCEPTION 'scheduled_at must be in the future';
    END IF;
  ELSE
    NEW.scheduled_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_campaign_timestamps() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_campaign_timestamps_trg ON public.campaigns;
CREATE TRIGGER validate_campaign_timestamps_trg
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_timestamps();