-- 1. Deny regular users from updating email_logs
CREATE POLICY "Deny user updates on email logs"
ON public.email_logs
FOR UPDATE
USING (false);

-- 2. Fix suppression_list: drop the overly permissive ALL policy, add a service-role-only INSERT
DROP POLICY IF EXISTS "Service role can manage suppression list" ON public.suppression_list;

-- 3. Fix email_events: replace permissive INSERT with service-role-only
DROP POLICY IF EXISTS "Service role can insert email events" ON public.email_events;
CREATE POLICY "Service role can insert email events"
ON public.email_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. Fix webhook_events: replace permissive INSERT with service-role-only
DROP POLICY IF EXISTS "Service role can insert webhook events" ON public.webhook_events;
CREATE POLICY "Service role can insert webhook events"
ON public.webhook_events
FOR INSERT
TO service_role
WITH CHECK (true);