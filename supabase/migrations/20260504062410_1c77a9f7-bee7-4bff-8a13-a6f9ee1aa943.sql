-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Tighten api_keys: only admins/managers can write; owners still view
DROP POLICY IF EXISTS "Users can create their own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own api keys" ON public.api_keys;

CREATE POLICY "Admins/managers can create api keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update api keys"
  ON public.api_keys FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can delete api keys"
  ON public.api_keys FOR DELETE
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Tighten ip_pools likewise
DROP POLICY IF EXISTS "Users can create their own ip pools" ON public.ip_pools;
DROP POLICY IF EXISTS "Users can update their own ip pools" ON public.ip_pools;
DROP POLICY IF EXISTS "Users can delete their own ip pools" ON public.ip_pools;

CREATE POLICY "Admins/managers can create ip pools"
  ON public.ip_pools FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update ip pools"
  ON public.ip_pools FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can delete ip pools"
  ON public.ip_pools FOR DELETE
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Auto-grant 'admin' role to the first user (bootstrap), 'user' to subsequent
CREATE OR REPLACE FUNCTION public.bootstrap_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_user_role();

-- Backfill: make existing users admins if no admin exists, otherwise 'user'
DO $$
DECLARE
  u record;
  has_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;
  FOR u IN SELECT id FROM auth.users ORDER BY created_at ASC LOOP
    IF NOT has_admin THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin')
      ON CONFLICT DO NOTHING;
      has_admin := true;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'user')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;