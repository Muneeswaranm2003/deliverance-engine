ALTER TABLE public.ses_identities
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ses_identities_rotation
  ON public.ses_identities (user_id, parent_id, is_active, verification_status, last_used_at NULLS FIRST);